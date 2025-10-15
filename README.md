# ☕ Chayakkada Near Me

> Find chayakkadas (Kerala tea shops) in your walkable radius! A community-driven webapp to discover and contribute information about local tea shops.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D12.0-blue)](https://www.postgresql.org/)

## Features

### 🔍 Smart Search
- **Location-based Search** with Google Maps autocomplete
- **Real Walking Times** via Distance Matrix API (not just straight-line distance!)
- **Customizable Filters** for max distance and walking time
- **Current Location** detection support

### 🗺️ Interactive Maps
- **Dual View Mode**: Toggle between list and interactive map views
- **Custom Markers**: Tea cup markers for chayakkadas, location marker for you
- **Click to Navigate**: Direct Google Maps navigation integration

### ⭐ Reviews & Ratings
- **Community Reviews**: Write and read text reviews
- **Dual Rating System**: Google ratings + community chayakkada ratings
- **Review History**: Track all reviews for each chayakkada

### 🤝 Community-Driven
- **Add New Places**: Search and add from Google Maps Places API
- **Contribute Details**: Rate, list items, update availability
- **Contribution History**: Full transparency of all contributions
- **User Authentication**: Optional login for contributors

### 📊 Rich Information
- Google Maps data (name, rating, photos, address)
- Community chayakkada ratings (1-5 stars)
- Items available (pazhampori, egg puffs, samosa, vada, chai varieties)
- Cigarette availability indicator
- Photo galleries from Google Places

### 🔒 Security & Performance
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive validation with express-validator
- **Security Headers**: Helmet.js for secure HTTP headers
- **Logging**: Winston-based structured logging
- **SQL Injection Protection**: Parameterized queries only

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL with PostGIS extension for geospatial queries
- **Authentication**: JWT with bcrypt password hashing
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize, HPP protection
- **Logging**: Winston (structured logging to console and files)
- **Maps**: Google Maps JavaScript API, Places API, Distance Matrix API, Geocoding API
- **Frontend**: Vanilla HTML/CSS/JavaScript (lightweight and fast!)
- **Styling**: Responsive CSS with Kerala-inspired warm color palette

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

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chayakkada-near-me.git
   cd chayakkada-near-me
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/chayakkada
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   JWT_SECRET=your_secure_jwt_secret_here
   NODE_ENV=development
   PORT=3000
   ```

4. **Create PostgreSQL database**
   ```bash
   createdb chayakkada
   ```

5. **Start the server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

### Google Maps API Setup

You need to enable these APIs in your Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
   - Geocoding API
4. Create credentials (API Key)
5. Add the API key to your `.env` file

**Important**: Restrict your API key in production:
- Set HTTP referrer restrictions
- Set API restrictions to only the APIs you need

## Database Schema

The application automatically creates the necessary tables on startup:

- **chayakkadas**: Main table with place details and geospatial location (PostGIS GEOGRAPHY type)
- **chayakkada_metadata**: User-contributed metadata (ratings, items, cigarettes)
- **reviews**: User reviews for each chayakkada
- **users**: User authentication data (hashed passwords)

PostGIS extension is automatically enabled for efficient geospatial queries. Spatial indexes are created for optimal performance.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Search & Discovery
- `POST /api/search` - Search for chayakkadas with filters
- `GET /api/chayakkada/:id` - Get detailed chayakkada information
- `GET /api/chayakkada/:id/reviews` - Get all reviews for a chayakkada

### Contributions
- `POST /api/chayakkada` - Add a new chayakkada
- `POST /api/chayakkada/:id/metadata` - Add/update chayakkada details
- `POST /api/chayakkada/:id/review` - Add a review

### Utilities
- `POST /api/geocode` - Convert address to coordinates
- `GET /api/places/autocomplete` - Google Places autocomplete
- `GET /api/places/details` - Get Google Place details
- `GET /api/photo-proxy` - Proxy for Google Places photos
- `GET /api/health` - Health check endpoint

All endpoints include rate limiting and input validation. Authentication is optional for viewing, required for contributions.

## Deployment

### Deploying to Cloud

This app is designed to be easily deployed to any cloud platform that supports Node.js and PostgreSQL:

**Recommended platforms:**
- **Railway**: PostgreSQL + Node.js hosting with generous free tier
- **Render**: Free PostgreSQL and web service hosting
- **Fly.io**: Global deployment with PostgreSQL
- **Heroku**: Classic option with PostgreSQL add-on
- **DigitalOcean App Platform**: Simple deployment with managed databases

### Deployment Checklist

1. **Environment Variables**
   - `DATABASE_URL` - PostgreSQL connection string with SSL enabled
   - `GOOGLE_MAPS_API_KEY` - API key with proper restrictions
   - `JWT_SECRET` - Secure random string (use `openssl rand -base64 32`)
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS` - Your production domain(s)

2. **Database Setup**
   - Enable PostGIS extension: `CREATE EXTENSION IF NOT EXISTS postgis;`
   - Run migrations (automatic on first server start)
   - Set up automated backups
   - Configure connection pooling

3. **Security Checklist**
   - Restrict Google Maps API key (HTTP referrer + API restrictions)
   - Set strong JWT secret
   - Enable HTTPS (most platforms do this automatically)
   - Configure CORS for your production domain
   - Review rate limits in `middleware/security.js`

4. **Performance Optimization**
   - Enable gzip compression (handled by hosting platform)
   - Set up CDN for static assets (optional)
   - Configure database connection pool size
   - Monitor API usage and costs

## Architecture

```
├── public/              # Frontend static files
│   ├── index.html      # Single-page application
│   ├── styles.css      # Responsive CSS with theme
│   └── app.js          # Vanilla JavaScript
├── middleware/          # Express middleware
│   ├── auth.js         # JWT authentication
│   ├── security.js     # Security & rate limiting
│   └── validators.js   # Input validation
├── server.js           # Main Express server
├── logger.js           # Winston logging configuration
└── seed.js             # Database seeding script
```

## Performance Features

- **Geospatial Indexing**: PostGIS GIST indexes for sub-millisecond location queries
- **API Proxying**: Backend proxies Google APIs to keep keys secure
- **Rate Limiting**: Prevents abuse and manages API costs
- **Efficient Queries**: Optimized SQL with proper joins and limits
- **Photo Caching**: Browser caching headers for Google Photos

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick start:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] Add user profiles and contribution history
- [ ] Implement favorite/bookmark functionality
- [ ] Add photo upload for community-contributed images
- [ ] Create mobile app (React Native)
- [ ] Add social sharing features
- [ ] Implement advanced filtering (opening hours, price range)
- [ ] Add support for other languages (Malayalam, Hindi)
- [ ] Create analytics dashboard for administrators

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the chai culture of Kerala
- Built with modern web technologies
- Community-driven data and contributions
- Google Maps Platform for location services

## Support

- Report bugs via [GitHub Issues](https://github.com/YOUR_USERNAME/chayakkada-near-me/issues)
- Feature requests welcome
- Pull requests appreciated

---

Made with ❤️ and ☕ for the chayakkada community
