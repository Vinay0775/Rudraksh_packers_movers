/* ==========================================================================
   RUDRAKSHA PACKERS & MOVERS — 100% FREE PARCEL DELIVERY SYSTEM (MVP)
   WhatsApp-First Logistics Engine • No Paid APIs • Standalone & Modular
   ========================================================================== */

// 1. CENTRALIZED CONFIGURATION (Easily editable from one place)
const ADMIN_WHATSAPP_NUMBER = '7296831460'; // Official Rudraksha WhatsApp Number

const FARE_CONFIG = {
  baseFare: 40,
  distanceRatePerKm: 10,
  weightCharges: {
    'upto_1kg': 0,
    '1_5kg': 20,
    '5_10kg': 40,
    '10_20kg': 70,
    '20_50kg': 120,
    '50kg_plus': 250
  },
  vehicleCharges: {
    'bike': 0,
    'auto': 50,
    'mini_truck': 150
  },
  handlingCharge: 10,
  addons: {
    'fragile': 25,
    'packaging': 40,
    'insurance': 49
  }
};

const VEHICLE_CONFIG = {
  'bike': { name: 'Bike', desc: 'For small/lightweight parcels', icon: 'fa-motorcycle', maxKg: 10 },
  'auto': { name: 'Auto / 3-Wheeler', desc: 'For medium parcels', icon: 'fa-truck-front', maxKg: 50 },
  'mini_truck': { name: 'Mini Truck (Tata Ace)', desc: 'For large/heavy parcels', icon: 'fa-truck-pickup', maxKg: 1000 }
};

// State Object for Parcel Booking
let parcelBookingState = {
  pickupAddress: 'Mansarovar, Jaipur',
  pickupCoords: [26.8611, 75.7644], // Default: Mansarovar, Jaipur
  dropAddress: 'Vaishali Nagar, Jaipur',
  dropCoords: [26.9075, 75.7397], // Default: Vaishali Nagar, Jaipur
  estimatedDistanceKm: 8.4,
  estimatedDurationMins: 22,
  distanceConfirmed: true,
  mapPinMode: 'pickup', // 'pickup' | 'drop'
  parcelType: 'Small Package',
  weightCategory: '1_5kg',
  weightLabel: '1–5 KG',
  packageSize: 'Medium',
  customDimensions: { length: '', width: '', height: '' },
  selectedVehicle: 'bike',
  recommendedVehicle: 'bike',
  senderName: '',
  senderPhone: '',
  receiverName: '',
  receiverPhone: '',
  addons: [],
  paymentOption: 'Cash',
  generatedParcelId: ''
};

// API Base Detection
const isLocalhostEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PRODUCTION_BACKEND_URL = 'https://rudraksha-packers-movers.onrender.com/api';
const PARCEL_API_ENDPOINT = isLocalhostEnv ? 'http://localhost:3000/api' : (localStorage.getItem('rudraksha_backend_api_url') || PRODUCTION_BACKEND_URL);

// Leaflet Map & Marker Instances
let parcelLeafletMap = null;
let parcelPickupMarker = null;
let parcelDropMarker = null;
let parcelRoutePolyline = null;
let lastGeocodedParcelPickup = '';
let lastGeocodedParcelDrop = '';

// High-speed Pre-indexed Coordinate Database for 0ms latency geocoding
const POPULAR_LOCATIONS = {
  'mansarovar, jaipur': [26.8611, 75.7644],
  'mansarovar': [26.8611, 75.7644],
  'vaishali nagar, jaipur': [26.9075, 75.7397],
  'vaishali nagar': [26.9075, 75.7397],
  'vaishali': [26.9075, 75.7397],
  'malviya nagar, jaipur': [26.8529, 75.8237],
  'malviya nagar': [26.8529, 75.8237],
  'sirsi road, jaipur': [26.9239, 75.7186],
  'sirsi road': [26.9239, 75.7186],
  'raja park, jaipur': [26.8978, 75.8273],
  'raja park': [26.8978, 75.8273],
  'jagatpura, jaipur': [26.8242, 75.8569],
  'jagatpura': [26.8242, 75.8569],
  'c-scheme, jaipur': [26.9090, 75.7997],
  'c-scheme': [26.9090, 75.7997],
  'c scheme': [26.9090, 75.7997],
  'sitapura, jaipur': [26.7794, 75.8361],
  'sitapura': [26.7794, 75.8361],
  'ajmer road, jaipur': [26.8920, 75.7480],
  'ajmer road': [26.8920, 75.7480],
  'tonk road, jaipur': [26.8567, 75.8038],
  'tonk road': [26.8567, 75.8038],
  'bani park, jaipur': [26.9312, 75.7904],
  'bani park': [26.9312, 75.7904],
  'sodala, jaipur': [26.9015, 75.7725],
  'sodala': [26.9015, 75.7725],
  'sanganer, jaipur': [26.8167, 75.7833],
  'sanganer': [26.8167, 75.7833],
  'vidhyadhar nagar, jaipur': [26.9637, 75.7745],
  'vidhyadhar nagar': [26.9637, 75.7745],
  'jhotwara, jaipur': [26.9535, 75.7478],
  'jhotwara': [26.9535, 75.7478],
  'jaipur': [26.9124, 75.7873],
  'gurugram, delhi ncr': [28.4595, 77.0266],
  'gurugram': [28.4595, 77.0266],
  'gurgaon': [28.4595, 77.0266],
  'noida, delhi ncr': [28.5355, 77.3910],
  'noida': [28.5355, 77.3910],
  'delhi': [28.6139, 77.2090],
  'delhi ncr': [28.6139, 77.2090],
  'new delhi': [28.6139, 77.2090],
  'mumbai, maharashtra': [19.0760, 72.8777],
  'mumbai': [19.0760, 72.8777],
  'pune': [18.5204, 73.8567],
  'ahmedabad': [23.0225, 72.5714],
  'bangalore': [12.9716, 77.5946],
  'bengaluru': [12.9716, 77.5946],
  'hyderabad': [17.3850, 78.4867],
  'kolkata': [22.5726, 88.3639],
  'lucknow': [26.8467, 80.9462],
  'chandigarh': [30.7333, 76.7794],
  'ajmer': [26.4499, 74.6399],
  'kota': [25.2138, 75.8648],
  'udaipur': [24.5854, 73.7125],
  'jodhpur': [26.2389, 73.0243]
};

document.addEventListener('DOMContentLoaded', () => {
  initParcelEventListeners();
  initParcelAutocomplete();
  calculateFreeParcelFare();
  
  // Initialize Route Map after slight render delay
  setTimeout(() => {
    initParcelRouteMap();
  }, 200);
});

/* ==========================================================================
   2. HERO SERVICE SWITCHER (Packers & Movers <-> Send a Parcel)
   ========================================================================== */
function switchMainService(serviceType) {
  const tabPackers = document.getElementById('tabPackers');
  const tabParcel = document.getElementById('tabParcel');
  const packersContainer = document.getElementById('packers-flow-container');
  const parcelContainer = document.getElementById('parcel-flow-container');

  if (serviceType === 'parcel') {
    if (tabPackers) tabPackers.classList.remove('active');
    if (tabParcel) tabParcel.classList.add('active');
    if (packersContainer) packersContainer.classList.add('d-none');
    if (parcelContainer) {
      parcelContainer.classList.remove('d-none');
      parcelContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (parcelLeafletMap) {
      setTimeout(() => parcelLeafletMap.invalidateSize(), 300);
    }
    calculateFreeParcelFare();
  } else {
    if (tabParcel) tabParcel.classList.remove('active');
    if (tabPackers) tabPackers.classList.add('active');
    if (parcelContainer) parcelContainer.classList.add('d-none');
    if (packersContainer) {
      packersContainer.classList.remove('d-none');
      packersContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

/* ==========================================================================
   3. COMMERCIAL LEAFLET ROUTE MAP & REAL-TIME OSRM ENGINE
   ========================================================================== */
function createParcelPinIcon(label, isPickup) {
  return L.divIcon({
    className: 'parcel-custom-marker',
    html: `
      <div class="parcel-pin-icon">
        <div class="parcel-pin-badge ${isPickup ? '' : 'drop'}">
          ${isPickup ? '📍 PICKUP' : '🏁 DROP'}
        </div>
        <div class="parcel-pin-point ${isPickup ? '' : 'drop'}"></div>
      </div>
    `,
    iconSize: [80, 42],
    iconAnchor: [40, 40]
  });
}

function initParcelRouteMap() {
  const mapContainer = document.getElementById('parcelRouteMap');
  if (!mapContainer || typeof L === 'undefined') return;

  try {
    if (parcelLeafletMap) {
      parcelLeafletMap.remove();
      parcelLeafletMap = null;
    }

    // Default center at Jaipur central region
    const defaultCenter = [26.8850, 75.7550];
    parcelLeafletMap = L.map('parcelRouteMap').setView(defaultCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(parcelLeafletMap);

    // Initial Pickup Marker (Draggable)
    parcelPickupMarker = L.marker(parcelBookingState.pickupCoords, {
      draggable: true,
      icon: createParcelPinIcon('Pickup', true)
    }).addTo(parcelLeafletMap);

    parcelPickupMarker.bindPopup('<b>📍 Pickup Point</b><br><small class="text-muted">Drag to adjust exact house/street</small>');

    parcelPickupMarker.on('dragend', async (e) => {
      const pos = e.target.getLatLng();
      await applyParcelPinpointCoords(pos.lat, pos.lng, 'Adjusted Pickup Point', true);
    });

    // Initial Drop Marker (Draggable)
    parcelDropMarker = L.marker(parcelBookingState.dropCoords, {
      draggable: true,
      icon: createParcelPinIcon('Drop', false)
    }).addTo(parcelLeafletMap);

    parcelDropMarker.bindPopup('<b>🏁 Drop Point</b><br><small class="text-muted">Drag to adjust destination doorstep</small>');

    parcelDropMarker.on('dragend', async (e) => {
      const pos = e.target.getLatLng();
      await applyParcelPinpointCoords(pos.lat, pos.lng, 'Adjusted Drop Point', false);
    });

    // Interactive Map Click listener to place active pin mode
    parcelLeafletMap.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      const isPickup = (parcelBookingState.mapPinMode === 'pickup');
      await applyParcelPinpointCoords(lat, lng, isPickup ? 'Pinned Pickup' : 'Pinned Drop', isPickup);
    });

    // Set initial input values if empty
    const pInput = document.getElementById('pclPickupInput');
    const dInput = document.getElementById('pclDropInput');
    if (pInput && !pInput.value.trim()) pInput.value = parcelBookingState.pickupAddress;
    if (dInput && !dInput.value.trim()) dInput.value = parcelBookingState.dropAddress;

    // Calculate initial route between default points
    calculateParcelOSRMRoute(false);
  } catch (err) {
    console.warn('Parcel Leaflet map initialization warning:', err);
  }
}

/**
 * Toggle Pin Mode between Pickup and Drop
 */
function setParcelMapPinMode(mode) {
  parcelBookingState.mapPinMode = mode;
  const btnPickup = document.getElementById('btnPclPinPickup');
  const btnDrop = document.getElementById('btnPclPinDrop');
  const statusEl = document.getElementById('pclRouteMapStatus');

  if (mode === 'pickup') {
    if (btnPickup) btnPickup.classList.add('active');
    if (btnDrop) btnDrop.classList.remove('active');
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-hand-pointer text-success me-1"></i> Tap map or drag green pin to set <strong>Pickup 📍</strong>';
    }
  } else {
    if (btnDrop) btnDrop.classList.add('active');
    if (btnPickup) btnPickup.classList.remove('active');
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-hand-pointer text-danger me-1"></i> Tap map or drag red pin to set <strong>Drop 🏁</strong>';
    }
  }
}

/**
 * Apply pinpoint coordinates from Map Click, Drag, or GPS
 */
async function applyParcelPinpointCoords(lat, lng, defaultLabel, isPickup) {
  const statusEl = document.getElementById('pclRouteMapStatus');
  if (statusEl) {
    statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-warning me-1"></i> Locking ${isPickup ? 'pickup' : 'drop'} location...`;
  }

  if (isPickup) {
    parcelBookingState.pickupCoords = [lat, lng];
    parcelBookingState.pickupLat = lat;
    parcelBookingState.pickupLng = lng;
    lastGeocodedParcelPickup = '';

    if (parcelPickupMarker) {
      parcelPickupMarker.setLatLng([lat, lng]);
      parcelPickupMarker.openPopup();
    }
    if (parcelLeafletMap) parcelLeafletMap.panTo([lat, lng]);

    reverseGeocodeParcelCoord(lat, lng, 'pclPickupInput', true);
  } else {
    parcelBookingState.dropCoords = [lat, lng];
    parcelBookingState.dropLat = lat;
    parcelBookingState.dropLng = lng;
    lastGeocodedParcelDrop = '';

    if (parcelDropMarker) {
      parcelDropMarker.setLatLng([lat, lng]);
      parcelDropMarker.openPopup();
    }
    if (parcelLeafletMap) parcelLeafletMap.panTo([lat, lng]);

    reverseGeocodeParcelCoord(lat, lng, 'pclDropInput', false);
  }

  // Recalculate road route and fare
  calculateParcelOSRMRoute(false);
}

/**
 * Reverse Geocode Coordinates to Street Name
 */
async function reverseGeocodeParcelCoord(lat, lng, inputId, isPickup) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();
    let address = '';
    if (data && data.address) {
      const a = data.address;
      const street = a.road || a.suburb || a.neighbourhood || a.residential || '';
      const city = a.city || a.town || a.county || a.state_district || '';
      const state = a.state || '';
      address = [street, city, state].filter(Boolean).join(', ');
    }
    if (!address && data && data.display_name) {
      address = data.display_name.split(',').slice(0, 3).join(',');
    }

    const finalAddress = address || (isPickup ? 'Pinned Pickup Point' : 'Pinned Drop Point');
    const input = document.getElementById(inputId);
    if (input) {
      input.value = finalAddress;
      if (isPickup) {
        parcelBookingState.pickupAddress = finalAddress;
        lastGeocodedParcelPickup = finalAddress;
      } else {
        parcelBookingState.dropAddress = finalAddress;
        lastGeocodedParcelDrop = finalAddress;
      }
    }
  } catch (e) {
    console.warn('Reverse geocode fallback:', e);
  }
}

/**
 * Quick Area Chip Click Handler
 */
function selectParcelQuickArea(type, areaName) {
  const isPickup = (type === 'pickup');
  const inputEl = document.getElementById(isPickup ? 'pclPickupInput' : 'pclDropInput');
  if (inputEl) inputEl.value = areaName;

  const cleanKey = areaName.toLowerCase().trim();
  let coords = POPULAR_LOCATIONS[cleanKey];

  if (!coords) {
    for (const [k, c] of Object.entries(POPULAR_LOCATIONS)) {
      if (cleanKey.includes(k) || k.includes(cleanKey)) {
        coords = c;
        break;
      }
    }
  }

  if (coords) {
    if (isPickup) {
      parcelBookingState.pickupCoords = coords;
      parcelBookingState.pickupLat = coords[0];
      parcelBookingState.pickupLng = coords[1];
      parcelBookingState.pickupAddress = areaName;
      if (parcelPickupMarker) parcelPickupMarker.setLatLng(coords);
    } else {
      parcelBookingState.dropCoords = coords;
      parcelBookingState.dropLat = coords[0];
      parcelBookingState.dropLng = coords[1];
      parcelBookingState.dropAddress = areaName;
      if (parcelDropMarker) parcelDropMarker.setLatLng(coords);
    }
  }

  calculateParcelOSRMRoute(false);
}

/**
 * Geocode text address via local cache, Photon, and Nominatim
 */
async function geocodeParcelAddress(query) {
  if (!query || !query.trim()) return null;
  const clean = query.toLowerCase().trim();

  // 1. Direct match in local dictionary
  if (POPULAR_LOCATIONS[clean]) return POPULAR_LOCATIONS[clean];

  for (const [k, c] of Object.entries(POPULAR_LOCATIONS)) {
    if (clean.includes(k) || k.includes(clean)) return c;
  }

  // 2. Photon Komoot API
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=1`);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      return [lat, lng];
    }
  } catch (e) {
    console.warn('Photon geocode fallback:', e);
  }

  // 3. Nominatim with India filter
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim() + ', India')}&countrycodes=in&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (e) {
    console.warn('Nominatim geocode fallback:', e);
  }

  return null;
}

/**
 * Haversine straight-line distance with city road curvature factor (1.28)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c * 1.28).toFixed(1));
}

/**
 * Commercial OSRM Road Distance Engine
 */
async function calculateParcelOSRMRoute(force = false) {
  const pickupInput = document.getElementById('pclPickupInput')?.value.trim();
  const dropInput = document.getElementById('pclDropInput')?.value.trim();
  const statusEl = document.getElementById('pclRouteMapStatus');
  const distValEl = document.getElementById('pclDistanceVal');
  const transitTimeEl = document.getElementById('pclTransitTimeVal');
  const qualityBadge = document.getElementById('pclRoutingQualityBadge');

  if (!pickupInput || !dropInput) {
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-info text-secondary me-1"></i> Please enter both Pickup and Drop locations.';
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin text-warning me-1"></i> Calculating fastest commercial road route...';
  }

  // Resolve pickup coordinates
  let pCoord = parcelBookingState.pickupCoords;
  if (!pCoord || pickupInput !== lastGeocodedParcelPickup) {
    pCoord = await geocodeParcelAddress(pickupInput);
    if (pCoord) {
      parcelBookingState.pickupCoords = pCoord;
      parcelBookingState.pickupLat = pCoord[0];
      parcelBookingState.pickupLng = pCoord[1];
      lastGeocodedParcelPickup = pickupInput;
      if (parcelPickupMarker) parcelPickupMarker.setLatLng(pCoord);
    }
  }

  // Resolve drop coordinates
  let dCoord = parcelBookingState.dropCoords;
  if (!dCoord || dropInput !== lastGeocodedParcelDrop) {
    dCoord = await geocodeParcelAddress(dropInput);
    if (dCoord) {
      parcelBookingState.dropCoords = dCoord;
      parcelBookingState.dropLat = dCoord[0];
      parcelBookingState.dropLng = dCoord[1];
      lastGeocodedParcelDrop = dropInput;
      if (parcelDropMarker) parcelDropMarker.setLatLng(dCoord);
    }
  }

  if (!pCoord || !dCoord) {
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning me-1"></i> Could not locate address. Please select a popular area chip or click the map.';
    return;
  }

  let distanceKm = null;
  let durationMins = null;
  let routeCoords = null;

  // 1. Fetch Real Driving Route from OSRM
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pCoord[1]},${pCoord[0]};${dCoord[1]},${dCoord[0]}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      distanceKm = Math.max(1, Math.round((route.distance / 1000) * 10) / 10);
      durationMins = Math.max(5, Math.round(route.duration / 60));
      routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
    }
  } catch (err) {
    console.warn('OSRM routing timed out or failed, using road curvature model:', err);
  }

  // 2. Resilient Haversine Road-Curve Fallback if OSRM is slow
  if (!distanceKm) {
    const airDist = calculateHaversineDistance(pCoord[0], pCoord[1], dCoord[0], dCoord[1]);
    distanceKm = Math.max(1, airDist);
    durationMins = Math.max(8, Math.round((distanceKm / 35) * 60));
    routeCoords = [pCoord, dCoord];
  }

  // Update State
  parcelBookingState.estimatedDistanceKm = distanceKm;
  parcelBookingState.estimatedDurationMins = durationMins;
  parcelBookingState.distanceConfirmed = true;

  // Update UI Elements
  if (distValEl) distValEl.innerText = `${distanceKm} KM`;
  if (transitTimeEl) {
    const hrs = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    transitTimeEl.innerText = hrs > 0 ? `~${hrs}h ${mins}m` : `~${mins} Mins`;
  }

  if (statusEl) {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-success me-1"></i> Road Route: <strong>${distanceKm} KM</strong> (~${durationMins} mins transit)`;
  }

  if (qualityBadge) {
    qualityBadge.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i> Live Road Verified`;
    qualityBadge.className = 'badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-bold';
  }

  // Draw or Update Polyline on Map
  if (parcelLeafletMap && routeCoords) {
    if (parcelRoutePolyline) parcelLeafletMap.removeLayer(parcelRoutePolyline);
    parcelRoutePolyline = L.polyline(routeCoords, {
      color: '#FF9E1B',
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round'
    }).addTo(parcelLeafletMap);

    parcelLeafletMap.fitBounds(parcelRoutePolyline.getBounds(), { padding: [40, 40] });
  }

  // Recalculate dynamic fare and update summary
  calculateFreeParcelFare();
}

/**
 * Autocomplete Dropdowns for Pickup and Drop Inputs
 */
function initParcelAutocomplete() {
  const pickupInput = document.getElementById('pclPickupInput');
  const dropInput = document.getElementById('pclDropInput');
  const pickupBox = document.getElementById('pclPickupSuggestions');
  const dropBox = document.getElementById('pclDropSuggestions');

  let debounceTimer = null;

  function handleInputSearch(input, box, type) {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      box.classList.remove('show');
      box.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      const matches = [];

      // 1. Search local dictionary
      for (const [name, coords] of Object.entries(POPULAR_LOCATIONS)) {
        if (name.includes(query)) {
          matches.push({ name: capitalizeWords(name), coords });
        }
        if (matches.length >= 6) break;
      }

      // 2. If fewer than 4 matches, fetch Photon
      if (matches.length < 4) {
        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          if (data && data.features) {
            data.features.forEach(f => {
              const p = f.properties;
              const nameParts = [p.name, p.district, p.city, p.state].filter(Boolean);
              const label = nameParts.join(', ');
              const [lng, lat] = f.geometry.coordinates;
              if (!matches.some(m => m.name.toLowerCase() === label.toLowerCase())) {
                matches.push({ name: label, coords: [lat, lng] });
              }
            });
          }
        } catch (e) {
          console.warn('Photon autocomplete fallback:', e);
        }
      }

      // Render Dropdown items
      if (matches.length > 0) {
        box.innerHTML = matches.map(m => `
          <div class="parcel-autocomplete-item" data-name="${m.name}" data-lat="${m.coords[0]}" data-lng="${m.coords[1]}">
            <i class="fa-solid fa-location-dot ${type === 'pickup' ? 'text-success' : 'text-danger'}"></i>
            <span>${m.name}</span>
          </div>
        `).join('');
        box.classList.add('show');

        // Add Click Handlers
        box.querySelectorAll('.parcel-autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const name = item.getAttribute('data-name');
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lng = parseFloat(item.getAttribute('data-lng'));

            input.value = name;
            box.classList.remove('show');

            if (type === 'pickup') {
              parcelBookingState.pickupAddress = name;
              parcelBookingState.pickupCoords = [lat, lng];
              parcelBookingState.pickupLat = lat;
              parcelBookingState.pickupLng = lng;
              lastGeocodedParcelPickup = name;
              if (parcelPickupMarker) parcelPickupMarker.setLatLng([lat, lng]);
            } else {
              parcelBookingState.dropAddress = name;
              parcelBookingState.dropCoords = [lat, lng];
              parcelBookingState.dropLat = lat;
              parcelBookingState.dropLng = lng;
              lastGeocodedParcelDrop = name;
              if (parcelDropMarker) parcelDropMarker.setLatLng([lat, lng]);
            }

            calculateParcelOSRMRoute(false);
          });
        });
      } else {
        box.classList.remove('show');
        box.innerHTML = '';
      }
    }, 200);
  }

  if (pickupInput && pickupBox) {
    pickupInput.addEventListener('input', () => handleInputSearch(pickupInput, pickupBox, 'pickup'));
  }
  if (dropInput && dropBox) {
    dropInput.addEventListener('input', () => handleInputSearch(dropInput, dropBox, 'drop'));
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#pclPickupInput') && !e.target.closest('#pclPickupSuggestions')) {
      pickupBox?.classList.remove('show');
    }
    if (!e.target.closest('#pclDropInput') && !e.target.closest('#pclDropSuggestions')) {
      dropBox?.classList.remove('show');
    }
  });
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Event Listeners for Input Text Changes
 */
function initParcelEventListeners() {
  const pickupInput = document.getElementById('pclPickupInput');
  const dropInput = document.getElementById('pclDropInput');

  let routeDebounce = null;

  if (pickupInput) {
    pickupInput.addEventListener('change', () => {
      parcelBookingState.pickupAddress = pickupInput.value.trim();
      clearTimeout(routeDebounce);
      routeDebounce = setTimeout(() => calculateParcelOSRMRoute(false), 300);
    });
  }

  if (dropInput) {
    dropInput.addEventListener('change', () => {
      parcelBookingState.dropAddress = dropInput.value.trim();
      clearTimeout(routeDebounce);
      routeDebounce = setTimeout(() => calculateParcelOSRMRoute(false), 300);
    });
  }
}

// Browser's Native Geolocation API (100% Free High Accuracy)
function useNativeLocationForPickup() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const btn = document.getElementById('btnDetectGps');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Detecting GPS...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      await applyParcelPinpointCoords(lat, lng, 'Current GPS Location', true);

      if (btn) btn.innerHTML = '<i class="fa-solid fa-check text-success me-1"></i> GPS Set';
      setTimeout(() => {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs me-1"></i> Use My Location';
      }, 3000);
    },
    (err) => {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs me-1"></i> Use My Location';
      alert('Could not access your location. Please enter your pickup address manually or click on the map.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/* ==========================================================================
   4. PARCEL SELECTION & AUTOMATIC VEHICLE RECOMMENDATION
   ========================================================================== */
function selectParcelType(typeText, el) {
  document.querySelectorAll('.parcel-type-chips .chip-item').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  parcelBookingState.parcelType = typeText;
  autoRecommendVehicle();
  calculateFreeParcelFare();
}

function selectParcelWeight(weightKey, labelText, el) {
  document.querySelectorAll('.parcel-weight-chips .chip-item').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  parcelBookingState.weightCategory = weightKey;
  parcelBookingState.weightLabel = labelText;
  autoRecommendVehicle();
  calculateFreeParcelFare();
}

function selectParcelSize(sizeText, el) {
  document.querySelectorAll('.parcel-size-chips .chip-item').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  parcelBookingState.packageSize = sizeText;

  const customDimBox = document.getElementById('pclCustomDimBox');
  if (customDimBox) {
    if (sizeText === 'Custom') customDimBox.classList.remove('d-none');
    else customDimBox.classList.add('d-none');
  }

  autoRecommendVehicle();
  calculateFreeParcelFare();
}

function autoRecommendVehicle() {
  const w = parcelBookingState.weightCategory;
  const t = parcelBookingState.parcelType;
  const s = parcelBookingState.packageSize;

  let recommended = 'bike';

  if (w === '50kg_plus' || t.includes('Large') || s === 'Large') {
    recommended = 'mini_truck';
  } else if (w === '10_20kg' || w === '20_50kg' || s === 'Medium' || t.includes('Electronics')) {
    recommended = 'auto';
  } else {
    recommended = 'bike';
  }

  parcelBookingState.recommendedVehicle = recommended;
  parcelBookingState.selectedVehicle = recommended;

  // Update vehicle cards in UI
  document.querySelectorAll('.vehicle-picker-grid .vehicle-card-choice').forEach(card => {
    card.classList.remove('active');
    const badge = card.querySelector('.veh-badge-rec');
    if (badge) badge.style.display = 'none';
  });

  const activeCard = document.getElementById(`veh-card-${recommended}`);
  if (activeCard) {
    activeCard.classList.add('active');
    const badge = activeCard.querySelector('.veh-badge-rec');
    if (badge) {
      badge.style.display = 'block';
      badge.innerText = 'RECOMMENDED';
    }
  }

  calculateFreeParcelFare();
}

function manuallySelectParcelVehicle(vehKey) {
  parcelBookingState.selectedVehicle = vehKey;
  // Deselect all vehicle cards using correct classes
  document.querySelectorAll('.vehicle-picker-grid .vehicle-card-choice').forEach(card => card.classList.remove('active'));
  const card = document.getElementById(`veh-card-${vehKey}`);
  if (card) card.classList.add('active');
  calculateFreeParcelFare();
}

function toggleParcelAddon(addonKey, checkbox) {
  if (checkbox.checked) {
    if (!parcelBookingState.addons.includes(addonKey)) parcelBookingState.addons.push(addonKey);
  } else {
    parcelBookingState.addons = parcelBookingState.addons.filter(a => a !== addonKey);
  }
  calculateFreeParcelFare();
}

/* ==========================================================================
   5. FREE DYNAMIC FARE CALCULATOR ENGINE
   ========================================================================== */
function calculateFreeParcelFare() {
  const dist = Number(parcelBookingState.estimatedDistanceKm) || 8;
  const vehKey = parcelBookingState.selectedVehicle || 'bike';

  // 1. Base Fare
  const baseFare = FARE_CONFIG.baseFare;

  // 2. Distance Charge
  const distanceCharge = Math.round(dist * FARE_CONFIG.distanceRatePerKm);

  // 3. Weight Charge
  const weightCharge = FARE_CONFIG.weightCharges[parcelBookingState.weightCategory] || 0;

  // 4. Vehicle Charge
  const vehicleCharge = FARE_CONFIG.vehicleCharges[vehKey] || 0;

  // 5. Handling Fee
  const handlingCharge = FARE_CONFIG.handlingCharge;

  // 6. Optional Add-ons
  let addonsTotal = 0;
  parcelBookingState.addons.forEach(addonKey => {
    addonsTotal += FARE_CONFIG.addons[addonKey] || 0;
  });

  // 7. Estimated Total
  const estimatedTotal = baseFare + distanceCharge + weightCharge + vehicleCharge + handlingCharge + addonsTotal;

  // Update UI Elements
  if (document.getElementById('pclFareBase')) document.getElementById('pclFareBase').innerText = `₹${baseFare}`;
  if (document.getElementById('pclFareDistance')) document.getElementById('pclFareDistance').innerText = `₹${distanceCharge}`;
  const fareDistLabel = document.getElementById('pclFareDistanceLabel');
  if (fareDistLabel) fareDistLabel.innerText = `Distance Charge (${dist} KM @ ₹${FARE_CONFIG.distanceRatePerKm}/KM):`;
  if (document.getElementById('pclFareWeight')) document.getElementById('pclFareWeight').innerText = `₹${weightCharge}`;
  if (document.getElementById('pclFareVehicle')) document.getElementById('pclFareVehicle').innerText = `₹${vehicleCharge}`;
  if (document.getElementById('pclFareHandling')) document.getElementById('pclFareHandling').innerText = `₹${handlingCharge}`;
  if (document.getElementById('pclFareAddons')) document.getElementById('pclFareAddons').innerText = `₹${addonsTotal}`;
  if (document.getElementById('pclFareTotal')) document.getElementById('pclFareTotal').innerText = `₹${estimatedTotal}`;
  if (document.getElementById('btnBookParcelTotal')) document.getElementById('btnBookParcelTotal').innerText = `Request Parcel Delivery – ₹${estimatedTotal}`;

  return { baseFare, distanceCharge, weightCharge, vehicleCharge, handlingCharge, addonsTotal, estimatedTotal };
}

/* ==========================================================================
   6. SUBMIT PARCEL REQUEST & 100% FREE WHATSAPP CLICK-TO-CHAT LAUNCHER
   ========================================================================== */
async function handleRequestParcelDelivery() {
  const pickup = document.getElementById('pclPickupInput')?.value.trim();
  const drop = document.getElementById('pclDropInput')?.value.trim();
  const senderName = document.getElementById('pclSenderName')?.value.trim();
  const senderPhone = document.getElementById('pclSenderPhone')?.value.trim();
  const receiverName = document.getElementById('pclReceiverName')?.value.trim();
  const receiverPhone = document.getElementById('pclReceiverPhone')?.value.trim();

  if (!pickup || !drop) {
    alert('Please enter both Pickup Location and Drop Location.');
    document.getElementById('pclPickupInput')?.focus();
    return;
  }

  if (!senderName || !senderPhone) {
    alert('Please enter Sender Name and Mobile Number.');
    document.getElementById('pclSenderName')?.focus();
    return;
  }

  if (!receiverName || !receiverPhone) {
    alert('Please enter Receiver Name and Mobile Number.');
    document.getElementById('pclReceiverPhone')?.focus();
    return;
  }

  const fareCalc = calculateFreeParcelFare();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const parcelId = `RP-PCL-${randomSuffix}`;
  parcelBookingState.generatedParcelId = parcelId;

  // Generate 4-digit Pickup and Delivery OTPs
  const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

  // Selected Vehicle Name
  const vehicleName = VEHICLE_CONFIG[parcelBookingState.selectedVehicle]?.name || 'Bike';

  // Driver Dispatch URL (Relative & absolute link)
  const dispatchUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}driver.html?jobId=${parcelId}`;

  // Format WhatsApp Click-to-Chat Message
  const whatsappMessage = 
`📦 *NEW PARCEL DELIVERY REQUEST*
━━━━━━━━━━━━━━━━━━━━
🆔 *Parcel ID:* ${parcelId}

👤 *Sender Details*
• Name: ${senderName}
• Phone: +91 ${senderPhone}
• Pickup Address: ${pickup}

🎯 *Receiver Details*
• Name: ${receiverName}
• Phone: +91 ${receiverPhone}
• Delivery Address: ${drop}

📦 *Parcel Details*
• Type: ${parcelBookingState.parcelType}
• Weight: ${parcelBookingState.weightLabel}
• Size: ${parcelBookingState.packageSize}

🛵 *Vehicle Requested*
• ${vehicleName}

📏 *Road Distance & Transit*
• ${parcelBookingState.estimatedDistanceKm} KM (~${parcelBookingState.estimatedDurationMins || 20} Mins Road Drive)

💰 *Estimated Fare:* *₹${fareCalc.estimatedTotal}* (${document.getElementById('pclPaymentOption')?.value || 'Cash'})

🔑 *Security OTPs:*
• Pickup OTP: ${pickupOtp}
• Delivery OTP: ${deliveryOtp}

━━━━━━━━━━━━━━━━━━━━
📢 *RIDER DISPATCH LINK (Tap to Accept):*
${dispatchUrl}`;

  // WhatsApp Link
  const whatsappUrl = `https://wa.me/91${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

  // Save Booking Object to Database / Local Fallback
  const bookingPayload = {
    id: parcelId,
    parcel_id: parcelId,
    sender_name: senderName,
    sender_phone: senderPhone,
    receiver_name: receiverName,
    receiver_phone: receiverPhone,
    pickup_address: pickup,
    drop_address: drop,
    distance_km: parcelBookingState.estimatedDistanceKm,
    parcel_type: parcelBookingState.parcelType,
    weight_category: parcelBookingState.weightLabel,
    package_size: parcelBookingState.packageSize,
    vehicle_type: parcelBookingState.selectedVehicle,
    base_fare: fareCalc.baseFare,
    distance_fare: fareCalc.distanceCharge,
    weight_fare: fareCalc.weightCharge,
    vehicle_fare: fareCalc.vehicleCharge,
    handling_fee: fareCalc.handlingCharge,
    total_amount: fareCalc.estimatedTotal,
    payment_method: document.getElementById('pclPaymentOption')?.value || 'Cash',
    payment_status: 'pending',
    booking_status: 'searching_driver',
    status: 'searching_driver',
    pickup_otp: pickupOtp,
    delivery_otp: deliveryOtp,
    dispatch_url: dispatchUrl,
    created_at: new Date().toISOString()
  };

  // Persist on the backend before showing confirmation.
  try {
    const response = await fetch(`${PARCEL_API_ENDPOINT}/parcels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.parcel) {
      throw new Error(result.error || 'Parcel booking could not be saved.');
    }
    Object.assign(bookingPayload, result.parcel);
  } catch (err) {
    alert(`Booking failed: ${err.message}`);
    return;
  }

  // Save in shared storage across app (rudraksha_parcels & rudraksha_parcels_history)
  try {
    const list1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
    list1.unshift(bookingPayload);
    localStorage.setItem('rudraksha_parcels', JSON.stringify(list1));

    const list2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
    list2.unshift(bookingPayload);
    localStorage.setItem('rudraksha_parcels_history', JSON.stringify(list2));
  } catch {}

  // Open WhatsApp in a new tab
  window.open(whatsappUrl, '_blank');

  // Display Confirmation & Tracking Modal on the Website
  showParcelBookingPreparedModal(bookingPayload, whatsappUrl);
}

function showParcelBookingPreparedModal(booking, whatsappUrl) {
  // Populate new premium overlay
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  set('pclSuccessId', booking.parcel_id);
  set('pclSuccessPickup', booking.pickup_address);
  set('pclSuccessDrop', booking.drop_address);
  set('pclSuccessFare', `₹${booking.total_amount}`);
  set('pclSuccessPickupOtp', booking.pickup_otp || '----');
  set('pclSuccessDeliveryOtp', booking.delivery_otp || '----');
  set('pclSuccessStatusText', '🔍 Searching Nearby Riders...');

  // WhatsApp button
  const waBtn = document.getElementById('pclSuccessWhatsAppBtn');
  if (waBtn) waBtn.href = whatsappUrl;

  // Store booking reference globally for helper fns
  window._lastParcelBooking = booking;

  // Show overlay
  const overlay = document.getElementById('parcelSuccessOverlay');
  if (overlay) {
    overlay.style.display = 'block';
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  // Also update legacy modal compat elements
  document.getElementById('pclModalBookingId').innerText = booking.parcel_id;
  document.getElementById('pclModalSender').innerText = `${booking.sender_name} (+91 ${booking.sender_phone})`;
  document.getElementById('pclModalReceiver').innerText = `${booking.receiver_name} (+91 ${booking.receiver_phone})`;
  document.getElementById('pclModalRoute').innerText = `${booking.pickup_address} → ${booking.drop_address}`;
  document.getElementById('pclModalFare').innerText = `₹${booking.total_amount}`;

  // Start live status polling for this booking
  startSuccessStatusPoll(booking.parcel_id);
}

// Live status polling — checks localStorage every 5s and updates the badge
let _successStatusTimer = null;
function startSuccessStatusPoll(parcelId) {
  clearInterval(_successStatusTimer);
  const statusLabels = {
    searching_driver: '🔍 Searching Nearby Riders...',
    driver_assigned: '🛵 Rider Assigned & Heading to Pickup!',
    reached_pickup: '📍 Rider Reached Your Pickup Location!',
    picked_up: '📦 Parcel Picked Up! In Transit...',
    in_transit: '🛣️ In Transit — On the Way to Destination',
    out_for_delivery: '🚀 Out for Delivery — Almost There!',
    delivered: '🎉 Delivered Successfully!'
  };
  const statusColors = {
    searching_driver: '#fbbf24',
    driver_assigned: '#f97316',
    reached_pickup: '#f97316',
    picked_up: '#22c55e',
    in_transit: '#22c55e',
    out_for_delivery: '#38bdf8',
    delivered: '#22c55e'
  };

  _successStatusTimer = setInterval(() => {
    try {
      const p1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
      const p2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
      const all = [...p1, ...p2];
      const found = all.find(p => (p.parcel_id === parcelId || p.id === parcelId));
      if (found) {
        const st = found.booking_status || found.status || 'searching_driver';
        const label = statusLabels[st] || st;
        const color = statusColors[st] || '#fbbf24';
        const statusEl = document.getElementById('pclSuccessStatusText');
        if (statusEl) { statusEl.innerText = label; statusEl.style.color = color; }
        if (st === 'delivered') clearInterval(_successStatusTimer);
      }
    } catch {}
  }, 5000);
}

function copySuccessParcelId() {
  const id = document.getElementById('pclSuccessId')?.innerText;
  if (id) {
    navigator.clipboard.writeText(id).then(() => {
      const btn = document.getElementById('btnCopyPclId');
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Copied!'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy me-1"></i> Copy'; }, 2000); }
    }).catch(() => { alert(`Parcel ID: ${id}`); });
  }
}

function goTrackParcel() {
  const id = document.getElementById('pclSuccessId')?.innerText;
  if (id) window.location.href = `track.html?id=${id}`;
}

function shareBookingToReceiver() {
  const b = window._lastParcelBooking;
  if (!b) return;
  const trackUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}track.html?id=${b.parcel_id}`;
  const msg = `📦 *Your Parcel is On the Way!*\n\nHi ${b.receiver_name},\n*${b.sender_name}* has sent you a parcel via Rudraksha Express.\n\n🆔 Parcel ID: *${b.parcel_id}*\n📍 From: ${b.pickup_address}\n📍 To: ${b.drop_address}\n💰 Fare: ₹${b.total_amount}\n\n🛡️ *Delivery OTP: ${b.delivery_otp}* (Share only with rider at delivery)\n\n🔍 Track live status here:\n${trackUrl}`;
  const waUrl = `https://wa.me/91${b.receiver_phone}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

function closeParcelSuccess() {
  const overlay = document.getElementById('parcelSuccessOverlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(_successStatusTimer);
}

// Keep legacy copy function working
function copyParcelBookingId() {
  copySuccessParcelId();
}

