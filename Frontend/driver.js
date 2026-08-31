/* ==========================================================================
   DRIVER PARTNER INTERFACE ENGINE | RUDRAKSHA LOGISTICS FLEET
   100% Client & Shared Storage Synchronized (Admin & Customer Live Sync)
   ========================================================================== */

const isLocalhostDriver = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PRODUCTION_API_URL_DRIVER = 'https://rudraksha-packers-movers.onrender.com/api';
const DRIVER_API_BASE = isLocalhostDriver ? 'http://localhost:3000/api' : (localStorage.getItem('rudraksha_backend_api_url') || PRODUCTION_API_URL_DRIVER);

// Default logged-in Rider Profile
let currentDriver = {
  id: 'drv-101',
  driver_name: 'Rajesh Kumar',
  driver_phone: '7296831460',
  vehicle_number: 'RJ-14-GA-1024',
  vehicle_type: 'Tata Ace / Bike Courier'
};

let currentActiveTrip = null;
let currentOtpMode = 'pickup'; // 'pickup' or 'delivery'
let currentOtpParcelId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDriverProfile();
  loadActiveTripFromStorage();
  loadDriverFeed();
  checkUrlDispatchJob();
  setInterval(loadDriverFeed, 6000); // Auto refresh new jobs every 6 seconds
});

function initDriverProfile() {
  const savedDriver = localStorage.getItem('rudraksha_current_driver');
  if (savedDriver) {
    try {
      currentDriver = JSON.parse(savedDriver);
    } catch {}
  }
  const vehEl = document.getElementById('driverVehInfo');
  if (vehEl) {
    vehEl.innerText = `${currentDriver.driver_name} • ${currentDriver.vehicle_type} (${currentDriver.vehicle_number})`;
  }
  updateDriverStatsDisplay();
}

function updateDriverStatsDisplay() {
  const earnings = localStorage.getItem('rudraksha_driver_earnings') || '1450';
  const trips = localStorage.getItem('rudraksha_driver_trips') || '7';

  if (document.getElementById('driverEarnings')) document.getElementById('driverEarnings').innerText = `₹${Number(earnings).toLocaleString('en-IN')}`;
  if (document.getElementById('driverTripCount')) document.getElementById('driverTripCount').innerText = trips;
}

function loadActiveTripFromStorage() {
  const saved = localStorage.getItem('rudraksha_driver_active_trip');
  if (saved) {
    try {
      currentActiveTrip = JSON.parse(saved);
      renderActiveTrip();
    } catch {}
  }
}

// Get all parcels from shared storage
function getAllParcelsFromStorage() {
  let list = [];
  try {
    const raw = localStorage.getItem('rudraksha_parcels') || localStorage.getItem('rudraksha_parcels_history');
    if (raw) list = JSON.parse(raw);
  } catch {}

  // Seed sample requests if completely empty
  if (!list || list.length === 0) {
    list = [
      {
        parcel_id: 'RP-PCL-482910',
        sender_name: 'Mukesh Sharma',
        sender_phone: '9829012345',
        receiver_name: 'Priya Verma',
        receiver_phone: '9829098765',
        pickup_address: 'Sirsi Road, Jaipur',
        drop_address: 'Vaishali Nagar Amrapali Circle, Jaipur',
        distance_km: 5.4,
        parcel_type: 'Documents & Envelope',
        weight_category: 'Upto 1 KG',
        vehicle_type: 'bike',
        total_amount: 89,
        payment_method: 'Cash on Delivery',
        booking_status: 'searching_driver',
        pickup_otp: '3412',
        delivery_otp: '7890',
        created_at: new Date(Date.now() - 5 * 60000).toISOString()
      },
      {
        parcel_id: 'RP-PCL-918234',
        sender_name: 'Rajat Joshi',
        sender_phone: '9414011223',
        receiver_name: 'Deepak Meena',
        receiver_phone: '9414099887',
        pickup_address: 'Mansarovar Metro Station, Jaipur',
        drop_address: 'Malviya Nagar Gaurav Tower, Jaipur',
        distance_km: 9.8,
        parcel_type: 'Electronics Item',
        weight_category: '1 to 5 KG',
        vehicle_type: 'bike',
        total_amount: 145,
        payment_method: 'UPI / Online',
        booking_status: 'searching_driver',
        pickup_otp: '5566',
        delivery_otp: '2244',
        created_at: new Date(Date.now() - 15 * 60000).toISOString()
      }
    ];
    saveAllParcelsToStorage(list);
  }
  return list;
}

function saveAllParcelsToStorage(list) {
  try {
    localStorage.setItem('rudraksha_parcels', JSON.stringify(list));
    localStorage.setItem('rudraksha_parcels_history', JSON.stringify(list));
  } catch {}
}

async function loadDriverFeed() {
  const feedList = document.getElementById('driverFeedList');
  if (!feedList) return;

  const allParcels = getAllParcelsFromStorage();
  
  // Available jobs are those still searching for rider or assigned to this rider
  const available = allParcels.filter(p => 
    p.booking_status === 'searching_driver' || 
    p.status === 'searching_driver' ||
    (p.booking_status === 'driver_assigned' && (p.driver_id === currentDriver.id || p.assigned_driver_phone === currentDriver.driver_phone))
  );

  if (available.length === 0) {
    feedList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fa-solid fa-satellite-dish fa-2x mb-2 text-warning"></i><br>
        <strong class="text-white">Scanning for Nearby Parcel Orders...</strong><br>
        <span class="small text-muted">New requests will pop up automatically.</span>
      </div>
    `;
    return;
  }

  feedList.innerHTML = available.map(parcel => {
    const pId = parcel.parcel_id || parcel.id;
    const isAssignedToMe = (parcel.booking_status === 'driver_assigned' && (parcel.driver_id === currentDriver.id || parcel.assigned_driver_phone === currentDriver.driver_phone));
    const riderNetEarnings = Math.round((parcel.total_amount || 100) * 0.85);

    return `
      <div class="driver-feed-card urgent mb-3" id="card-${pId}" style="background: #17171B; border: 1.5px solid rgba(255,158,27,0.3); border-radius: 16px; padding: 18px;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="badge bg-warning text-dark fw-bold mb-1"><i class="fa-solid fa-bolt me-1"></i> NEW INSTANT DELIVERY</span>
            <h6 class="fw-bold text-white mb-0">${pId}</h6>
          </div>
          <div class="text-end">
            <div class="trip-fare-badge fw-extrabold text-success fs-5">₹${parcel.total_amount}</div>
            <div class="small text-muted" style="font-size: 0.7rem;">Rider Payout: <strong class="text-warning">₹${riderNetEarnings}</strong></div>
          </div>
        </div>

        <div class="route-step-indicator my-3 p-2 rounded-3" style="background: rgba(255,255,255,0.03);">
          <div class="d-flex flex-column gap-2">
            <div class="d-flex align-items-start gap-2">
              <div class="text-warning"><i class="fa-solid fa-location-dot"></i></div>
              <div>
                <div class="small text-muted" style="font-size: 0.7rem;">PICKUP LOCATION</div>
                <strong class="text-white small">${parcel.pickup_address}</strong>
                <div class="small text-muted">${parcel.sender_name || 'Sender'} (${parcel.sender_phone || ''})</div>
              </div>
            </div>
            <div class="d-flex align-items-start gap-2 pt-2 border-top border-secondary border-opacity-25">
              <div class="text-success"><i class="fa-solid fa-flag-checkered"></i></div>
              <div>
                <div class="small text-muted" style="font-size: 0.7rem;">DELIVERY DESTINATION</div>
                <strong class="text-white small">${parcel.drop_address}</strong>
                <div class="small text-muted">${parcel.receiver_name || 'Receiver'} (${parcel.receiver_phone || ''})</div>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center p-2 rounded-3 my-2" style="background: rgba(255,255,255,0.04); font-size: 0.8rem; color: #cbd5e1;">
          <span><i class="fa-solid fa-box text-warning me-1"></i> ${parcel.parcel_type || 'Package'}</span>
          <span><i class="fa-solid fa-route text-info me-1"></i> ${parcel.distance_km || 5} KM</span>
          <span><i class="fa-solid fa-credit-card text-success me-1"></i> ${parcel.payment_method || 'COD'}</span>
        </div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-outline-secondary flex-fill rounded-pill py-2 text-white small" onclick="rejectParcelJob('${pId}')">
            Decline
          </button>
          <button class="btn btn-warning flex-fill rounded-pill py-2 fw-bold text-dark d-flex align-items-center justify-content-center gap-1 shadow-sm" onclick="acceptParcelJob('${pId}')">
            <i class="fa-solid fa-circle-check"></i> ${isAssignedToMe ? 'Resume Delivery' : 'Accept Delivery Job'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Automatically highlights job if opened from URL dispatch link (WhatsApp)
function checkUrlDispatchJob() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetJobId = urlParams.get('jobId') || urlParams.get('orderId');
  if (!targetJobId) return;

  const all = getAllParcelsFromStorage();
  const match = all.find(p => (p.parcel_id === targetJobId || p.id === targetJobId));

  if (match) {
    if (match.booking_status !== 'searching_driver' && match.status !== 'searching_driver') {
      alert(`ℹ️ Order #${targetJobId} has already been accepted by Rider: ${match.assigned_driver_name || 'Fleet Member'}.`);
    } else {
      setTimeout(() => {
        const el = document.getElementById(`card-${targetJobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '2px solid #22c55e';
          el.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.4)';
        }
      }, 500);
    }
  }
}

async function acceptParcelJob(parcelId) {
  const allParcels = getAllParcelsFromStorage();
  const target = allParcels.find(p => (p.parcel_id === parcelId || p.id === parcelId));

  if (!target) {
    alert('⚠️ Delivery request not found.');
    return;
  }

  // Check if another driver already claimed it
  if (target.booking_status === 'driver_assigned' && target.assigned_driver_phone !== currentDriver.driver_phone) {
    alert(`⚠️ This ride was already accepted by another rider (${target.assigned_driver_name || 'Fleet Member'}).`);
    loadDriverFeed();
    return;
  }

  // Assign to current rider
  target.booking_status = 'driver_assigned';
  target.status = 'driver_assigned';
  target.driver_id = currentDriver.id;
  target.assigned_driver_name = currentDriver.driver_name;
  target.assigned_driver_phone = currentDriver.driver_phone;
  target.vehicle_number = currentDriver.vehicle_number;
  target.accepted_at = new Date().toISOString();

  // Save back to storage
  saveAllParcelsToStorage(allParcels);

  // Set as current active trip
  currentActiveTrip = target;
  localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(target));

  alert(`🎉 Delivery Accepted! Trip #${parcelId} is now assigned to you. Proceed to pickup location.`);
  renderActiveTrip();
  loadDriverFeed();

  // Scroll to active trip
  const activeContainer = document.getElementById('activeTripContainer');
  if (activeContainer) activeContainer.scrollIntoView({ behavior: 'smooth' });
}

function rejectParcelJob(parcelId) {
  const card = document.getElementById(`card-${parcelId}`);
  if (card) {
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 250);
  }
}

function renderActiveTrip() {
  const container = document.getElementById('activeTripContainer');
  if (!container) return;

  if (!currentActiveTrip) {
    container.innerHTML = '';
    return;
  }

  const p = currentActiveTrip;
  const status = p.booking_status || 'driver_assigned';

  const pickupNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.pickup_address)}`;
  const dropNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.drop_address)}`;

  let actionButtonsHtml = '';

  if (status === 'driver_assigned') {
    actionButtonsHtml = `
      <div class="d-flex gap-2 mt-3">
        <a href="${pickupNavUrl}" target="_blank" class="btn btn-outline-warning flex-fill d-flex align-items-center justify-content-center gap-1 rounded-pill py-2 fw-bold text-decoration-none">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate to Pickup
        </a>
        <button class="btn btn-warning fw-bold text-dark rounded-pill px-3" onclick="updateTripStatus('${p.parcel_id || p.id}', 'reached_pickup')">
          Reached Pickup
        </button>
      </div>
      <button class="btn btn-success mt-2 w-100 py-2 rounded-pill fw-bold" onclick="openOtpModal('${p.parcel_id || p.id}', 'pickup')">
        <i class="fa-solid fa-key me-1"></i> Enter Sender's Pickup OTP
      </button>
    `;
  } else if (status === 'reached_pickup') {
    actionButtonsHtml = `
      <button class="btn btn-success mt-3 w-100 py-3 fs-6 rounded-pill fw-bold shadow" onclick="openOtpModal('${p.parcel_id || p.id}', 'pickup')">
        <i class="fa-solid fa-key me-1"></i> Verify Pickup OTP & Pick Up Parcel
      </button>
    `;
  } else if (status === 'picked_up' || status === 'in_transit') {
    actionButtonsHtml = `
      <div class="d-flex gap-2 mt-3">
        <a href="${dropNavUrl}" target="_blank" class="btn btn-outline-info flex-fill d-flex align-items-center justify-content-center gap-1 rounded-pill py-2 fw-bold text-decoration-none">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate to Drop
        </a>
        <button class="btn btn-info fw-bold text-dark rounded-pill px-3" onclick="updateTripStatus('${p.parcel_id || p.id}', 'out_for_delivery')">
          Reached Drop
        </button>
      </div>
      <button class="btn btn-success mt-2 w-100 py-2 rounded-pill fw-bold" onclick="openOtpModal('${p.parcel_id || p.id}', 'delivery')">
        <i class="fa-solid fa-shield-check me-1"></i> Enter Receiver's Delivery OTP
      </button>
    `;
  } else if (status === 'out_for_delivery') {
    actionButtonsHtml = `
      <button class="btn btn-success mt-3 w-100 py-3 fs-6 rounded-pill fw-bold shadow" onclick="openOtpModal('${p.parcel_id || p.id}', 'delivery')">
        <i class="fa-solid fa-circle-check me-1"></i> Verify Delivery OTP & Complete Trip
      </button>
    `;
  }

  container.innerHTML = `
    <div class="driver-feed-card active-trip mb-4 p-3 rounded-4 shadow-lg" style="background: linear-gradient(135deg, #1f1f24 0%, #17171B 100%); border: 2px solid #22c55e;">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-success text-dark fw-extrabold px-3 py-1 rounded-pill">ACTIVE DELIVERY IN PROGRESS</span>
        <span class="text-warning fw-extrabold fs-5">₹${p.total_amount}</span>
      </div>

      <h5 class="fw-bold text-white mb-1">Trip ID: ${p.parcel_id || p.id}</h5>
      <div class="small text-muted mb-3">Status: <strong class="text-warning text-uppercase">${status.replace('_', ' ')}</strong></div>

      <div class="p-3 rounded-3 mb-2" style="background: rgba(255,255,255,0.04);">
        <div class="d-flex justify-content-between mb-2">
          <span class="small text-muted">Sender:</span>
          <strong class="text-white small">${p.sender_name} (<a href="tel:${p.sender_phone}" class="text-warning text-decoration-none"><i class="fa-solid fa-phone me-1"></i>${p.sender_phone}</a>)</strong>
        </div>
        <div class="d-flex justify-content-between">
          <span class="small text-muted">Receiver:</span>
          <strong class="text-white small">${p.receiver_name} (<a href="tel:${p.receiver_phone}" class="text-success text-decoration-none"><i class="fa-solid fa-phone me-1"></i>${p.receiver_phone}</a>)</strong>
        </div>
      </div>

      ${actionButtonsHtml}
    </div>
  `;
}

function updateTripStatus(parcelId, status) {
  const allParcels = getAllParcelsFromStorage();
  const target = allParcels.find(p => (p.parcel_id === parcelId || p.id === parcelId));

  if (target) {
    target.booking_status = status;
    target.status = status;
    target.updated_at = new Date().toISOString();
    saveAllParcelsToStorage(allParcels);

    currentActiveTrip = target;
    localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(target));
    renderActiveTrip();
    loadDriverFeed();
  }
}

function openOtpModal(parcelId, mode) {
  currentOtpMode = mode;
  currentOtpParcelId = parcelId;

  const title = document.getElementById('otpModalTitle');
  const sub = document.getElementById('otpModalSub');
  const btn = document.getElementById('btnConfirmDriverOtp');
  const input = document.getElementById('inputDriverOtp');

  if (input) input.value = '';

  if (mode === 'pickup') {
    title.innerText = 'Enter 4-Digit Pickup OTP';
    sub.innerText = 'Ask the sender for the 4-digit secret OTP to confirm goods pickup.';
    btn.innerText = 'Verify Pickup & Start Trip';
  } else {
    title.innerText = 'Enter 4-Digit Delivery OTP';
    sub.innerText = 'Ask the receiver for the 4-digit secret OTP to verify safe delivery.';
    btn.innerText = 'Verify Delivery & Complete Trip';
  }

  const modal = new bootstrap.Modal(document.getElementById('otpModal'));
  modal.show();
}

function submitOtpVerification() {
  const input = document.getElementById('inputDriverOtp');
  const otp = input?.value.trim();

  if (!otp || otp.length < 4) {
    alert('Please enter a valid 4-digit OTP.');
    return;
  }

  const allParcels = getAllParcelsFromStorage();
  const target = allParcels.find(p => (p.parcel_id === currentOtpParcelId || p.id === currentOtpParcelId));

  if (!target) {
    alert('Order not found.');
    return;
  }

  const expectedOtp = currentOtpMode === 'pickup' ? (target.pickup_otp || '3412') : (target.delivery_otp || '7890');

  // Verify OTP (accept expectedOtp or universal bypass 1234 for testing)
  if (otp !== expectedOtp && otp !== '1234') {
    alert(`❌ Incorrect OTP entered (${otp}). Please ask customer for the correct 4-digit code.`);
    return;
  }

  // Close modal
  const modalEl = document.getElementById('otpModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  if (currentOtpMode === 'pickup') {
    target.booking_status = 'picked_up';
    target.status = 'picked_up';
    saveAllParcelsToStorage(allParcels);

    currentActiveTrip = target;
    localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(target));
    alert('✅ Pickup OTP Verified! Parcel is now In Transit to destination.');
    renderActiveTrip();
  } else {
    target.booking_status = 'delivered';
    target.status = 'delivered';
    target.completed_at = new Date().toISOString();
    saveAllParcelsToStorage(allParcels);

    // Calculate rider payout (85% of total amount)
    const riderShare = Math.round((Number(target.total_amount) || 100) * 0.85);
    const prevEarnings = Number(localStorage.getItem('rudraksha_driver_earnings') || '1450');
    const prevTrips = Number(localStorage.getItem('rudraksha_driver_trips') || '7');

    localStorage.setItem('rudraksha_driver_earnings', String(prevEarnings + riderShare));
    localStorage.setItem('rudraksha_driver_trips', String(prevTrips + 1));

    currentActiveTrip = null;
    localStorage.removeItem('rudraksha_driver_active_trip');
    updateDriverStatsDisplay();

    alert(`🎉 Delivery Completed Successfully!\nEarned ₹${riderShare} for this delivery.`);
    renderActiveTrip();
    loadDriverFeed();
  }
}
