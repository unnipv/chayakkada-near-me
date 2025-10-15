// Global variables
let map;
let markers = [];
let searchResults = [];
let currentLocation = null;
let selectedPlace = null;
let currentUser = null;

// Authentication functions
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      updateAuthUI();
    } else {
      currentUser = null;
      updateAuthUI();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('login-btn');
  const userMenu = document.getElementById('user-menu');
  const usernameDisplay = document.getElementById('username-display');

  if (currentUser) {
    loginBtn.style.display = 'none';
    userMenu.style.display = 'inline-block';
    usernameDisplay.textContent = `👤 ${currentUser.username}`;
  } else {
    loginBtn.style.display = 'inline-block';
    userMenu.style.display = 'none';
  }
}

function showAuthModal(mode) {
  const modal = document.getElementById('auth-modal');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (mode === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  }

  modal.style.display = 'block';
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
  // Clear forms
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('register-username').value = '';
  document.getElementById('register-password').value = '';
  document.getElementById('register-password-confirm').value = '';
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      updateAuthUI();
      closeAuthModal();
      alert(`Welcome back, ${data.user.username}!`);
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed. Please try again.');
  }
}

async function handleRegister() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-password-confirm').value;

  if (!username || !password || !confirmPassword) {
    alert('Please fill in all fields');
    return;
  }

  if (username.length < 3) {
    alert('Username must be at least 3 characters');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      updateAuthUI();
      closeAuthModal();
      alert(`Welcome, ${data.user.username}! Your account has been created.`);
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Registration failed. Please try again.');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    currentUser = null;
    updateAuthUI();
    alert('Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  }
}

// Initialize Leaflet Map
function initMap() {
  // Create Leaflet map centered on Kerala
  map = L.map('map').setView([10.8505, 76.2711], 10);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Setup place search autocomplete for contribution form
  setupPlaceSearch();

  // Setup location search autocomplete
  setupLocationSearch();

  // Check authentication status on page load
  checkAuthStatus();
}

// View Management
function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`${viewName}-view`).classList.add('active');

  // Auto-populate contributor name when opening contribute view
  if (viewName === 'contribute' && currentUser) {
    const contributorNameField = document.getElementById('contributor-name');
    if (contributorNameField && !contributorNameField.value) {
      contributorNameField.value = currentUser.username;
    }
  }
}

// Search functionality
async function searchChayakkadas() {
  const locationInput = document.getElementById('location-input').value.trim();
  const maxDistance = parseFloat(document.getElementById('max-distance').value) || null;
  const maxTime = parseInt(document.getElementById('max-time').value) || null;

  if (!locationInput && !currentLocation) {
    alert('Please enter a location or use your current location');
    return;
  }

  // Show loading
  document.getElementById('loading').style.display = 'block';
  document.getElementById('results-section').style.display = 'none';

  try {
    let latitude, longitude;

    if (currentLocation) {
      latitude = currentLocation.latitude;
      longitude = currentLocation.longitude;
    } else {
      // Geocode the location
      const geocodeResponse = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: locationInput })
      });

      if (!geocodeResponse.ok) {
        throw new Error('Location not found');
      }

      const geocodeData = await geocodeResponse.json();
      latitude = geocodeData.latitude;
      longitude = geocodeData.longitude;
    }

    // Search for chayakkadas
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        maxDistance,
        maxWalkingTime: maxTime
      })
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    searchResults = await response.json();
    displayResults(searchResults, { lat: latitude, lng: longitude });

  } catch (error) {
    console.error('Search error:', error);
    alert('Failed to search. Please try again.');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function displayResults(shops, userLocation) {
  const resultsSection = document.getElementById('results-section');
  const shopsList = document.getElementById('shops-list');
  const resultsCount = document.getElementById('results-count');

  resultsSection.style.display = 'block';
  resultsCount.textContent = `Found ${shops.length} chayakkada${shops.length !== 1 ? 's' : ''}`;

  if (shops.length === 0) {
    shopsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">☕</div>
        <h3>No chayakkadas found</h3>
        <p>Try expanding your search radius or be the first to add one!</p>
      </div>
    `;
    return;
  }

  shopsList.innerHTML = shops.map(shop => `
    <div class="shop-card">
      <div onclick="showShopDetail(${shop.id})" style="cursor: pointer;">
        <div class="shop-card-header">
          <div>
            <div class="shop-name">${shop.name}</div>
            <div class="shop-address">${shop.address || 'Address not available'}</div>
          </div>
          <div class="shop-distance">
            🚶 ${shop.walkingTime} min
          </div>
        </div>
        <div class="shop-meta">
          ${shop.google_rating ? `<div class="meta-item">⭐ ${shop.google_rating}</div>` : ''}
          ${shop.chayakkada_rating ? `<div class="meta-item"><span class="rating-badge">Chayakkada: ${shop.chayakkada_rating}/5</span></div>` : ''}
          <div class="meta-item">📍 ${shop.walkingDistance} km</div>
          ${shop.sells_cigarettes ? '<div class="meta-item"><span class="cigarettes-badge">🚬 Cigarettes</span></div>' : ''}
        </div>
        ${shop.items_available ? `<div class="meta-item" style="margin-top: 10px;">☕ ${shop.items_available}</div>` : ''}
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}"
           target="_blank"
           class="btn btn-primary"
           style="width: 100%; text-align: center; text-decoration: none; display: inline-block;"
           onclick="event.stopPropagation()">
          🗺️ Navigate with Google Maps
        </a>
      </div>
    </div>
  `).join('');

  // Update map
  updateMap(shops, userLocation);
}

function updateMap(shops, userLocation) {
  // Clear existing markers
  markers.forEach(marker => marker.remove());
  markers = [];

  // Center map on user location
  map.setView([userLocation.lat, userLocation.lng], 13);

  // Add user location marker
  const userMarker = L.marker([userLocation.lat, userLocation.lng], {
    icon: L.divIcon({
      className: 'user-marker',
      html: '<div style="background: #4285F4; border-radius: 50%; width: 20px; height: 20px; border: 2px solid white;"></div>',
      iconSize: [20, 20]
    })
  }).addTo(map).bindPopup('Your Location');
  markers.push(userMarker);

  // Add chayakkada markers
  shops.forEach(shop => {
    const marker = L.marker([shop.latitude, shop.longitude], {
      icon: L.divIcon({
        className: 'chayakkada-marker',
        html: '<div style="background: #6B4423; border-radius: 50%; width: 30px; height: 30px; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px;">☕</div>',
        iconSize: [30, 30]
      })
    }).addTo(map);

    marker.bindPopup(`<strong>${shop.name}</strong><br>${shop.walkingTime} min walk`);

    marker.on('click', () => {
      showShopDetail(shop.id);
    });

    markers.push(marker);
  });
}

function toggleView(viewType) {
  const listView = document.getElementById('list-view');
  const mapView = document.getElementById('map-view');
  const listBtn = document.getElementById('list-view-btn');
  const mapBtn = document.getElementById('map-view-btn');

  if (viewType === 'list') {
    listView.style.display = 'block';
    mapView.style.display = 'none';
    listBtn.classList.add('btn-primary');
    listBtn.classList.remove('btn-secondary');
    mapBtn.classList.add('btn-secondary');
    mapBtn.classList.remove('btn-primary');
  } else {
    listView.style.display = 'none';
    mapView.style.display = 'block';
    mapBtn.classList.add('btn-primary');
    mapBtn.classList.remove('btn-secondary');
    listBtn.classList.add('btn-secondary');
    listBtn.classList.remove('btn-primary');

    // Invalidate map size when showing it
    setTimeout(() => map.invalidateSize(), 100);
  }
}

// Current location
function useCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      document.getElementById('location-input').value = 'Current Location';
      alert('Current location captured!');
    },
    error => {
      console.error('Geolocation error:', error);
      alert('Unable to get your location. Please enter it manually.');
    }
  );
}

// Shop detail modal
async function showShopDetail(shopId) {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');

  content.innerHTML = '<div class="loading"><div class="loader"></div></div>';
  modal.style.display = 'block';

  try {
    const response = await fetch(`/api/chayakkada/${shopId}`);
    if (!response.ok) throw new Error('Failed to fetch details');

    const shop = await response.json();

    content.innerHTML = `
      <div class="detail-header">
        <h2 class="detail-title">${shop.name}</h2>
        <p class="detail-address">${shop.address || 'Address not available'}</p>
      </div>

      ${shop.google_rating ? `
        <div class="detail-section">
          <h3>Google Rating</h3>
          <div class="meta-item">⭐ ${shop.google_rating} / 5</div>
        </div>
      ` : ''}

      ${shop.latestMetadata ? `
        <div class="detail-section">
          <h3>Chayakkada Details</h3>
          ${shop.latestMetadata.chayakkada_rating ? `<p><strong>Chayakkada Rating:</strong> ${shop.latestMetadata.chayakkada_rating} / 5</p>` : ''}
          ${shop.latestMetadata.items_available ? `
            <p><strong>Items Available:</strong></p>
            <ul class="items-list">
              ${shop.latestMetadata.items_available.split(',').map(item => `<li>${item.trim()}</li>`).join('')}
            </ul>
          ` : ''}
          ${shop.latestMetadata.sells_cigarettes ? '<p><span class="cigarettes-badge">🚬 Sells Cigarettes</span></p>' : ''}
          ${shop.latestMetadata.contributed_by ? `<p style="margin-top: 15px; color: #666; font-size: 0.9em;"><em>Contributed by ${shop.latestMetadata.contributed_by} on ${new Date(shop.latestMetadata.contributed_at).toLocaleDateString()}</em></p>` : ''}
        </div>
      ` : ''}

      ${shop.google_photo_references && shop.google_photo_references.length > 0 ? `
        <div class="detail-section">
          <h3>Photos</h3>
          <div class="photo-gallery">
            ${shop.google_photo_references.slice(0, 6).map(ref => `
              <img src="/api/photo-proxy?photo_reference=${ref}&maxwidth=400" alt="Chayakkada photo">
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Reviews Section -->
      <div class="detail-section">
        <h3>Reviews (${shop.reviews ? shop.reviews.length : 0})</h3>
        ${shop.reviews && shop.reviews.length > 0 ? `
          <div class="reviews-list">
            ${shop.reviews.map(review => `
              <div class="review-card">
                <div class="review-header">
                  <strong>${review.reviewer_name}</strong>
                  <span class="review-date">${new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <p class="review-text">${review.review_text}</p>
              </div>
            `).join('')}
          </div>
        ` : '<p>No reviews yet. Be the first to review!</p>'}
        <button class="btn btn-primary" style="margin-top: 15px;" onclick="showReviewForm(${shop.id})">Write a Review</button>
      </div>

      <div class="detail-section">
        <h3>Contribute</h3>
        <p>Know more about this chayakkada? Help the community by adding details!</p>
        <button class="btn btn-primary" onclick="contributeToShop(${shop.id})">Add Details</button>
      </div>

      ${shop.metadata && shop.metadata.length > 1 ? `
        <div class="detail-section">
          <h3>Contribution History</h3>
          <div class="metadata-history">
            ${shop.metadata.slice(1).map(m => `
              <div class="metadata-entry">
                <div class="metadata-entry-header">
                  ${m.contributed_by || 'Anonymous'} • ${new Date(m.contributed_at).toLocaleDateString()}
                </div>
                ${m.chayakkada_rating ? `<p>Rating: ${m.chayakkada_rating}/5</p>` : ''}
                ${m.items_available ? `<p>Items: ${m.items_available}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Detail error:', error);
    content.innerHTML = '<p>Failed to load details. Please try again.</p>';
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

function contributeToShop(shopId) {
  closeDetailModal();

  // Create a contribution modal
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <h2>Add Details to This Chayakkada</h2>
    <p class="help-text">Share your experience to help the community!</p>

    <div class="form-group">
      <label for="contribute-rating">Chayakkada Rating (1-5)</label>
      <div class="rating-input">
        <input
          type="number"
          id="contribute-rating"
          min="1"
          max="5"
          step="0.5"
          class="input"
          placeholder="Rate the chayakkada"
          onchange="updateContributeStars()"
        >
        <span class="rating-stars" id="contribute-stars"></span>
      </div>
    </div>

    <div class="form-group">
      <label for="contribute-items">Items Available</label>
      <textarea
        id="contribute-items"
        placeholder="e.g., Pazhampori, Egg Puffs, Samosa, Vada, Strong Tea..."
        class="textarea"
        rows="3"
      ></textarea>
    </div>

    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" id="contribute-cigarettes">
        Sells Cigarettes
      </label>
    </div>

    <div class="form-group">
      <label for="contribute-name">Your Name (optional)</label>
      <input
        type="text"
        id="contribute-name"
        placeholder="Anonymous"
        class="input"
      >
    </div>

    <button class="btn btn-primary btn-large" onclick="submitContribution(${shopId})">
      Submit Contribution
    </button>
    <button class="btn btn-secondary btn-large" onclick="closeDetailModal()" style="margin-top: 10px;">
      Cancel
    </button>
  `;

  modal.style.display = 'block';
}

function updateContributeStars() {
  const rating = parseFloat(document.getElementById('contribute-rating').value);
  const starsDiv = document.getElementById('contribute-stars');

  if (rating >= 1 && rating <= 5) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    let stars = '⭐'.repeat(fullStars);
    if (hasHalf && fullStars < 5) stars += '⭐';

    starsDiv.textContent = stars;
  } else {
    starsDiv.textContent = '';
  }
}

async function submitContribution(shopId) {
  const chayakkadaRating = parseFloat(document.getElementById('contribute-rating').value) || null;
  const itemsAvailable = document.getElementById('contribute-items').value.trim() || null;
  const sellsCigarettes = document.getElementById('contribute-cigarettes').checked;
  const contributorName = document.getElementById('contribute-name').value.trim() || 'Anonymous';

  if (!chayakkadaRating && !itemsAvailable && !sellsCigarettes) {
    alert('Please add at least one detail!');
    return;
  }

  try {
    const response = await fetch(`/api/chayakkada/${shopId}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chayakkada_rating: chayakkadaRating,
        items_available: itemsAvailable,
        sells_cigarettes: sellsCigarettes,
        contributed_by: contributorName
      })
    });

    if (!response.ok) {
      throw new Error('Failed to submit contribution');
    }

    alert('Thank you for contributing! Your details have been added.');
    closeDetailModal();

    // Refresh the shop details
    showShopDetail(shopId);
  } catch (error) {
    console.error('Contribution error:', error);
    alert('Failed to submit contribution. Please try again.');
  }
}

// Place search for contribution using backend proxy
function setupPlaceSearch() {
  const searchInput = document.getElementById('place-search');
  const suggestionsDiv = document.getElementById('place-suggestions');

  let debounceTimer;

  searchInput.addEventListener('input', async (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length < 3) {
      suggestionsDiv.innerHTML = '';
      suggestionsDiv.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.predictions && data.predictions.length > 0) {
          displaySuggestions(data.predictions);
        } else {
          suggestionsDiv.innerHTML = '';
          suggestionsDiv.style.display = 'none';
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 300);
  });
}

function displaySuggestions(predictions) {
  const suggestionsDiv = document.getElementById('place-suggestions');

  suggestionsDiv.innerHTML = predictions.map(prediction => `
    <div class="suggestion-item" onclick="selectPlace('${prediction.place_id}')">
      <strong>${prediction.structured_formatting.main_text}</strong><br>
      <small>${prediction.structured_formatting.secondary_text}</small>
    </div>
  `).join('');

  suggestionsDiv.style.display = 'block';
}

async function selectPlace(placeId) {
  try {
    const response = await fetch(`/api/places/details?place_id=${placeId}`);
    const data = await response.json();

    if (data.result) {
      const place = data.result;
      selectedPlace = {
        google_place_id: place.place_id,
        name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        address: place.formatted_address,
        google_rating: place.rating,
        google_photo_references: place.photos ? place.photos.slice(0, 5).map(p => p.photo_reference) : []
      };

      // Display selected place
      document.getElementById('place-suggestions').innerHTML = '';
      document.getElementById('place-suggestions').style.display = 'none';

      const selectedPlaceDiv = document.getElementById('selected-place');
      selectedPlaceDiv.style.display = 'block';

      document.getElementById('place-details').innerHTML = `
        <p><strong>${selectedPlace.name}</strong></p>
        <p>${selectedPlace.address}</p>
        ${selectedPlace.google_rating ? `<p>⭐ ${selectedPlace.google_rating}</p>` : ''}
      `;

      // Show metadata section
      document.getElementById('metadata-section').style.display = 'block';
    }
  } catch (error) {
    console.error('Place details error:', error);
    alert('Failed to get place details');
  }
}

// Rating stars display
document.getElementById('chayakkada-rating')?.addEventListener('input', (e) => {
  const rating = parseFloat(e.target.value);
  const starsDiv = document.getElementById('rating-stars');

  if (rating >= 1 && rating <= 5) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    let stars = '⭐'.repeat(fullStars);
    if (hasHalf && fullStars < 5) stars += '⭐';

    starsDiv.textContent = stars;
  } else {
    starsDiv.textContent = '';
  }
});

// Submit chayakkada
async function submitChayakkada() {
  if (!selectedPlace) {
    alert('Please select a place from Google Maps');
    return;
  }

  const chayakkadaRating = parseFloat(document.getElementById('chayakkada-rating').value) || null;
  const itemsAvailable = document.getElementById('items-available').value.trim() || null;
  const sellsCigarettes = document.getElementById('sells-cigarettes').checked;

  // Use username if logged in, otherwise use provided name or "Omanakkuttan"
  let contributorName = document.getElementById('contributor-name').value.trim();
  if (!contributorName) {
    contributorName = currentUser ? currentUser.username : 'Omanakkuttan';
  }

  try {
    const response = await fetch('/api/chayakkada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...selectedPlace,
        chayakkada_rating: chayakkadaRating,
        items_available: itemsAvailable,
        sells_cigarettes: sellsCigarettes,
        contributed_by: contributorName
      })
    });

    if (!response.ok) {
      throw new Error('Failed to add chayakkada');
    }

    const result = await response.json();
    alert('Chayakkada added successfully! Thank you for contributing!');

    // Reset form
    document.getElementById('place-search').value = '';
    document.getElementById('selected-place').style.display = 'none';
    document.getElementById('metadata-section').style.display = 'none';
    document.getElementById('chayakkada-rating').value = '';
    document.getElementById('items-available').value = '';
    document.getElementById('sells-cigarettes').checked = false;
    document.getElementById('contributor-name').value = '';
    document.getElementById('rating-stars').textContent = '';
    selectedPlace = null;

    // Switch to search view
    showView('search');

  } catch (error) {
    console.error('Submit error:', error);
    alert('Failed to add chayakkada. Please try again.');
  }
}

// Show review form
function showReviewForm(shopId) {
  closeDetailModal();

  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <h2>Write a Review</h2>
    <p class="help-text">Share your experience at this chayakkada!</p>

    <div class="form-group">
      <label for="review-text">Your Review</label>
      <textarea
        id="review-text"
        placeholder="Tell us about your experience..."
        class="textarea"
        rows="5"
        maxlength="1000"
      ></textarea>
      <small style="color: #666;">Maximum 1000 characters</small>
    </div>

    <div class="form-group">
      <label for="reviewer-name">Your Name (optional)</label>
      <input
        type="text"
        id="reviewer-name"
        placeholder="Anonymous"
        class="input"
      >
    </div>

    <button class="btn btn-primary btn-large" onclick="submitReview(${shopId})">
      Submit Review
    </button>
    <button class="btn btn-secondary btn-large" onclick="closeDetailModal()" style="margin-top: 10px;">
      Cancel
    </button>
  `;

  modal.style.display = 'block';
}

// Submit review
async function submitReview(shopId) {
  const reviewText = document.getElementById('review-text').value.trim();
  const reviewerName = document.getElementById('reviewer-name').value.trim() || 'Anonymous';

  if (!reviewText) {
    alert('Please write a review!');
    return;
  }

  try {
    const response = await fetch(`/api/chayakkada/${shopId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review_text: reviewText,
        reviewer_name: reviewerName
      })
    });

    if (!response.ok) {
      throw new Error('Failed to submit review');
    }

    alert('Thank you for your review!');
    closeDetailModal();

    // Refresh the shop details to show new review
    showShopDetail(shopId);
  } catch (error) {
    console.error('Review submission error:', error);
    alert('Failed to submit review. Please try again.');
  }
}

// Location search autocomplete for main search input
function setupLocationSearch() {
  const locationInput = document.getElementById('location-input');
  const suggestionsDiv = document.getElementById('location-suggestions');

  let debounceTimer;

  locationInput.addEventListener('input', async (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    // Clear currentLocation when user types
    if (query !== 'Current Location') {
      currentLocation = null;
    }

    if (query.length < 3) {
      suggestionsDiv.innerHTML = '';
      suggestionsDiv.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.predictions && data.predictions.length > 0) {
          displayLocationSuggestions(data.predictions);
        } else {
          suggestionsDiv.innerHTML = '';
          suggestionsDiv.style.display = 'none';
        }
      } catch (error) {
        console.error('Location autocomplete error:', error);
      }
    }, 300);
  });
}

function displayLocationSuggestions(predictions) {
  const suggestionsDiv = document.getElementById('location-suggestions');

  suggestionsDiv.innerHTML = predictions.map(prediction => `
    <div class="suggestion-item" onclick="selectLocation('${prediction.description.replace(/'/g, "\\'")}')">
      <strong>${prediction.structured_formatting.main_text}</strong><br>
      <small>${prediction.structured_formatting.secondary_text}</small>
    </div>
  `).join('');

  suggestionsDiv.style.display = 'block';
}

function selectLocation(description) {
  document.getElementById('location-input').value = description;
  document.getElementById('location-suggestions').innerHTML = '';
  document.getElementById('location-suggestions').style.display = 'none';
  currentLocation = null; // Will be geocoded when search button is clicked
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('detail-modal');
  const authModal = document.getElementById('auth-modal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
  if (event.target === authModal) {
    closeAuthModal();
  }
}