# Changelog

## Recent Updates

### Reviews System ✅
- Added full reviews functionality for chayakkadas
- Users can write text reviews with optional names
- Reviews display in shop detail modal
- API endpoints: `POST /api/chayakkada/:id/review` and `GET /api/chayakkada/:id/reviews`
- Database table: `reviews` with chayakkada_id, review_text, reviewer_name, created_at

### System-wide Logging ✅
- Integrated Winston logging library
- Logs to console (colored) and files (`logs/combined.log`, `logs/error.log`)
- Request logging middleware tracks all API calls with duration
- Structured logging with timestamps and metadata
- Log files auto-rotate at 5MB with 5 file retention

### Location Search Autocomplete ✅
- Main search input now uses Google Maps Autocomplete
- Same UX as the "Add Chayakkada" form
- Auto-populates coordinates when user selects a place
- Restricted to India for better results
- Fallback to manual geocoding still available

## Database Schema

### Tables Created
1. **chayakkadas** - Main shop data with PostGIS location
2. **chayakkada_metadata** - User-contributed ratings and items
3. **reviews** - User reviews (NEW)

### Indexes
- `chayakkadas_location_idx` - GiST index for spatial queries
- `reviews_chayakkada_idx` - Index on chayakkada_id for fast review lookups

## API Endpoints

### Reviews
- `POST /api/chayakkada/:id/review` - Add a review
  - Body: `{ review_text, reviewer_name? }`
- `GET /api/chayakkada/:id/reviews` - Get all reviews for a shop

### Existing
- `POST /api/search` - Search with filters
- `GET /api/chayakkada/:id` - Get shop details (now includes reviews)
- `POST /api/chayakkada` - Add new shop
- `POST /api/chayakkada/:id/metadata` - Add metadata
- `POST /api/geocode` - Geocode address
- `GET /api/health` - Health check

## Logging Locations

- **Console**: Colored, real-time logs
- **logs/combined.log**: All logs (info, warn, error)
- **logs/error.log**: Error logs only
- Auto-rotation: 5MB max, 5 files kept

## Configuration

Add to `.env`:
```env
LOG_LEVEL=info  # Optional: debug, info, warn, error
```

## Frontend Changes

### New UI Components
- Review cards with reviewer name and date
- "Write a Review" button and modal
- Review submission form
- Google Maps autocomplete on location search input

### Styling
- `.review-card` - Individual review styling
- `.review-header` - Name and date display
- `.review-text` - Review content styling
- Consistent with chayakkada theme (tea brown, cream colors)

## Testing

Run seed script to add test data:
```bash
npm run seed
```

Try the new features:
1. Search using autocomplete (type "Kochi" and select)
2. Click a shop → See reviews section
3. Click "Write a Review" → Submit a review
4. Check logs in `logs/` directory

## Next Steps / Future Enhancements

- [ ] Review ratings (1-5 stars)
- [ ] Review upvoting/helpful system
- [ ] Photo uploads in reviews
- [ ] Edit/delete own contributions
- [ ] User authentication
- [ ] Admin moderation panel
- [ ] Export data functionality
- [ ] Mobile app version
