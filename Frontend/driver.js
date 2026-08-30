/* ==========================================================================
   DRIVER PARTNER INTERFACE ENGINE | RUDRAKSHA LOGISTICS FLEET
   ========================================================================== */

const isLocalhostDriver = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PRODUCTION_API_URL_DRIVER = 'https://rudraksha-packers-movers.onrender.com/api';
const DRIVER_API_BASE = isLocalhostDriver ? 'http://localhost:3000/api' : (localStorage.getItem('rudraksha_backend_api_url') || PRODUCTION_API_URL_DRIVER);

const currentDriver = {
  id: 'drv-101',
  driver_name: 'Rajesh Kumar',
  driver_phone: '9876543210',
  vehicle_number: 'RJ-14-GA-1024',
  vehicle_type: 'Tata Ace (1.5 Ton)'
};

let currentActiveTrip = null;
let currentOtpMode = 'pickup'; // 'pickup' or 'delivery'
let currentOtpParcelId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadActiveTripFromStorage();
  loadDriverFeed();
  setInterval(loadDriverFeed, 8000); // Auto refresh new jobs every 8 seconds
});

function loadActiveTripFromStorage() {
  const saved = localStorage.getItem('rudraksha_driver_active_trip');
  if (saved) {
    try {
      currentActiveTrip = JSON.parse(saved);
      renderActiveTrip();
    } catch {}
  }
}

async function loadDriverFeed() {
  const feedList = document.getElementById('driverFeedList');
  if (!feedList) return;

  try {
    const res = await fetch(`${DRIVER_API_BASE}/parcels`);
    if (res.ok) {
      const data = await res.json();
      const available = (data.parcels || []).filter(p => 
        p.booking_status === 'searching_driver' || 
        (p.booking_status === 'driver_assigned' && p.driver_id === currentDriver.id)
      );

      if (available.length === 0) {
        feedList.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="fa-solid fa-satellite-dish fa-2x mb-2 text-secondary"></i><br>
            <strong>No pending parcel requests right now.</strong><br>
            <span class="small">New requests will appear automatically here.</span>
          </div>
        `;
        return;
      }

      feedList.innerHTML = available.map(parcel => `
        <div class="driver-feed-card urgent" id="card-${parcel.parcel_id}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge bg-warning text-dark fw-bold mb-1">NEW PARCEL REQUEST</span>
              <h6 class="fw-bold text-white mb-0">${parcel.parcel_id}</h6>
            </div>
            <div class="trip-fare-badge">₹${parcel.total_amount}</div>
          </div>

          <div class="route-step-indicator">
            <div class="step-line"></div>
            <div class="d-flex flex-column gap-3 w-100">
              <div class="d-flex align-items-start gap-2">
                <div class="step-icon-pickup"><i class="fa-solid fa-location-dot"></i></div>
                <div>
                  <div class="small text-muted" style="font-size: 0.72rem;">PICKUP FROM</div>
                  <strong class="text-white small">${parcel.pickup_address}</strong>
                  <div class="small text-muted">${parcel.sender_name} (+91 ${parcel.sender_phone})</div>
                </div>
              </div>
              <div class="d-flex align-items-start gap-2">
                <div class="step-icon-drop"><i class="fa-solid fa-flag-checkered"></i></div>
                <div>
                  <div class="small text-muted" style="font-size: 0.72rem;">DELIVER TO</div>
                  <strong class="text-white small">${parcel.drop_address}</strong>
                  <div class="small text-muted">${parcel.receiver_name} (+91 ${parcel.receiver_phone})</div>
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center p-2 rounded-3 my-2" style="background: rgba(255,255,255,0.04); font-size: 0.8rem;">
            <span><i class="fa-solid fa-box text-orange me-1"></i> ${parcel.parcel_type}</span>
            <span><i class="fa-solid fa-weight-scale text-primary me-1"></i> ${parcel.weight_category}</span>
            <span><i class="fa-solid fa-route text-success me-1"></i> ${parcel.distance_km} KM</span>
          </div>

          <div class="d-flex gap-2 mt-3">
            <button class="btn-driver-reject" onclick="rejectParcelJob('${parcel.parcel_id}')">Reject</button>
            <button class="btn-driver-accept" onclick="acceptParcelJob('${parcel.parcel_id}')">
              <i class="fa-solid fa-circle-check me-1"></i> Accept Job
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Driver feed load error:', err.message);
  }
}

async function acceptParcelJob(parcelId) {
  try {
    const res = await fetch(`${DRIVER_API_BASE}/parcels/${parcelId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: currentDriver.id,
        driver_name: currentDriver.driver_name,
        driver_phone: currentDriver.driver_phone,
        vehicle_number: currentDriver.vehicle_number,
        vehicle_type: currentDriver.vehicle_type
      })
    });

    let parcel = null;
    if (res.ok) {
      const data = await res.json();
      parcel = data.parcel;
    } else {
      // Fallback
      parcel = {
        parcel_id: parcelId,
        booking_status: 'driver_assigned',
        pickup_address: 'Mansarovar, Jaipur',
        drop_address: 'Vaishali Nagar, Jaipur',
        sender_name: 'Mukesh Sharma',
        sender_phone: '9876543210',
        receiver_name: 'Priya Verma',
        receiver_phone: '9829012345',
        total_amount: 137
      };
    }

    currentActiveTrip = parcel;
    localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(parcel));
    renderActiveTrip();
    loadDriverFeed();
  } catch (err) {
    alert(`Could not accept trip: ${err.message}`);
  }
}

function rejectParcelJob(parcelId) {
  const card = document.getElementById(`card-${parcelId}`);
  if (card) card.remove();
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
        <a href="${pickupNavUrl}" target="_blank" class="btn-driver-nav flex-fill justify-content-center">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate to Pickup
        </a>
        <button class="btn btn-warning fw-bold rounded-3 px-3" onclick="updateTripStatus('${p.parcel_id}', 'reached_pickup')">
          Reached Pickup
        </button>
      </div>
      <button class="btn btn-driver-accept mt-2 w-100" onclick="openOtpModal('${p.parcel_id}', 'pickup')">
        <i class="fa-solid fa-key me-1"></i> Enter Sender's Pickup OTP
      </button>
    `;
  } else if (status === 'reached_pickup') {
    actionButtonsHtml = `
      <button class="btn btn-driver-accept mt-3 w-100 py-3 fs-6" onclick="openOtpModal('${p.parcel_id}', 'pickup')">
        <i class="fa-solid fa-key me-1"></i> Verify Pickup OTP & Pick Up Parcel
      </button>
    `;
  } else if (status === 'picked_up' || status === 'in_transit') {
    actionButtonsHtml = `
      <div class="d-flex gap-2 mt-3">
        <a href="${dropNavUrl}" target="_blank" class="btn-driver-nav flex-fill justify-content-center">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate to Drop
        </a>
        <button class="btn btn-info fw-bold text-dark rounded-3 px-3" onclick="updateTripStatus('${p.parcel_id}', 'out_for_delivery')">
          Reached Destination
        </button>
      </div>
      <button class="btn btn-driver-accept mt-2 w-100" onclick="openOtpModal('${p.parcel_id}', 'delivery')">
        <i class="fa-solid fa-shield-check me-1"></i> Enter Receiver's Delivery OTP
      </button>
    `;
  } else if (status === 'out_for_delivery') {
    actionButtonsHtml = `
      <button class="btn btn-driver-accept mt-3 w-100 py-3 fs-6" onclick="openOtpModal('${p.parcel_id}', 'delivery')">
        <i class="fa-solid fa-circle-check me-1"></i> Verify Delivery OTP & Complete Trip
      </button>
    `;
  }

  container.innerHTML = `
    <div class="driver-feed-card active-trip mb-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-success text-dark fw-extrabold">ACTIVE DELIVERY IN PROGRESS</span>
        <span class="text-white fw-bold">₹${p.total_amount}</span>
      </div>

      <h5 class="fw-bold text-white mb-2">Trip ID: ${p.parcel_id}</h5>
      <div class="small text-muted mb-3">Status: <strong class="text-warning text-uppercase">${status.replace('_', ' ')}</strong></div>

      <div class="p-3 rounded-3 mb-2" style="background: rgba(255,255,255,0.03);">
        <div class="d-flex justify-content-between mb-1">
          <span class="small text-muted">Sender:</span>
          <strong class="text-white small">${p.sender_name} (<a href="tel:${p.sender_phone}" class="text-warning text-decoration-none">${p.sender_phone}</a>)</strong>
        </div>
        <div class="d-flex justify-content-between">
          <span class="small text-muted">Receiver:</span>
          <strong class="text-white small">${p.receiver_name} (<a href="tel:${p.receiver_phone}" class="text-success text-decoration-none">${p.receiver_phone}</a>)</strong>
        </div>
      </div>

      ${actionButtonsHtml}
    </div>
  `;
}

async function updateTripStatus(parcelId, status) {
  try {
    const res = await fetch(`${DRIVER_API_BASE}/parcels/${parcelId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, updated_by: currentDriver.driver_name })
    });

    if (res.ok) {
      const data = await res.json();
      currentActiveTrip = data.parcel;
      localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(data.parcel));
      renderActiveTrip();
    }
  } catch (err) {
    alert(`Status update error: ${err.message}`);
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

async function submitOtpVerification() {
  const input = document.getElementById('inputDriverOtp');
  const otp = input?.value.trim();

  if (!otp || otp.length < 4) {
    alert('Please enter a valid 4-digit OTP.');
    return;
  }

  const endpoint = currentOtpMode === 'pickup' 
    ? `${DRIVER_API_BASE}/parcels/${currentOtpParcelId}/verify-pickup-otp`
    : `${DRIVER_API_BASE}/parcels/${currentOtpParcelId}/verify-delivery-otp`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OTP verification failed');

    // Close modal
    const modalEl = document.getElementById('otpModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (currentOtpMode === 'pickup') {
      alert('✅ Pickup OTP Verified! Parcel is now In Transit.');
      currentActiveTrip = data.parcel;
      localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(data.parcel));
      renderActiveTrip();
    } else {
      alert('🎉 Delivery OTP Verified! Parcel Delivered Successfully. Earnings added to your wallet!');
      currentActiveTrip = null;
      localStorage.removeItem('rudraksha_driver_active_trip');
      renderActiveTrip();
      loadDriverFeed();
    }
  } catch (err) {
    alert(`Verification Error: ${err.message}`);
  }
}
