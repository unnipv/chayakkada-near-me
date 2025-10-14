const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Sample chayakkadas in Kerala (using real places for authenticity)
const sampleChayakkadas = [
  {
    google_place_id: 'sample_kochi_tea_1',
    name: 'Royal Tea Stall',
    latitude: 9.9312,
    longitude: 76.2673,
    address: 'MG Road, Kochi, Kerala',
    google_rating: 4.2,
    chayakkada_rating: 4.5,
    items_available: 'Pazhampori, Egg Puffs, Samosa, Vada, Strong Tea, Parotta',
    sells_cigarettes: false
  },
  {
    google_place_id: 'sample_kochi_tea_2',
    name: 'Malabar Cafe',
    latitude: 9.9252,
    longitude: 76.2599,
    address: 'Marine Drive, Kochi, Kerala',
    google_rating: 4.5,
    chayakkada_rating: 4.8,
    items_available: 'Pazhampori, Egg Puffs, Beef Cutlet, Kadala Curry, Tea',
    sells_cigarettes: true
  },
  {
    google_place_id: 'sample_thrissur_tea_1',
    name: 'Swaad Tea Shop',
    latitude: 10.5276,
    longitude: 76.2144,
    address: 'Round South, Thrissur, Kerala',
    google_rating: 4.0,
    chayakkada_rating: 4.3,
    items_available: 'Pazhampori, Samosa, Unniyappam, Sulaimani Tea',
    sells_cigarettes: false
  },
  {
    google_place_id: 'sample_calicut_tea_1',
    name: 'Kerala Tea House',
    latitude: 11.2588,
    longitude: 75.7804,
    address: 'SM Street, Kozhikode, Kerala',
    google_rating: 4.3,
    chayakkada_rating: 4.6,
    items_available: 'Pazhampori, Egg Puffs, Chicken Cutlet, Sulaimani, Ginger Tea',
    sells_cigarettes: true
  },
  {
    google_place_id: 'sample_trivandrum_tea_1',
    name: 'Anand Tea Stall',
    latitude: 8.5241,
    longitude: 76.9366,
    address: 'Statue Junction, Thiruvananthapuram, Kerala',
    google_rating: 4.1,
    chayakkada_rating: 4.4,
    items_available: 'Pazhampori, Vada, Bonda, Samosa, Strong Tea',
    sells_cigarettes: false
  },
  {
    google_place_id: 'sample_kottayam_tea_1',
    name: 'Aroma Tea Shop',
    latitude: 9.5916,
    longitude: 76.5222,
    address: 'MC Road, Kottayam, Kerala',
    google_rating: 4.4,
    chayakkada_rating: 4.7,
    items_available: 'Pazhampori, Egg Puffs, Samosa, Chicken Roll, Kadala, Tea',
    sells_cigarettes: true
  }
];

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding...');

    for (const shop of sampleChayakkadas) {
      await client.query('BEGIN');

      // Insert chayakkada
      const result = await client.query(`
        INSERT INTO chayakkadas
          (google_place_id, name, location, address, google_rating, google_photo_references)
        VALUES
          ($1, $2, ST_MakePoint($3, $4)::geography, $5, $6, $7)
        ON CONFLICT (google_place_id) DO NOTHING
        RETURNING id
      `, [
        shop.google_place_id,
        shop.name,
        shop.longitude,
        shop.latitude,
        shop.address,
        shop.google_rating,
        JSON.stringify([])
      ]);

      if (result.rows.length > 0) {
        const chayakkadaId = result.rows[0].id;

        // Insert metadata
        await client.query(`
          INSERT INTO chayakkada_metadata
            (chayakkada_id, chayakkada_rating, items_available, sells_cigarettes, contributed_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          chayakkadaId,
          shop.chayakkada_rating,
          shop.items_available,
          shop.sells_cigarettes,
          'Seed Data'
        ]);

        console.log(`✓ Added: ${shop.name}`);
      } else {
        console.log(`- Skipped (already exists): ${shop.name}`);
      }

      await client.query('COMMIT');
    }

    console.log('\n✓ Database seeding completed successfully!');
    console.log(`Total chayakkadas: ${sampleChayakkadas.length}`);
    console.log('\nYou can now test the search functionality!');
    console.log('Try searching for locations like: Kochi, Thrissur, Kozhikode, etc.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedDatabase()
  .then(() => {
    console.log('\nSeeding script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
