# ☕ Chayakkada Near Me

Find chayakkadas (Kerala tea shops) in your walkable radius! A community-driven webapp to discover and contribute information about local tea shops.

## Features

- **Location-based Search with Autocomplete**:
  - Search using Google Maps autocomplete
  - Real walking times via Distance Matrix API (not just straight-line distance)
  - Filter by max distance and walking time
- **Map & List Views**: Toggle between list view and interactive map with markers
- **Reviews System**:
  - Write and read text reviews
  - Optional reviewer names
  - Community-driven feedback
- **Community Contributions**:
  - Add new chayakkadas from Google Maps Places
  - Contribute metadata (ratings, items, cigarettes availability)
  - Full contribution history
- **Detailed Information**:
  - Google Maps data (name, rating, photos, address)
  - Community ratings
  - Items available (pazhampori, egg puffs, samosa, vada, etc.)
  - Whether cigarettes are sold
  - User reviews
- **Comprehensive Logging**: Winston-based logging for all API requests and operations

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL with PostGIS extension for geospatial queries
- **Logging**: Winston (structured logging to console and files)
- **Maps**: Google Maps JavaScript API, Places API, Distance Matrix API, Geocoding API
- **Frontend**: Vanilla HTML/CSS/JavaScript (lightweight!)

## Setup

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Google Maps API Key with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Distance Matrix API
  - Geocoding API

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd chayakkada-near-me
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chayakkada
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NODE_ENV=development
PORT=3000
```

5. Create PostgreSQL database:
```bash
createdb chayakkada
```

6. Update the Google Maps API key in the HTML:
   - Open `public/index.html`
   - Replace `YOUR_API_KEY` in the Google Maps script tag (line 135) with your actual API key
   - Open `public/app.js`
   - Replace `YOUR_API_KEY` in the photo URL (line 255) with your actual API key

7. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

8. Open your browser and navigate to:
```
http://localhost:3000
```

## Database Schema

The application automatically creates the necessary tables on startup:

- **chayakkadas**: Main table with place details and geospatial location
- **chayakkada_metadata**: User-contributed metadata (ratings, items, etc.)

PostGIS extension is automatically enabled for efficient geospatial queries.

## API Endpoints

### Search
- `POST /api/search` - Search for chayakkadas
  - Body: `{ latitude, longitude, maxDistance?, maxWalkingTime? }`

### Chayakkada Details
- `GET /api/chayakkada/:id` - Get detailed information about a specific chayakkada

### Add Chayakkada
- `POST /api/chayakkada` - Add a new chayakkada
  - Body: `{ google_place_id, name, latitude, longitude, address, google_rating, google_photo_references, chayakkada_rating?, items_available?, sells_cigarettes?, contributed_by? }`

### Add Metadata
- `POST /api/chayakkada/:id/metadata` - Add metadata to existing chayakkada
  - Body: `{ chayakkada_rating?, items_available?, sells_cigarettes?, contributed_by? }`

### Geocoding
- `POST /api/geocode` - Convert address to coordinates
  - Body: `{ address }`

## Deployment

### Deploying to Cloud

This app is designed to be easily deployed to any cloud platform that supports Node.js and PostgreSQL:

**Recommended platforms:**
- **Railway**: Offers PostgreSQL + Node.js hosting with free tier
- **Render**: Free PostgreSQL and web service hosting
- **Vercel/Netlify**: For frontend + serverless functions (with external DB)
- **Heroku**: Classic option with PostgreSQL add-on

**Environment variables to set:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key
- `NODE_ENV=production`

**Don't forget:**
- Enable PostGIS extension on your production database
- Update CORS settings in `server.js` if needed
- Set up database backups

## UI Theme

The UI uses a warm, rustic chayakkada theme with:
- Tea brown and cream color palette
- Kerala-inspired typography
- Friendly, accessible design
- Responsive layout for mobile and desktop

## Contributing

Contributions are welcome! Feel free to:
- Add new features
- Improve the UI
- Fix bugs
- Add tests
- Improve documentation

## License

MIT
