const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('@googlemaps/google-maps-services-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res.statusCode, duration);
  });
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files except index.html
app.use(express.static('public', { index: false }));

// Serve index.html with API key injected
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error loading page');
    }

    // Replace placeholder with actual API key from environment
    const html = data.replace(/YOUR_API_KEY/g, process.env.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY');
    res.send(html);
  });
});

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Google Maps client
const googleMapsClient = new Client({});

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Enable PostGIS extension for geospatial queries
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');

    // Create chayakkadas table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chayakkadas (
        id SERIAL PRIMARY KEY,
        google_place_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        address TEXT,
        google_rating REAL,
        google_photo_references JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create spatial index for faster distance queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS chayakkadas_location_idx
      ON chayakkadas USING GIST(location)
    `);

    // Create metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chayakkada_metadata (
        id SERIAL PRIMARY KEY,
        chayakkada_id INTEGER NOT NULL,
        chayakkada_rating REAL,
        items_available TEXT,
        sells_cigarettes BOOLEAN DEFAULT false,
        contributed_by TEXT,
        contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chayakkada_id) REFERENCES chayakkadas(id) ON DELETE CASCADE
      )
    `);

    // Create reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        chayakkada_id INTEGER NOT NULL,
        review_text TEXT NOT NULL,
        reviewer_name TEXT DEFAULT 'Anonymous',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chayakkada_id) REFERENCES chayakkadas(id) ON DELETE CASCADE
      )
    `);

    // Create index on reviews for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS reviews_chayakkada_idx
      ON reviews(chayakkada_id)
    `);

    logger.info('Database schema initialized successfully');
  } catch (err) {
    logger.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

// Initialize database on startup
initDatabase();

// API Routes

// Search chayakkadas by location and filters
app.post('/api/search', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance, maxWalkingTime } = req.body;
    logger.info('Search request received', { latitude, longitude, maxDistance, maxWalkingTime });

    if (!latitude || !longitude) {
      logger.warn('Search request missing coordinates');
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // First, do a broad search using PostGIS to get candidates
    // Use a generous radius to ensure we don't miss shops
    const searchRadiusMeters = maxDistance ? maxDistance * 1500 : 5000; // 1.5x buffer or 5km default

    const query = `
      SELECT
        c.id,
        c.google_place_id,
        c.name,
        ST_Y(c.location::geometry) as latitude,
        ST_X(c.location::geometry) as longitude,
        c.address,
        c.google_rating,
        c.google_photo_references,
        ST_Distance(c.location, ST_MakePoint($1, $2)::geography) as straight_distance,
        m.chayakkada_rating,
        m.items_available,
        m.sells_cigarettes
      FROM chayakkadas c
      LEFT JOIN LATERAL (
        SELECT chayakkada_rating, items_available, sells_cigarettes
        FROM chayakkada_metadata
        WHERE chayakkada_id = c.id
        ORDER BY contributed_at DESC
        LIMIT 1
      ) m ON true
      WHERE ST_DWithin(c.location, ST_MakePoint($1, $2)::geography, $3)
      ORDER BY straight_distance ASC
      LIMIT 50
    `;

    const result = await pool.query(query, [longitude, latitude, searchRadiusMeters]);

    if (result.rows.length === 0) {
      return res.json([]);
    }

    // Prepare destinations for Distance Matrix API
    const destinations = result.rows.map(shop => ({
      lat: shop.latitude,
      lng: shop.longitude
    }));

    // Call Google Maps Distance Matrix API
    const distanceMatrixResponse = await googleMapsClient.distancematrix({
      params: {
        origins: [{ lat: latitude, lng: longitude }],
        destinations: destinations,
        mode: 'walking',
        units: 'metric',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    // Combine results with walking data
    const shops = result.rows.map((shop, index) => {
      const element = distanceMatrixResponse.data.rows[0]?.elements[index];

      let walkingDistance = null;
      let walkingTime = null;

      if (element && element.status === 'OK') {
        walkingDistance = (element.distance.value / 1000).toFixed(2); // Convert to km
        walkingTime = Math.round(element.duration.value / 60); // Convert to minutes
      }

      return {
        ...shop,
        walkingDistance,
        walkingTime,
        straight_distance: (shop.straight_distance / 1000).toFixed(2),
        google_photo_references: shop.google_photo_references || []
      };
    });

    // Filter by user criteria
    let filtered = shops.filter(shop => shop.walkingDistance !== null);

    if (maxDistance) {
      filtered = filtered.filter(shop => parseFloat(shop.walkingDistance) <= maxDistance);
    }

    if (maxWalkingTime) {
      filtered = filtered.filter(shop => shop.walkingTime <= maxWalkingTime);
    }

    // Sort by walking time
    filtered.sort((a, b) => a.walkingTime - b.walkingTime);

    logger.info(`Search completed: ${filtered.length} results found`);
    res.json(filtered);
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Get single chayakkada details
app.get('/api/chayakkada/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching details for chayakkada ID: ${id}`);

    // Get chayakkada details
    const shopResult = await pool.query(`
      SELECT
        id,
        google_place_id,
        name,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude,
        address,
        google_rating,
        google_photo_references,
        created_at
      FROM chayakkadas
      WHERE id = $1
    `, [id]);

    if (shopResult.rows.length === 0) {
      logger.warn(`Chayakkada not found: ${id}`);
      return res.status(404).json({ error: 'Chayakkada not found' });
    }

    const shop = shopResult.rows[0];

    // Get all metadata entries
    const metadataResult = await pool.query(`
      SELECT * FROM chayakkada_metadata
      WHERE chayakkada_id = $1
      ORDER BY contributed_at DESC
    `, [id]);

    // Get all reviews
    const reviewsResult = await pool.query(`
      SELECT * FROM reviews
      WHERE chayakkada_id = $1
      ORDER BY created_at DESC
    `, [id]);

    shop.metadata = metadataResult.rows;
    shop.latestMetadata = metadataResult.rows[0] || null;
    shop.reviews = reviewsResult.rows;

    logger.info(`Chayakkada details fetched successfully: ${shop.name}`);
    res.json(shop);
  } catch (err) {
    logger.error('Get chayakkada error:', err);
    res.status(500).json({ error: 'Failed to fetch chayakkada', details: err.message });
  }
});

// Add new chayakkada
app.post('/api/chayakkada', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      google_place_id,
      name,
      latitude,
      longitude,
      address,
      google_rating,
      google_photo_references,
      chayakkada_rating,
      items_available,
      sells_cigarettes,
      contributed_by
    } = req.body;

    if (!google_place_id || !name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    // Insert chayakkada
    const insertResult = await client.query(`
      INSERT INTO chayakkadas
        (google_place_id, name, location, address, google_rating, google_photo_references)
      VALUES
        ($1, $2, ST_MakePoint($3, $4)::geography, $5, $6, $7)
      ON CONFLICT (google_place_id) DO UPDATE
        SET name = EXCLUDED.name,
            address = EXCLUDED.address,
            google_rating = EXCLUDED.google_rating
      RETURNING id
    `, [google_place_id, name, longitude, latitude, address, google_rating, JSON.stringify(google_photo_references || [])]);

    const chayakkadaId = insertResult.rows[0].id;

    // Insert metadata if provided
    if (chayakkada_rating || items_available || sells_cigarettes !== undefined) {
      await client.query(`
        INSERT INTO chayakkada_metadata
          (chayakkada_id, chayakkada_rating, items_available, sells_cigarettes, contributed_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [chayakkadaId, chayakkada_rating, items_available, sells_cigarettes || false, contributed_by]);
    }

    await client.query('COMMIT');

    res.json({ id: chayakkadaId, message: 'Chayakkada added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add chayakkada error:', err);
    res.status(500).json({ error: 'Failed to add chayakkada', details: err.message });
  } finally {
    client.release();
  }
});

// Add metadata to existing chayakkada
app.post('/api/chayakkada/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const { chayakkada_rating, items_available, sells_cigarettes, contributed_by } = req.body;

    await pool.query(`
      INSERT INTO chayakkada_metadata
        (chayakkada_id, chayakkada_rating, items_available, sells_cigarettes, contributed_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, chayakkada_rating, items_available, sells_cigarettes || false, contributed_by]);

    res.json({ message: 'Metadata added successfully' });
  } catch (err) {
    console.error('Add metadata error:', err);
    res.status(500).json({ error: 'Failed to add metadata', details: err.message });
  }
});

// Geocode address to get coordinates (helper endpoint)
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    const response = await googleMapsClient.geocode({
      params: {
        address,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      res.json({
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: response.data.results[0].formatted_address
      });
    } else {
      logger.warn(`Location not found for address: ${address}`);
      res.status(404).json({ error: 'Location not found' });
    }
  } catch (err) {
    logger.error('Geocode error:', err);
    res.status(500).json({ error: 'Geocoding failed', details: err.message });
  }
});

// Add review to chayakkada
app.post('/api/chayakkada/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { review_text, reviewer_name } = req.body;

    if (!review_text || review_text.trim().length === 0) {
      logger.warn('Review submission failed: empty review text');
      return res.status(400).json({ error: 'Review text is required' });
    }

    logger.info(`Adding review to chayakkada ID: ${id}`, { reviewer: reviewer_name || 'Anonymous' });

    const result = await pool.query(`
      INSERT INTO reviews (chayakkada_id, review_text, reviewer_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, review_text.trim(), reviewer_name || 'Anonymous']);

    logger.info(`Review added successfully to chayakkada ${id}`);
    res.json({ message: 'Review added successfully', review: result.rows[0] });
  } catch (err) {
    logger.error('Add review error:', err);
    res.status(500).json({ error: 'Failed to add review', details: err.message });
  }
});

// Get reviews for a chayakkada
app.get('/api/chayakkada/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching reviews for chayakkada ID: ${id}`);

    const result = await pool.query(`
      SELECT * FROM reviews
      WHERE chayakkada_id = $1
      ORDER BY created_at DESC
    `, [id]);

    logger.info(`Found ${result.rows.length} reviews for chayakkada ${id}`);
    res.json(result.rows);
  } catch (err) {
    logger.error('Get reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews', details: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  pool.end(() => {
    logger.info('Database pool closed');
    process.exit(0);
  });
});
