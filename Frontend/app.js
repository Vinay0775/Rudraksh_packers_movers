/**
 * Rudraksha Packers & Movers - Enterprise Customer Engine
 * Features:
 * - Leaflet OpenStreetMap Route Distance Engine (OSRM & Nominatim Geocoding)
 * - Browser Geolocation "Use My Current Location"
 * - Multi-Step Relocation Cost Wizard with Dynamic Theming
 * - Phone OTP Verification (Dev Mock & Production SMS ready)
 * - Real-Time Supabase / Express Backend Sync & Telegram Alerts
 * - Customer Live Tracking Portal & Status Stepper
 * - Printable GST-compliant Tax Quotation & Invoice
 */

// Global State
let currentStep = 1;
let selectedVehicleType = 'mini_truck';
let selectedServiceType = 'House Shifting';
let selectedHouseSize = '1bhk';
let itemQuantities = {
  sofa: 1,
  bed: 1,
  dining: 1,
  fridge: 1,
  washing: 1,
  boxes: 10
};
let appliedCoupon = null;
let isPhoneVerified = false;
let verifiedPhoneNumber = '';
let otpCountdownInterval = null;
let currentTrackedBooking = null;

// Dedicated Vehicle Fleet Config
const vehicleConfig = {
  'mini_truck': { name: 'Tata Ace / Mini (1.5 Ton)', basePrice: 2500, perKmRate: 35, icon: 'fa-truck-pickup', cap: 'Up to 1 BHK / Studio' },
  'tempo_14ft': { name: '14ft Tempo / Eicher (3.5 Ton)', basePrice: 3500, perKmRate: 45, icon: 'fa-truck', cap: 'Ideal for 1-2 BHK' },
  'truck_19ft': { name: '19ft Container Truck (7 Ton)', basePrice: 5500, perKmRate: 65, icon: 'fa-truck-moving', cap: '3+ BHK / Large Moving' },
  'bike': { name: 'Bike Transport Carrier', basePrice: 1500, perKmRate: 15, icon: 'fa-motorcycle', cap: 'Two-Wheeler Carrier' },
  'car': { name: 'Closed Car Carrier', basePrice: 4500, perKmRate: 35, icon: 'fa-car-side', cap: 'Hydraulic Car Carrier' }
};

// Map & Route Coordinates
let leafletMap = null;
let pickupMarker = null;
let dropMarker = null;
let routePolyline = null;
let pickupCoords = null; // [lat, lng]
let dropCoords = null;   // [lat, lng]

const BOOKING_API_URL = 'http://localhost:3000/api';

// Default Rate Configuration
let ratesConfig = {
  baseRate: 2500,
  perKmRate: 40,
  floorNoLiftRate: 300,
  houseSizeRates: {
    '1rk': 0,
    '1bhk': 1000,
    '2bhk': 2500,
    '3bhk': 4500,
    'villa': 7500
  },
  itemRates: {
    sofa: 400,
    bed: 500,
    dining: 400,
    fridge: 300,
    washing: 300,
    boxes: 50
  },
  addonRates: {
    bubblePacking: 1500,
    unpacking: 1200,
    insurance: 999,
    vehicleTransport: 2500
  }
};

// Available Coupons Database
let availableCoupons = [
  { code: 'RUDRAKSHA10', type: 'percent', value: 10, minAmount: 3000 },
  { code: 'WELCOME500', type: 'fixed', value: 500, minAmount: 2000 },
  { code: 'FESTIVE15', type: 'percent', value: 15, minAmount: 5000 }
];

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  // Set default shifting date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const shiftingDateInput = document.getElementById('shiftingDate');
  if (shiftingDateInput) shiftingDateInput.value = dateStr;

  // Fetch settings from Backend API / LocalStorage
  await loadBackendData();

  // Initialize Leaflet Map
  initRouteMap();

  // Attach event listeners for live recalculations
  document.getElementById('distanceKm')?.addEventListener('input', recalculateTotal);
  document.getElementById('pickupCity')?.addEventListener('input', () => {
    pickupCoords = null;
    updateSummaryTexts();
  });
  document.getElementById('dropCity')?.addEventListener('input', () => {
    dropCoords = null;
    updateSummaryTexts();
  });
  document.getElementById('shiftingDate')?.addEventListener('change', updateSummaryTexts);

  // Debounced auto-route lookup on input change
  document.getElementById('pickupCity')?.addEventListener('change', () => calculateOSRMRoute(false));
  document.getElementById('dropCity')?.addEventListener('change', () => calculateOSRMRoute(false));

  // Initial Calculation
  recalculateTotal();
  updateSummaryTexts();
});

/* ==========================================================================
   1. MAP & ROUTE ENGINE (OpenStreetMap, Leaflet, Geolocation, OSRM)
   ========================================================================== */

function initRouteMap() {
  const mapEl = document.getElementById('routeMap');
  if (!mapEl || typeof L === 'undefined') return;

  try {
    // Default center at India center (22.5, 78.9) with pan/zoom
    leafletMap = L.map('routeMap').setView([22.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
  } catch (err) {
    console.warn('Leaflet map initialization skipped or map container not ready:', err);
  }
}

/**
 * Smart Geolocation Engine: GPS First -> Automatic IP Geolocation Fallback
 */
async function useCurrentLocation() {
  const statusEl = document.getElementById('routeMapStatus');
  if (statusEl) {
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-primary-custom me-1"></i> Detecting your location...';
  }

  // Helper to apply detected coordinates
  async function applyDetectedCoords(lat, lng, label, isFromGps = false) {
    pickupCoords = [lat, lng];

    if (leafletMap) {
      leafletMap.setView([lat, lng], 13);
      if (pickupMarker) leafletMap.removeLayer(pickupMarker);
      pickupMarker = L.marker([lat, lng]).addTo(leafletMap).bindPopup(`<b>📍 ${label}</b>`).openPopup();
    }

    const pickupInput = document.getElementById('pickupCity');
    if (pickupInput) {
      pickupInput.value = label;
      updateSummaryTexts();
    }

    if (statusEl) {
      if (isFromGps) {
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-success me-1"></i> GPS Detected: <strong>${label}</strong>`;
      } else {
        statusEl.innerHTML = `<i class="fa-solid fa-location-dot text-primary-custom me-1"></i> Network Location: <strong>${label}</strong> <span class="small text-muted">(Allow GPS in browser 🔒 for street-level precision)</span>`;
      }
    }

    // Auto calculate route if drop location is already filled
    const dropVal = document.getElementById('dropCity')?.value.trim();
    if (dropVal) {
      calculateOSRMRoute(false);
    }
  }

  // Fallback: IP-based Geolocation
  async function fallbackToIpLocation() {
    try {
      if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-primary-custom me-1"></i> Detecting network location...';
      
      // Try IP API 1 (ipwho.is)
      let res = await fetch('https://ipwho.is/');
      let data = await res.json();
      
      if (data && data.success && data.latitude && data.longitude) {
        const placeName = [data.city, data.region, data.country].filter(Boolean).join(', ');
        await applyDetectedCoords(data.latitude, data.longitude, placeName || 'Current Location', false);
        return;
      }

      // Try IP API 2 (ipapi.co)
      res = await fetch('https://ipapi.co/json/');
      data = await res.json();
      if (data && data.latitude && data.longitude) {
        const placeName = [data.city, data.region].filter(Boolean).join(', ');
        await applyDetectedCoords(data.latitude, data.longitude, placeName || 'Current Location', false);
        return;
      }
      
      throw new Error('IP detection exhausted');
    } catch (ipErr) {
      console.warn('IP Geolocation fallback error:', ipErr);
      if (statusEl) {
        statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation text-warning me-1"></i> Location permission blocked. Please type your city manually or allow GPS in address bar 🔒.';
      }
    }
  }

  // Step 1: Check if browser supports GPS
  if (!navigator.geolocation) {
    await fallbackToIpLocation();
    return;
  }

  // Step 2: Try HTML5 Browser GPS with 6 second timeout
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        let address = '';
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.neighbourhood || addr.suburb || '';
          const city = addr.city || addr.town || addr.county || addr.state_district || '';
          const state = addr.state || '';
          address = [road, city, state].filter(Boolean).join(', ');
        }
        if (!address && data && data.display_name) {
          address = data.display_name.split(',').slice(0, 3).join(',');
        }
        await applyDetectedCoords(lat, lng, address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, true);
      } catch (e) {
        await applyDetectedCoords(lat, lng, `Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`, true);
      }
    },
    async (error) => {
      console.warn('GPS Error code:', error.code, error.message);
      // Seamlessly switch to network IP geolocation instead of failing
      await fallbackToIpLocation();
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
  );
}

/**
 * Free OSRM Road Distance & Routing Engine
 */
async function calculateOSRMRoute(showAlert = true) {
  const pickup = document.getElementById('pickupCity')?.value.trim();
  const drop = document.getElementById('dropCity')?.value.trim();
  const statusEl = document.getElementById('routeMapStatus');
  const distBadge = document.getElementById('routeDistanceCalculated');

  if (!pickup || !drop) {
    if (showAlert) alert('Please enter both Pickup and Drop locations to find route.');
    return;
  }

  if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-primary-custom me-1"></i> Calculating real road distance via OSRM...';

  try {
    // 1. Geocode Pickup if not already coordinates
    let pCoord = pickupCoords;
    if (!pCoord) {
      pCoord = await geocodeAddress(pickup);
      pickupCoords = pCoord;
    }

    // 2. Geocode Drop
    let dCoord = dropCoords;
    if (!dCoord) {
      dCoord = await geocodeAddress(drop);
      dropCoords = dCoord;
    }

    if (!pCoord || !dCoord) {
      if (statusEl) {
        statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation text-warning me-1"></i> Could not pinpoint location. Please check city name (e.g. Delhi, Jaipur, Mumbai).';
      }
      return;
    }

    // 3. Call Free OSRM Routing API (lng,lat order)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pCoord[1]},${pCoord[0]};${dCoord[1]},${dCoord[0]}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.max(1, Math.round(route.distance / 1000));
      const durationMins = Math.round(route.duration / 60);

      // Update distance input and badge
      setDistance(distanceKm);
      if (distBadge) distBadge.innerText = `${distanceKm} KM (${durationMins} mins drive)`;
      if (statusEl) statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-success me-1"></i> Road route found: <strong>${distanceKm} KM</strong> (${durationMins} min drive)`;

      // Draw markers and route on Leaflet map
      if (leafletMap) {
        if (pickupMarker) leafletMap.removeLayer(pickupMarker);
        if (dropMarker) leafletMap.removeLayer(dropMarker);
        if (routePolyline) leafletMap.removeLayer(routePolyline);

        pickupMarker = L.marker(pCoord).addTo(leafletMap).bindPopup(`<b>📍 Pickup:</b> ${pickup}`).openPopup();
        dropMarker = L.marker(dCoord).addTo(leafletMap).bindPopup(`<b>🏁 Drop:</b> ${drop}`);

        const routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        routePolyline = L.polyline(routeCoords, { color: '#f97316', weight: 5, opacity: 0.85 }).addTo(leafletMap);

        leafletMap.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });
      }
    } else {
      throw new Error('No driving route found between these points.');
    }
  } catch (err) {
    console.warn('OSRM routing fallback:', err);
    if (statusEl) statusEl.innerHTML = `<i class="fa-solid fa-circle-info text-secondary me-1"></i> Approx estimate mode active.`;
  }
}

async function geocodeAddress(query) {
  if (!query || !query.trim()) return null;
  const cleanQuery = query.trim();

  // 1. Nominatim with clean query in India
  try {
    const encoded = encodeURIComponent(cleanQuery + ', India');
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&limit=1`);
    const results = await res.json();
    if (results && results.length > 0) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    }
  } catch (e) {
    console.warn('Nominatim geocode primary failed:', e);
  }

  // 2. Try searching without adding ', India'
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1`);
    const results = await res.json();
    if (results && results.length > 0) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    }
  } catch (e) {
    console.warn('Nominatim fallback failed:', e);
  }

  // 3. Photon Komoot API fallback
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      return [lat, lng];
    }
  } catch (e) {
    console.warn('Photon fallback failed:', e);
  }

  return null;
}

/* ==========================================================================
   2. OTP VERIFICATION ENGINE
   ========================================================================== */

async function requestPhoneOTP() {
  const phoneInput = document.getElementById('custPhone');
  const phone = phoneInput?.value.replace(/\D/g, '');

  if (!phone || phone.length < 10) {
    alert('Please enter a valid 10-digit WhatsApp mobile number first.');
    if (phoneInput) phoneInput.focus();
    return;
  }

  const btnSend = document.getElementById('btnSendOtp');
  if (btnSend) {
    btnSend.disabled = true;
    btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Sending...';
  }

  try {
    const response = await fetch(`${BOOKING_API_URL}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to send OTP.');
    }

    // Show OTP container
    const otpSection = document.getElementById('otpVerificationSection');
    if (otpSection) otpSection.style.display = 'block';
    
    document.getElementById('otpTargetPhone').innerText = `+91 ${phone}`;
    const statusMsg = document.getElementById('otpStatusMsg');
    if (statusMsg) {
      statusMsg.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> ${data.message}</span>`;
    }

    startOtpTimer(30);
    document.getElementById('otp1')?.focus();
  } catch (err) {
    alert(`Could not send OTP: ${err.message}`);
  } finally {
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerHTML = '<i class="fa-solid fa-rotate me-1"></i> Resend OTP';
    }
  }
}

function startOtpTimer(seconds) {
  clearInterval(otpCountdownInterval);
  let remaining = seconds;
  const timerEl = document.getElementById('otpTimer');
  const resendBtn = document.getElementById('btnResendOtp');

  if (resendBtn) resendBtn.disabled = true;

  otpCountdownInterval = setInterval(() => {
    remaining--;
    if (timerEl) timerEl.innerText = remaining;
    if (remaining <= 0) {
      clearInterval(otpCountdownInterval);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

function moveToNextOtp(current, nextId) {
  if (current.value.length === 1 && nextId) {
    document.getElementById(nextId)?.focus();
  }
}

async function verifyEnteredOTP() {
  const phone = document.getElementById('custPhone')?.value.replace(/\D/g, '');
  const digits = [
    document.getElementById('otp1')?.value || '',
    document.getElementById('otp2')?.value || '',
    document.getElementById('otp3')?.value || '',
    document.getElementById('otp4')?.value || '',
    document.getElementById('otp5')?.value || '',
    document.getElementById('otp6')?.value || ''
  ].join('');

  if (digits.length < 6) {
    alert('Please enter the full 6-digit OTP code.');
    return;
  }

  const statusMsg = document.getElementById('otpStatusMsg');
  if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Verifying OTP...';

  try {
    const response = await fetch(`${BOOKING_API_URL}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: digits })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Invalid OTP code.');
    }

    isPhoneVerified = true;
    verifiedPhoneNumber = phone;

    // Hide OTP box, show Verified Badge
    document.getElementById('otpVerificationSection').style.display = 'none';
    const badge = document.getElementById('phoneVerifiedBadge');
    if (badge) {
      badge.style.display = 'block';
      document.getElementById('verifiedPhoneText').innerText = phone;
    }

    alert('✅ Mobile number verified successfully!');
  } catch (err) {
    if (statusMsg) {
      statusMsg.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-xmark me-1"></i> ${err.message}</span>`;
    }
  }
}

/* ==========================================================================
   3. MULTI-STEP WIZARD & PRICE ENGINE
   ========================================================================== */

function navigateWizard(direction) {
  if (direction === 1 && !validateStep(currentStep)) return;

  const newStep = currentStep + direction;
  if (newStep < 1 || newStep > 5) return;

  // Invalidate Leaflet Map Size when step 1 is opened
  if (newStep === 1 && leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 200);
  }

  // Hide active step content
  document.getElementById(`step${currentStep}`).classList.remove('active');

  // Update stepper indicator
  const nodes = document.querySelectorAll('.step-node');
  nodes.forEach((node) => {
    const stepNum = parseInt(node.getAttribute('data-step'));
    if (stepNum === newStep) {
      node.classList.add('active');
      node.classList.remove('completed');
    } else if (stepNum < newStep) {
      node.classList.remove('active');
      node.classList.add('completed');
    } else {
      node.classList.remove('active', 'completed');
    }
  });

  // Update Progress Line Width
  const progressPercent = ((newStep - 1) / 4) * 100;
  const progressBar = document.getElementById('stepperProgressBar');
  if (progressBar) progressBar.style.width = `${progressPercent}%`;

  // Show new step content
  currentStep = newStep;
  document.getElementById(`step${currentStep}`).classList.add('active');

  // Update Navigation Buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) prevBtn.disabled = currentStep === 1;
  if (nextBtn) {
    if (currentStep === 5) nextBtn.style.display = 'none';
    else nextBtn.style.display = 'inline-block';
  }

  recalculateTotal();
  updateSummaryTexts();
}

function validateStep(step) {
  if (step === 1) {
    const pickup = document.getElementById('pickupCity')?.value.trim();
    const drop = document.getElementById('dropCity')?.value.trim();
    const dist = document.getElementById('distanceKm')?.value;
    const date = document.getElementById('shiftingDate')?.value;

    if (!pickup || !drop) {
      alert('Please enter both Pickup and Drop locations.');
      return false;
    }
    if (!dist || dist <= 0) {
      alert('Please enter a valid moving distance (in KM).');
      return false;
    }
    if (!date) {
      alert('Please choose a preferred shifting date.');
      return false;
    }
  }
  return true;
}

function setDistance(km) {
  const input = document.getElementById('distanceKm');
  if (input) {
    input.value = km;
    recalculateTotal();
  }
}

function selectVehicleType(type) {
  if (!vehicleConfig[type]) return;
  selectedVehicleType = type;

  document.querySelectorAll('.vehicle-select-card').forEach((card) => {
    if (card.getAttribute('data-vehicle') === type) card.classList.add('selected');
    else card.classList.remove('selected');
  });

  // Sync house size recommendations or service presets
  if (type === 'bike') {
    selectedServiceType = 'Bike Transport';
  } else if (type === 'car') {
    selectedServiceType = 'Car Transport';
  } else if (type === 'mini_truck') {
    selectedServiceType = 'Tata Ace / Mini Truck on Rent';
  } else if (type === 'tempo_14ft') {
    selectedServiceType = '14ft Tempo Shifting';
  } else if (type === 'truck_19ft') {
    selectedServiceType = '19ft Large Container Shifting';
  }

  recalculateTotal();
  updateSummaryTexts();
}

function setServiceCategory(serviceCategory) {
  selectedServiceType = serviceCategory;
  const lower = String(serviceCategory || '').toLowerCase();

  if (lower.includes('bike')) {
    selectVehicleType('bike');
  } else if (lower.includes('car')) {
    selectVehicleType('car');
  } else if (lower.includes('tempo') || lower.includes('truck')) {
    selectVehicleType('tempo_14ft');
  } else if (lower.includes('office') || lower.includes('international') || lower.includes('warehouse')) {
    selectVehicleType('truck_19ft');
  } else {
    selectVehicleType('mini_truck');
  }

  const calcSection = document.getElementById('calculator');
  if (calcSection) {
    calcSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function scrollToCalculatorWithService(serviceCategory) {
  setServiceCategory(serviceCategory);
}

function selectHouseSize(size) {
  selectedHouseSize = size;
  document.querySelectorAll('.house-size-card').forEach((card) => {
    if (card.getAttribute('data-size') === size) card.classList.add('selected');
    else card.classList.remove('selected');
  });

  if (size === '1rk') itemQuantities = { sofa: 0, bed: 1, dining: 0, fridge: 1, washing: 0, boxes: 5 };
  else if (size === '1bhk') itemQuantities = { sofa: 1, bed: 1, dining: 1, fridge: 1, washing: 1, boxes: 10 };
  else if (size === '2bhk') itemQuantities = { sofa: 1, bed: 2, dining: 1, fridge: 1, washing: 1, boxes: 18 };
  else if (size === '3bhk') itemQuantities = { sofa: 2, bed: 3, dining: 1, fridge: 1, washing: 1, boxes: 25 };
  else if (size === 'villa') itemQuantities = { sofa: 3, bed: 4, dining: 1, fridge: 2, washing: 1, boxes: 40 };

  for (const key in itemQuantities) {
    const el = document.getElementById(`qty_${key}`);
    if (el) el.innerText = itemQuantities[key];
  }

  recalculateTotal();
}

function updateItemQty(itemKey, delta) {
  if (itemQuantities.hasOwnProperty(itemKey)) {
    itemQuantities[itemKey] = Math.max(0, itemQuantities[itemKey] + delta);
    const el = document.getElementById(`qty_${itemKey}`);
    if (el) el.innerText = itemQuantities[itemKey];
    recalculateTotal();
  }
}

function toggleAddon(addonKey) {
  const checkbox = document.getElementById(`addon_${addonKey}`);
  if (checkbox) {
    if (event.target !== checkbox) checkbox.checked = !checkbox.checked;
    const card = checkbox.closest('.addon-card');
    if (card) {
      if (checkbox.checked) card.classList.add('selected');
      else card.classList.remove('selected');
    }
    recalculateTotal();
  }
}

function applyCouponCode() {
  const input = document.getElementById('couponCodeInput');
  const msgEl = document.getElementById('couponStatusMsg');
  if (!input || !msgEl) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    msgEl.innerHTML = '<span class="text-danger">Please enter a coupon code.</span>';
    return;
  }

  const match = availableCoupons.find((c) => c.code.toUpperCase() === code);
  if (match) {
    appliedCoupon = match;
    msgEl.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Coupon <strong>${match.code}</strong> applied!</span>`;
  } else {
    appliedCoupon = null;
    msgEl.innerHTML = '<span class="text-danger"><i class="fa-solid fa-circle-xmark me-1"></i> Invalid promo code.</span>';
  }

  recalculateTotal();
}

function recalculateTotal() {
  const veh = vehicleConfig[selectedVehicleType] || vehicleConfig['mini_truck'];
  const distKm = parseFloat(document.getElementById('distanceKm')?.value || 25);
  const perKmRate = veh.perKmRate || ratesConfig.perKmRate;
  const distanceCost = distKm * perKmRate;
  const houseSizeFee = ratesConfig.houseSizeRates[selectedHouseSize] || 1000;
  const baseVehicleCost = veh.basePrice;

  let inventoryCost = 0;
  for (const key in itemQuantities) {
    inventoryCost += itemQuantities[key] * (ratesConfig.itemRates[key] || 100);
  }

  const pickupFloor = parseInt(document.getElementById('pickupFloor')?.value || 0);
  const pickupLift = document.getElementById('pickupLift')?.checked;
  const dropFloor = parseInt(document.getElementById('dropFloor')?.value || 0);
  const dropLift = document.getElementById('dropLift')?.checked;

  let floorLaborCost = 0;
  if (!pickupLift && pickupFloor > 0) floorLaborCost += pickupFloor * ratesConfig.floorNoLiftRate;
  if (!dropLift && dropFloor > 0) floorLaborCost += dropFloor * ratesConfig.floorNoLiftRate;

  let addonCost = 0;
  if (document.getElementById('addon_bubblePacking')?.checked) addonCost += ratesConfig.addonRates.bubblePacking || 1500;
  if (document.getElementById('addon_unpacking')?.checked) addonCost += ratesConfig.addonRates.unpacking || 1200;
  if (document.getElementById('addon_insurance')?.checked) addonCost += ratesConfig.addonRates.insurance || 999;
  if (document.getElementById('addon_vehicleTransport')?.checked) addonCost += ratesConfig.addonRates.vehicleTransport || 2500;

  const subtotal = baseVehicleCost + distanceCost + houseSizeFee + inventoryCost + floorLaborCost + addonCost;

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') discountAmount = Math.round((subtotal * appliedCoupon.value) / 100);
    else if (appliedCoupon.type === 'fixed') discountAmount = appliedCoupon.value;
  }

  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Update Summary DOM
  document.getElementById('summaryDistKm').innerText = distKm;
  document.getElementById('priceBase').innerText = `₹${(baseVehicleCost + houseSizeFee).toLocaleString('en-IN')}`;
  document.getElementById('priceDistance').innerText = `₹${distanceCost.toLocaleString('en-IN')}`;
  document.getElementById('priceInventory').innerText = `₹${inventoryCost.toLocaleString('en-IN')}`;
  document.getElementById('priceLabor').innerText = `₹${floorLaborCost.toLocaleString('en-IN')}`;
  document.getElementById('priceAddons').innerText = `₹${addonCost.toLocaleString('en-IN')}`;

  const discountRow = document.getElementById('couponDiscountRow');
  if (discountAmount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('appliedCouponName').innerText = appliedCoupon.code;
    document.getElementById('priceDiscount').innerText = `- ₹${discountAmount.toLocaleString('en-IN')}`;
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('priceTotal').innerText = `₹${finalTotal.toLocaleString('en-IN')}`;
}

function updateSummaryTexts() {
  const pickup = document.getElementById('pickupCity')?.value.trim() || 'Not set';
  const drop = document.getElementById('dropCity')?.value.trim() || 'Not set';
  const dist = document.getElementById('distanceKm')?.value || 25;
  const date = document.getElementById('shiftingDate')?.value || 'Not set';
  const veh = vehicleConfig[selectedVehicleType] || vehicleConfig['mini_truck'];

  if (document.getElementById('sumPickup')) document.getElementById('sumPickup').innerText = pickup;
  if (document.getElementById('sumDrop')) document.getElementById('sumDrop').innerText = drop;
  if (document.getElementById('sumDistance')) document.getElementById('sumDistance').innerText = `${dist} KM`;
  if (document.getElementById('sumDate')) document.getElementById('sumDate').innerText = date;
  if (document.getElementById('sumVehicle')) document.getElementById('sumVehicle').innerText = veh.name;

  const houseMap = {
    '1rk': '1 RK Studio',
    '1bhk': '1 BHK Apartment',
    '2bhk': '2 BHK Apartment',
    '3bhk': '3 BHK Apartment',
    'villa': '4+ BHK / Villa'
  };
  if (document.getElementById('sumHouseType')) {
    document.getElementById('sumHouseType').innerText = houseMap[selectedHouseSize] || selectedHouseSize;
  }
}

/* ==========================================================================
   4. BOOKING SUBMISSION & TELEGRAM DISPATCH
   ========================================================================== */

async function processWhatsAppCheckout() {
  const custName = document.getElementById('custName')?.value.trim();
  const custPhone = document.getElementById('custPhone')?.value.trim();
  const custEmail = document.getElementById('custEmail')?.value.trim() || null;

  if (!custName || !custPhone) {
    alert('Please enter your Name and WhatsApp Mobile Number.');
    return;
  }

  if (custPhone.replace(/\D/g, '').length < 10) {
    alert('Please enter a valid 10-digit mobile number.');
    return;
  }

  const pickup = document.getElementById('pickupCity')?.value.trim() || 'Jaipur';
  const drop = document.getElementById('dropCity')?.value.trim() || 'Delhi';
  const dist = parseFloat(document.getElementById('distanceKm')?.value || 25);
  const date = document.getElementById('shiftingDate')?.value || 'Tomorrow';

  const pFloor = document.getElementById('pickupFloor')?.value || 0;
  const pLift = document.getElementById('pickupLift')?.checked;
  const dFloor = document.getElementById('dropFloor')?.value || 0;
  const dLift = document.getElementById('dropLift')?.checked;

  const paymentMode = document.querySelector('input[name="paymentMode"]:checked')?.value || 'cash_on_delivery';

  // Add-ons
  const addons = [];
  if (document.getElementById('addon_bubblePacking')?.checked) addons.push('Premium Bubble Packing');
  if (document.getElementById('addon_unpacking')?.checked) addons.push('Unpacking & Assembly');
  if (document.getElementById('addon_insurance')?.checked) addons.push('Transit Risk Insurance');
  if (document.getElementById('addon_vehicleTransport')?.checked) addons.push('Vehicle Transportation');

  const totalRaw = document.getElementById('priceTotal')?.innerText || '₹0';
  const totalAmount = parseFloat(totalRaw.replace(/[^\d.]/g, '')) || 0;
  const veh = vehicleConfig[selectedVehicleType] || vehicleConfig['mini_truck'];

  // Build Payload
  const bookingPayload = {
    customer_name: custName,
    customer_phone: custPhone,
    customer_email: custEmail,
    pickup_address: pickup,
    pickup_lat: pickupCoords ? pickupCoords[0] : null,
    pickup_lng: pickupCoords ? pickupCoords[1] : null,
    pickup_floor: Number(pFloor),
    pickup_lift: pLift,
    drop_address: drop,
    drop_lat: dropCoords ? dropCoords[0] : null,
    drop_lng: dropCoords ? dropCoords[1] : null,
    drop_floor: Number(dFloor),
    drop_lift: dLift,
    distance_km: dist,
    shifting_date: date,
    service_type: selectedServiceType,
    selected_vehicle: veh.name,
    house_type: selectedHouseSize,
    items: { ...itemQuantities },
    addons: addons,
    coupon_applied: appliedCoupon?.code || null,
    total_amount: totalAmount,
    payment_mode: paymentMode,
    phone_verified: isPhoneVerified
  };

  let createdBooking = null;

  try {
    const apiRes = await fetch(`${BOOKING_API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      createdBooking = data.booking;
    }
  } catch (err) {
    console.warn('Backend API offline, falling back to local session:', err);
  }

  const finalBookingId = createdBooking?.id || `RB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Structured WhatsApp Message
  let msg = `*RUDRAKSHA PACKERS & MOVERS - BOOKING CONFIRMATION*\n`;
  msg += `----------------------------------------\n`;
  msg += `🆔 *Booking ID:* ${finalBookingId}\n`;
  msg += `👤 *Customer:* ${custName} (+91 ${custPhone})\n`;
  msg += `📍 *Route:* ${pickup} ➔ ${drop} (${dist} KM)\n`;
  msg += `📅 *Date:* ${date}\n`;
  msg += `🏠 *House:* ${selectedHouseSize.toUpperCase()}\n`;
  msg += `💰 *Estimate:* ₹${totalAmount.toLocaleString('en-IN')}\n`;
  msg += `💳 *Payment:* ${paymentMode === 'upi_advance' ? 'UPI Advance 10%' : 'Pay on Delivery'}\n`;
  msg += `----------------------------------------\n`;
  msg += `Please confirm my moving slot. Thank you!`;

  // Open WhatsApp in new tab
  const waUrl = `https://wa.me/917296831460?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');

  // Show Success Popup Modal
  showBookingSuccessModal(finalBookingId, createdBooking || { ...bookingPayload, id: finalBookingId });
}

function showBookingSuccessModal(bookingId, bookingData) {
  currentTrackedBooking = bookingData;
  document.getElementById('successBookingId').innerText = bookingId;

  document.getElementById('successTrackBtn').onclick = () => {
    bootstrap.Modal.getInstance(document.getElementById('bookingSuccessModal'))?.hide();
    openTrackingModal(bookingId);
  };

  document.getElementById('successInvoiceBtn').onclick = () => {
    renderTaxInvoice(bookingData);
    const invModal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    invModal.show();
  };

  const modal = new bootstrap.Modal(document.getElementById('bookingSuccessModal'));
  modal.show();
}

/* ==========================================================================
   5. LIVE CUSTOMER TRACKING PORTAL
   ========================================================================== */

function openTrackingModal(prefillId = '') {
  const modal = new bootstrap.Modal(document.getElementById('trackingModal'));
  modal.show();
  if (prefillId) {
    document.getElementById('trackSearchInput').value = prefillId;
    searchBookingTracking();
  }
}

async function searchBookingTracking() {
  const query = document.getElementById('trackSearchInput')?.value.trim();
  const errorEl = document.getElementById('trackSearchError');
  const resultsContainer = document.getElementById('trackResultsContainer');

  if (!query) {
    if (errorEl) {
      errorEl.innerText = 'Please enter your Booking ID or Mobile Number.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (errorEl) errorEl.style.display = 'none';

  try {
    const res = await fetch(`${BOOKING_API_URL}/bookings/track/${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Booking not found.');
    }

    const data = await res.json();
    currentTrackedBooking = data.booking;
    renderTrackingView(data.booking);
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = err.message;
      errorEl.style.display = 'block';
    }
    if (resultsContainer) resultsContainer.style.display = 'none';
  }
}

function renderTrackingView(booking) {
  const container = document.getElementById('trackResultsContainer');
  if (!container) return;

  document.getElementById('trackDisplayId').innerText = booking.id;
  document.getElementById('trackCustName').innerText = booking.customer_name || booking.name || 'Customer';
  document.getElementById('trackPickupText').innerText = booking.pickup_address || booking.pickup;
  document.getElementById('trackDropText').innerText = booking.drop_address || booking.drop;
  document.getElementById('trackDateText').innerText = booking.shifting_date || booking.date;
  document.getElementById('trackDistanceText').innerText = `${booking.distance_km || booking.distanceKm || 25} KM`;
  document.getElementById('trackAmountText').innerText = `₹${(booking.total_amount || 0).toLocaleString('en-IN')}`;

  // Status Stepper Highlighting
  const statuses = ['received', 'reviewing', 'confirmed', 'driver_assigned', 'in_transit', 'delivered'];
  const curStatus = (booking.status || 'received').toLowerCase();
  const curIdx = statuses.indexOf(curStatus) === -1 ? 0 : statuses.indexOf(curStatus);

  statuses.forEach((st, idx) => {
    const node = document.getElementById(`stepNode_${st}`);
    if (node) {
      node.classList.remove('active', 'completed');
      if (idx < curIdx) node.classList.add('completed');
      else if (idx === curIdx) node.classList.add('active');
    }
  });

  // Assigned Driver Card
  const driverCard = document.getElementById('trackDriverCard');
  if (booking.assigned_driver_name) {
    driverCard.style.display = 'flex';
    document.getElementById('trackDriverName').innerText = booking.assigned_driver_name;
    document.getElementById('trackVehicleNo').innerText = booking.assigned_vehicle_no || 'RJ-14 Assigned';
    document.getElementById('trackDriverPhone').innerText = booking.assigned_driver_phone || '-';
    document.getElementById('trackCallDriverBtn').href = `tel:${booking.assigned_driver_phone || ''}`;
  } else {
    driverCard.style.display = 'none';
  }

  container.style.display = 'block';
}

function openInvoiceForTrackedBooking() {
  if (currentTrackedBooking) {
    renderTaxInvoice(currentTrackedBooking);
    const invModal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    invModal.show();
  }
}

function openFeedbackModalFromTracking() {
  if (currentTrackedBooking) {
    document.getElementById('fbBookingId').value = currentTrackedBooking.id;
    document.getElementById('fbCustomerName').value = currentTrackedBooking.customer_name || '';
    const fbModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    fbModal.show();
  }
}

/* ==========================================================================
   6. TAX INVOICE & ESTIMATE GENERATOR
   ========================================================================== */

function previewCurrentInvoice() {
  const custName = document.getElementById('custName')?.value.trim() || 'Valued Customer';
  const custPhone = document.getElementById('custPhone')?.value.trim() || '9876543210';
  const custEmail = document.getElementById('custEmail')?.value.trim() || 'customer@example.com';
  const pickup = document.getElementById('pickupCity')?.value.trim() || 'Jaipur';
  const drop = document.getElementById('dropCity')?.value.trim() || 'Delhi';
  const dist = parseFloat(document.getElementById('distanceKm')?.value || 25);
  const date = document.getElementById('shiftingDate')?.value || 'Upcoming';

  const mockBooking = {
    id: `EST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    customer_name: custName,
    customer_phone: custPhone,
    customer_email: custEmail,
    pickup_address: pickup,
    drop_address: drop,
    distance_km: dist,
    shifting_date: date,
    total_amount: parseFloat(document.getElementById('priceTotal')?.innerText.replace(/[^\d.]/g, '')) || 5700
  };

  renderTaxInvoice(mockBooking);
  const invModal = new bootstrap.Modal(document.getElementById('invoiceModal'));
  invModal.show();
}

function renderTaxInvoice(booking) {
  document.getElementById('invBookingId').innerText = booking.id;
  document.getElementById('invDateToday').innerText = new Date().toLocaleDateString('en-IN');
  document.getElementById('invCustName').innerText = booking.customer_name || booking.name || 'Customer';
  document.getElementById('invCustPhone').innerText = booking.customer_phone || booking.phone || '-';
  document.getElementById('invCustEmail').innerText = booking.customer_email || 'customer@mail.com';
  document.getElementById('invPickup').innerText = booking.pickup_address || booking.pickup || '-';
  document.getElementById('invDrop').innerText = booking.drop_address || booking.drop || '-';
  document.getElementById('invShiftingDate').innerText = booking.shifting_date || booking.date || '-';
  document.getElementById('invDistance').innerText = `${booking.distance_km || 25} KM`;
  document.getElementById('invDistanceKmRow').innerText = booking.distance_km || 25;

  const total = booking.total_amount || 5700;
  document.getElementById('invGrandTotal').innerText = `₹${total.toLocaleString('en-IN')}.00`;
  document.getElementById('invSubtotal').innerText = `₹${total.toLocaleString('en-IN')}.00`;
}

/* ==========================================================================
   7. CUSTOMER FEEDBACK SUBMISSION
   ========================================================================== */

async function submitCustomerFeedback() {
  const bookingId = document.getElementById('fbBookingId').value;
  const name = document.getElementById('fbCustomerName').value;
  const rating = document.getElementById('fbRating').value;
  const review = document.getElementById('fbReview').value;
  const statusMsg = document.getElementById('fbStatusMsg');

  if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Submitting review...';

  try {
    const res = await fetch(`${BOOKING_API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, customer_name: name, rating, review })
    });

    if (!res.ok) throw new Error('Could not submit feedback.');

    if (statusMsg) {
      statusMsg.innerHTML = '<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Thank you! Your feedback has been recorded.</span>';
    }

    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('feedbackModal'))?.hide();
    }, 1500);
  } catch (err) {
    if (statusMsg) statusMsg.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

/* ==========================================================================
   8. BACKEND PERSISTENCE & DATA LOADING
   ========================================================================== */

async function loadBackendData() {
  try {
    const savedTheme = localStorage.getItem('rudraksha_theme_settings');
    if (savedTheme) applyCSSVariables(JSON.parse(savedTheme));

    const savedRates = localStorage.getItem('rudraksha_rates_config');
    if (savedRates) ratesConfig = { ...ratesConfig, ...JSON.parse(savedRates) };
  } catch (err) {
    console.warn('Backend load defaults applied:', err);
  }
}

function applyCSSVariables(theme) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primaryColor) root.style.setProperty('--primary-color', theme.primaryColor);
  if (theme.secondaryColor) root.style.setProperty('--secondary-color', theme.secondaryColor);
  if (theme.accentColor) root.style.setProperty('--accent-color', theme.accentColor);
}

// Background Video Auto-play booster
document.addEventListener('DOMContentLoaded', () => {
  loadBackendData();
  const heroVideo = document.querySelector('.hero-background-video');
  if (heroVideo) {
    heroVideo.muted = true;
    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented immediate playback
        document.addEventListener('click', () => {
          heroVideo.play().catch(() => {});
        }, { once: true });
      });
    }
  }
});
