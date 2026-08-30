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
  pickupAddress: '',
  pickupLat: null,
  pickupLng: null,
  dropAddress: '',
  dropLat: null,
  dropLng: null,
  estimatedDistanceKm: 8.4,
  distanceConfirmed: false,
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

document.addEventListener('DOMContentLoaded', () => {
  initParcelEventListeners();
  calculateFreeParcelFare();
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
   3. EVENT LISTENERS & FREE NATIVE GEOLOCATION (No Paid Map API)
   ========================================================================== */
function initParcelEventListeners() {
  const pickupInput = document.getElementById('pclPickupInput');
  const dropInput = document.getElementById('pclDropInput');

  if (pickupInput) {
    pickupInput.addEventListener('input', () => {
      parcelBookingState.pickupAddress = pickupInput.value.trim();
      recalculateDistance();
      calculateFreeParcelFare();
    });
  }

  if (dropInput) {
    dropInput.addEventListener('input', () => {
      parcelBookingState.dropAddress = dropInput.value.trim();
      recalculateDistance();
      calculateFreeParcelFare();
    });
  }
}

// Browser's Native Geolocation API (100% Free)
function useNativeLocationForPickup() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const btn = document.getElementById('btnDetectGps');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Detecting...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      parcelBookingState.pickupLat = position.coords.latitude;
      parcelBookingState.pickupLng = position.coords.longitude;
      
      const pickupInput = document.getElementById('pclPickupInput');
      if (pickupInput && !pickupInput.value.trim()) {
        pickupInput.value = `Current Location (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`;
        parcelBookingState.pickupAddress = pickupInput.value;
      }
      
      if (btn) btn.innerHTML = '<i class="fa-solid fa-check text-success me-1"></i> Location Set';
      recalculateDistance();
      calculateFreeParcelFare();
    },
    (err) => {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs me-1"></i> Use My Location';
      alert('Could not access your location. Please enter your pickup address manually.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Free Haversine Distance Formula (Straight-line estimation when coords exist)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c * 1.25).toFixed(1)); // 1.25 winding factor for city roads
}

function recalculateDistance() {
  const pickup = document.getElementById('pclPickupInput')?.value.trim() || '';
  const drop = document.getElementById('pclDropInput')?.value.trim() || '';

  if (parcelBookingState.pickupLat && parcelBookingState.dropLat) {
    parcelBookingState.estimatedDistanceKm = calculateHaversineDistance(
      parcelBookingState.pickupLat, parcelBookingState.pickupLng,
      parcelBookingState.dropLat, parcelBookingState.dropLng
    );
    parcelBookingState.distanceConfirmed = true;
  } else if (pickup && drop) {
    // Intelligent heuristic for Jaipur / common local city routes
    if (pickup.toLowerCase().includes('mansarovar') && drop.toLowerCase().includes('vaishali')) {
      parcelBookingState.estimatedDistanceKm = 8.4;
    } else if (pickup.toLowerCase().includes('ajmer') && drop.toLowerCase().includes('delhi')) {
      parcelBookingState.estimatedDistanceKm = 274;
    } else {
      parcelBookingState.estimatedDistanceKm = 8.0;
    }
    parcelBookingState.distanceConfirmed = false;
  }

  const distDisplay = document.getElementById('pclDistanceDisplay');
  if (distDisplay) {
    distDisplay.innerHTML = `<i class="fa-solid fa-route me-1"></i> Estimated Distance: <strong>${parcelBookingState.estimatedDistanceKm} KM</strong> <span class="badge bg-secondary-subtle text-secondary ms-1" style="font-size: 0.7rem;">To be confirmed by Rudraksha team</span>`;
  }
}

/* ==========================================================================
   4. PARCEL SELECTION & AUTOMATIC VEHICLE RECOMMENDATION
   ========================================================================== */
function selectParcelType(typeText, el) {
  document.querySelectorAll('.parcel-type-chips .parcel-chip-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  parcelBookingState.parcelType = typeText;
  autoRecommendVehicle();
  calculateFreeParcelFare();
}

function selectParcelWeight(weightKey, labelText, el) {
  document.querySelectorAll('.parcel-weight-chips .parcel-chip-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  parcelBookingState.weightCategory = weightKey;
  parcelBookingState.weightLabel = labelText;
  autoRecommendVehicle();
  calculateFreeParcelFare();
}

function selectParcelSize(sizeText, el) {
  document.querySelectorAll('.parcel-size-chips .parcel-chip-btn').forEach(btn => btn.classList.remove('active'));
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

  // Update cards in UI
  document.querySelectorAll('.parcel-veh-card').forEach(card => {
    card.classList.remove('active', 'recommended');
    const badge = card.querySelector('.parcel-veh-badge');
    if (badge) badge.style.display = 'none';
  });

  const activeCard = document.getElementById(`veh-card-${recommended}`);
  if (activeCard) {
    activeCard.classList.add('active', 'recommended');
    const badge = activeCard.querySelector('.parcel-veh-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerText = 'RECOMMENDED';
    }
  }

  calculateFreeParcelFare();
}

function manuallySelectParcelVehicle(vehKey) {
  parcelBookingState.selectedVehicle = vehKey;
  document.querySelectorAll('.parcel-vehicles-grid .parcel-veh-card').forEach(card => card.classList.remove('active'));
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

  // Selected Vehicle Name
  const vehicleName = VEHICLE_CONFIG[parcelBookingState.selectedVehicle]?.name || 'Bike';

  // Format WhatsApp Click-to-Chat Message (Standard plain WhatsApp API)
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

📏 *Estimated Distance*
• ${parcelBookingState.estimatedDistanceKm} KM

💰 *Estimated Fare Breakdown*
• Base Fare: ₹${fareCalc.baseFare}
• Distance Charge: ₹${fareCalc.distanceCharge}
• Weight Charge: ₹${fareCalc.weightCharge}
• Vehicle Charge: ₹${fareCalc.vehicleCharge}
• Handling Fee: ₹${fareCalc.handlingCharge}
• Total Estimated Fare: *₹${fareCalc.estimatedTotal}*

━━━━━━━━━━━━━━━━━━━━
Please confirm rider availability and final fare.`;

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
    created_at: new Date().toISOString()
  };

  // Attempt backend persistence (non-blocking)
  try {
    fetch(`${PARCEL_API_ENDPOINT}/parcels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    }).catch(() => {});
  } catch {}

  // Save in local storage history
  try {
    const history = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
    history.unshift(bookingPayload);
    localStorage.setItem('rudraksha_parcels_history', JSON.stringify(history));
  } catch {}

  // Open WhatsApp in a new tab
  window.open(whatsappUrl, '_blank');

  // Display Confirmation & Tracking Modal on the Website
  showParcelBookingPreparedModal(bookingPayload, whatsappUrl);
}

function showParcelBookingPreparedModal(booking, whatsappUrl) {
  document.getElementById('pclModalBookingId').innerText = booking.parcel_id;
  document.getElementById('pclModalSender').innerText = `${booking.sender_name} (+91 ${booking.sender_phone})`;
  document.getElementById('pclModalReceiver').innerText = `${booking.receiver_name} (+91 ${booking.receiver_phone})`;
  document.getElementById('pclModalRoute').innerText = `${booking.pickup_address} ➔ ${booking.drop_address}`;
  document.getElementById('pclModalFare').innerText = `₹${booking.total_amount}`;

  // WhatsApp Button
  const btnWa = document.getElementById('btnModalLaunchWhatsApp');
  if (btnWa) btnWa.href = whatsappUrl;

  // Track Button
  const btnTrack = document.getElementById('btnModalTrackParcel');
  if (btnTrack) {
    btnTrack.onclick = () => {
      window.location.href = `track.html?id=${booking.parcel_id}`;
    };
  }

  const modal = new bootstrap.Modal(document.getElementById('parcelRequestPreparedModal'));
  modal.show();
}

function copyParcelBookingId() {
  const idText = document.getElementById('pclModalBookingId')?.innerText;
  if (idText) {
    navigator.clipboard.writeText(idText).then(() => {
      alert(`Booking ID "${idText}" copied to clipboard!`);
    });
  }
}
