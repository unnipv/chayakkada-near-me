-- Chayakkada Near Me Database Schema
-- PostgreSQL with PostGIS extension

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create chayakkadas table
CREATE TABLE IF NOT EXISTS chayakkadas (
  id SERIAL PRIMARY KEY,
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  google_rating REAL,
  google_photo_references JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for faster distance queries
CREATE INDEX IF NOT EXISTS chayakkadas_location_idx
ON chayakkadas USING GIST(location);

-- Create metadata table
CREATE TABLE IF NOT EXISTS chayakkada_metadata (
  id SERIAL PRIMARY KEY,
  chayakkada_id INTEGER NOT NULL,
  chayakkada_rating REAL,
  items_available TEXT,
  sells_cigarettes BOOLEAN DEFAULT false,
  contributed_by TEXT,
  contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chayakkada_id) REFERENCES chayakkadas(id) ON DELETE CASCADE
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  chayakkada_id INTEGER NOT NULL,
  review_text TEXT NOT NULL,
  reviewer_name TEXT DEFAULT 'Anonymous',
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chayakkada_id) REFERENCES chayakkadas(id) ON DELETE CASCADE
);

-- Create index on reviews for faster queries
CREATE INDEX IF NOT EXISTS reviews_chayakkada_idx
ON reviews(chayakkada_id);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS users_username_idx
ON users(username);
