# Quick Start Guide

Get your Chayakkada Near Me app running in minutes!

## Prerequisites Checklist

- [x] PostgreSQL 17 installed and running
- [x] Node.js installed
- [ ] Google Maps API Key (get one below)

## Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
   - Geocoding API
4. Create credentials → API Key
5. Copy your API key

## Step 2: Configure Environment

```zsh
# Copy the example env file
cp .env.example .env

# Edit .env file
nano .env
```

Update with your values:
```env
DATABASE_URL=postgresql://localhost:5432/chayakkada
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
NODE_ENV=development
PORT=3000
```

## Step 3: Seed Test Data

```zsh
npm run seed
```

You should see:
```
✓ Added: Royal Tea Stall
✓ Added: Malabar Cafe
... (6 chayakkadas total)
```

## Step 4: Start the App

```zsh
npm start
```

Open your browser: **http://localhost:3000**

## Testing the App

### Test Search Functionality

1. **Search by typing a location:**
   - Type "Kochi" in the location field
   - Set filters (optional): Max Distance: 5km, Max Walking Time: 30 min
   - Click "Search Chayakkadas"
   - You should see 2 results (Royal Tea Stall and Malabar Cafe)

2. **Try other locations:**
   - "Thrissur" → Swaad Tea Shop
   - "Kozhikode" → Kerala Tea House
   - "Thiruvananthapuram" → Anand Tea Stall
   - "Kottayam" → Aroma Tea Shop

3. **Toggle Map View:**
   - Click the "🗺️ Map" button
   - See markers on the map
   - Click a marker to view details

### Test Shop Details

1. Click on any chayakkada card
2. View details modal with:
   - Name, address, ratings
   - Items available
   - Photos (if any)
   - Contribution history

### Test Contributing to Existing Shop

1. Open any shop detail
2. Click "Add Details" button
3. Fill in:
   - Rating (e.g., 4.5)
   - Items available (e.g., "Pazhampori, Tea, Samosa")
   - Cigarettes checkbox
   - Your name (optional)
4. Submit
5. See updated details!

### Test Adding New Chayakkada

1. Click "Add Chayakkada" button in header
2. Search for a place: "Cafe Coffee Day Kochi"
3. Select from autocomplete suggestions
4. See selected place details
5. Add metadata (rating, items, etc.)
6. Submit
7. Search for the location to verify it was added!

## Common Issues

### "No chayakkadas found"

**Issue:** Search returns no results

**Solution:**
- Make sure you ran `npm run seed` first
- Check your filters aren't too restrictive
- Try a broader location like "Kerala"

### "Failed to search"

**Issue:** API errors in search

**Solutions:**
- Check your Google Maps API key in `.env`
- Verify all required APIs are enabled in Google Cloud Console
- Check Distance Matrix API hasn't exceeded free tier (2,500 requests/day)

### Maps not loading

**Issue:** Blank map or "For development purposes only" watermark

**Solutions:**
- Add billing to your Google Cloud account (free tier is generous)
- Check API key has Maps JavaScript API enabled
- Verify API key is correctly in `.env` file

### Place search not working

**Issue:** Autocomplete doesn't show suggestions

**Solutions:**
- Enable Places API in Google Cloud Console
- Check browser console for errors
- Verify API key permissions

## Database Commands

```zsh
# View all chayakkadas
psql chayakkada -c "SELECT name, address FROM chayakkadas;"

# View metadata
psql chayakkada -c "SELECT * FROM chayakkada_metadata;"

# Clear all data (start fresh)
psql chayakkada -c "TRUNCATE chayakkadas CASCADE;"

# Re-seed after clearing
npm run seed
```

## Development Tips

### Auto-reload on Changes

```zsh
npm run dev
```

This uses Node's `--watch` flag to restart on file changes.

### Check Logs

Server logs appear in the terminal where you ran `npm start`. Watch for:
- `Database schema initialized successfully` ✓
- `Server running on http://localhost:3000` ✓
- Any error messages ✗

### Browser DevTools

Open browser console (F12) to see:
- Network requests to API
- JavaScript errors
- API responses

## Next Steps

Once everything is working:

1. **Add real chayakkadas** - Use the "Add Chayakkada" feature to add your favorite local spots
2. **Share with friends** - Get community contributions
3. **Deploy to production** - See [README.md](README.md) for deployment options
4. **Customize** - Modify styles in `public/styles.css` to match your preferences

## Need Help?

- Check [README.md](README.md) for full documentation
- Check [SETUP_POSTGRES.md](SETUP_POSTGRES.md) for database issues
- Look at browser console and server logs for errors
- Check that all environment variables are set correctly

Enjoy finding your nearest chayakkada! ☕
