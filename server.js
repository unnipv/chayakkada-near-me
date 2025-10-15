const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./logger');
const { generateToken, verifyToken, optionalAuth } = require('./middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateReview,
  validateMetadata,
  validateAddChayakkada,
  validateSearch
} = require('./middleware/validators');
const {
  apiLimiter,
  authLimiter,
  contributionLimiter,
  searchLimiter,
  helmetConfig,
  sanitizeData,
  preventHpp
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Security checks
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    logger.error('CRITICAL: JWT_SECRET not set in production!');
    process.exit(1);
  }
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    logger.error('CRITICAL: GOOGLE_MAPS_API_KEY not set!');
    process.exit(1);
  }
}

// Security middleware (MUST be first)
app.use(helmetConfig);
app.use(preventHpp);
app.use(sanitizeData);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res.statusCode, duration);
  });
  next();
});

// CORS configuration - restrict in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parser with size limits
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files except index.html
app.use(express.static('public', { index: false }));

// Serve static index.html (no API key injection needed!)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});


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
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chayakkada_id) REFERENCES chayakkadas(id) ON DELETE CASCADE
      )
    `);

    // Create index on reviews for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS reviews_chayakkada_idx
      ON reviews(chayakkada_id)
    `);

    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Create index on username for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS users_username_idx
      ON users(username)
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

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', authLimiter, validateRegistration, async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info('Registration attempt', { username });

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

    if (existing.rows.length > 0) {
      logger.warn('Registration failed: username already exists', { username });
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(`
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
    `, [username, passwordHash]);

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info('User registered successfully', { username, userId: user.id });

    res.json({
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// Login user
app.post('/api/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info('Login attempt', { username });

    // Get user
    const result = await pool.query(`
      SELECT id, username, password_hash FROM users WHERE username = $1
    `, [username]);

    if (result.rows.length === 0) {
      logger.warn('Login failed: user not found', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      logger.warn('Login failed: invalid password', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = generateToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info('User logged in successfully', { username, userId: user.id });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  logger.info('User logged out');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, created_at, last_login
      FROM users
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

// Search chayakkadas by location and filters
app.post('/api/search', searchLimiter, validateSearch, async (req, res) => {
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

    // Call Google Maps Distance Matrix API using axios
    const origins = `${latitude},${longitude}`;
    const dests = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const distanceMatrixResponse = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins,
          destinations: dests,
          mode: 'walking',
          units: 'metric',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );

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

    // Fetch fresh photos from Google Places API if we have a place_id
    if (shop.google_place_id) {
      try {
        logger.info(`Fetching fresh photos for ${shop.name} (place_id: ${shop.google_place_id})`);
        const placesResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/place/details/json',
          {
            params: {
              place_id: shop.google_place_id,
              fields: 'photos',
              key: process.env.GOOGLE_MAPS_API_KEY
            }
          }
        );

        logger.info(`Google API response status: ${placesResponse.data.status}`);

        if (placesResponse.data.result && placesResponse.data.result.photos) {
          // Get top 6 photo references
          shop.google_photo_references = placesResponse.data.result.photos
            .slice(0, 6)
            .map(photo => photo.photo_reference);
          logger.info(`✓ Fetched ${shop.google_photo_references.length} fresh photos for ${shop.name}`);
        } else {
          logger.warn(`No photos returned from Google Places API for ${shop.name}`);
        }
      } catch (photoErr) {
        logger.error(`Failed to fetch fresh photos for ${shop.name}:`, photoErr.response?.data || photoErr.message);
        // Keep existing photo references from database
      }
    }

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

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );

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

// Place autocomplete proxy (for frontend)
app.get('/api/places/autocomplete', apiLimiter, async (req, res) => {
  try {
    const { input } = req.query;

    if (!input || input.length < 3) {
      return res.status(400).json({ error: 'Input must be at least 3 characters' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input,
          components: 'country:in',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );

    logger.info('Place autocomplete request', { input, results: response.data.predictions?.length || 0 });
    res.json(response.data);
  } catch (err) {
    logger.error('Place autocomplete error:', err);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// Place details proxy (for frontend)
app.get('/api/places/details', apiLimiter, async (req, res) => {
  try {
    const { place_id } = req.query;

    if (!place_id) {
      return res.status(400).json({ error: 'Place ID required' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id,
          fields: 'place_id,name,geometry,formatted_address,rating,photos',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );

    logger.info('Place details request', { place_id });
    res.json(response.data);
  } catch (err) {
    logger.error('Place details error:', err);
    res.status(500).json({ error: 'Place details failed' });
  }
});

// Photo proxy endpoint (keeps API key secure on backend)
app.get('/api/places/photo/:reference', apiLimiter, async (req, res) => {
  try {
    const { reference } = req.params;
    const { maxwidth = 400 } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Photo reference required' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/photo',
      {
        params: {
          photo_reference: reference,
          maxwidth,
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        responseType: 'stream'
      }
    );

    // Forward the image response
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    response.data.pipe(res);

    logger.info('Photo served', { reference, maxwidth });
  } catch (err) {
    logger.error('Photo fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Photo proxy with query params (alternative endpoint)
app.get('/api/photo-proxy', apiLimiter, async (req, res) => {
  try {
    const { photo_reference, maxwidth = 400 } = req.query;

    if (!photo_reference) {
      return res.status(400).json({ error: 'Photo reference required' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/photo',
      {
        params: {
          photo_reference,
          maxwidth,
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        responseType: 'stream'
      }
    );

    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);

    logger.info('Photo proxy served', { photo_reference, maxwidth });
  } catch (err) {
    logger.error('Photo proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch photo' });
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
