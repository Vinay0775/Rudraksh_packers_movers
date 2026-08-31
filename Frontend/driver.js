/* ==========================================================================
   DRIVER PARTNER INTERFACE ENGINE v2 | RUDRAKSHA LOGISTICS FLEET
   Phase 2 — Premium UX: Toast Notifications, OTP Bottom Sheet, Profile Setup,
   Auto-refresh Feed, WhatsApp Acceptance, Earnings Tracker
   ========================================================================== */

const isLocalhostDriver = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const DRIVER_API_BASE = isLocalhostDriver ? 'http://localhost:3000/api' : 'https://rudraksha-packers-movers.onrender.com/api';

// Default Rider Profile (loaded from localStorage)
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
let feedAutoRefreshTimer = null;

/* ==========================================================================
   1. INIT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initDriverProfile();
  loadActiveTripFromStorage();
  loadDriverFeed();
  checkUrlDispatchJob();
  initOtpDigitInputs();

  // Auto-refresh job feed every 6 seconds
  feedAutoRefreshTimer = setInterval(() => loadDriverFeed(false), 6000);
});

/* ==========================================================================
   2. RIDER PROFILE
   ========================================================================== */
function initDriverProfile() {
  const saved = localStorage.getItem('rudraksha_current_driver');
  if (saved) {
    try { currentDriver = JSON.parse(saved); } catch {}
  }
  renderNavProfile();
  updateDriverStatsDisplay();
}

function renderNavProfile() {
  const nameEl = document.getElementById('navDriverName');
  const vehEl = document.getElementById('navVehicleInfo');
  if (nameEl) nameEl.innerText = currentDriver.driver_name;
  if (vehEl) vehEl.innerText = `${currentDriver.vehicle_type} • ${currentDriver.vehicle_number}`;
}

function openSetupSheet() {
  const overlay = document.getElementById('setupOverlay');
  if (!overlay) return;
  document.getElementById('setupName').value = currentDriver.driver_name || '';
  document.getElementById('setupPhone').value = currentDriver.driver_phone || '';
  document.getElementById('setupVehicleNo').value = currentDriver.vehicle_number || '';
  document.getElementById('setupVehicleType').value = currentDriver.vehicle_type || '';
  overlay.classList.add('active');
}

function saveRiderProfile() {
  const name = document.getElementById('setupName')?.value.trim();
  const phone = document.getElementById('setupPhone')?.value.trim();
  const vNo = document.getElementById('setupVehicleNo')?.value.trim();
  const vType = document.getElementById('setupVehicleType')?.value.trim();

  if (!name || !phone) {
    showToast('Please enter your name and mobile number.', 'error');
    return;
  }

  currentDriver = {
    id: `drv-${phone.slice(-4)}`,
    driver_name: name,
    driver_phone: phone,
    vehicle_number: vNo || 'RJ-00-GA-0000',
    vehicle_type: vType || 'Bike'
  };
  localStorage.setItem('rudraksha_current_driver', JSON.stringify(currentDriver));

  document.getElementById('setupOverlay').classList.remove('active');
  renderNavProfile();
  showToast(`Profile saved! Welcome, ${name} 👋`, 'success');
}

/* ==========================================================================
   3. STATS DISPLAY
   ========================================================================== */
function updateDriverStatsDisplay() {
  const earnings = localStorage.getItem('rudraksha_driver_earnings') || '1450';
  const trips = localStorage.getItem('rudraksha_driver_trips') || '7';
  const eEl = document.getElementById('statEarnings');
  const tEl = document.getElementById('statTrips');
  if (eEl) eEl.innerText = `₹${Number(earnings).toLocaleString('en-IN')}`;
  if (tEl) tEl.innerText = trips;
}

/* ==========================================================================
   4. STORAGE HELPERS
   ========================================================================== */
function getAllParcelsFromStorage() {
  // Merge from both keys
  let combined = [];
  try {
    const p1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
    const p2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
    const map = new Map();
    [...p1, ...p2].forEach(p => {
      const id = p.parcel_id || p.id;
      if (id && !map.has(id)) map.set(id, p);
    });
    combined = Array.from(map.values());
  } catch {}

  // Seed sample requests only if completely empty
  if (!combined || combined.length === 0) {
    combined = [
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
    saveAllParcelsToStorage(combined);
  }
  return combined;
}

function saveAllParcelsToStorage(list) {
  try {
    localStorage.setItem('rudraksha_parcels', JSON.stringify(list));
    localStorage.setItem('rudraksha_parcels_history', JSON.stringify(list));
  } catch {}
}

/* ==========================================================================
   5. JOB FEED
   ========================================================================== */
function loadDriverFeed(showRefreshAnim = false) {
  const feedList = document.getElementById('driverFeedList');
  const feedCountEl = document.getElementById('feedCount');
  if (!feedList) return;

  if (showRefreshAnim) {
    const btn = document.getElementById('btnRefreshFeed');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) { icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 600); }
    }
  }

  const allParcels = getAllParcelsFromStorage();

  // Available = searching_driver + this rider's accepted (not yet delivered)
  const available = allParcels.filter(p => {
    const st = p.booking_status || p.status || '';
    if (st === 'delivered' || st === 'cancelled') return false;
    if (st === 'searching_driver') return true;
    // Show if this rider accepted it and it's in some active state
    if (['driver_assigned', 'reached_pickup', 'picked_up', 'in_transit', 'out_for_delivery'].includes(st)) {
      return (p.assigned_driver_phone === currentDriver.driver_phone || p.driver_id === currentDriver.id);
    }
    return false;
  });

  if (feedCountEl) feedCountEl.innerText = available.length > 0 ? available.length : '';

  if (available.length === 0) {
    feedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div>
        <div class="empty-title">Scanning for Parcel Jobs...</div>
        <div class="empty-sub">New delivery requests will appear here automatically.</div>
      </div>
    `;
    return;
  }

  feedList.innerHTML = available.map(parcel => buildFeedCard(parcel)).join('');
}

function buildFeedCard(parcel) {
  const pId = parcel.parcel_id || parcel.id;
  const st = parcel.booking_status || parcel.status || 'searching_driver';
  const isMyJob = (parcel.assigned_driver_phone === currentDriver.driver_phone || parcel.driver_id === currentDriver.id);
  const riderEarning = Math.round((parcel.total_amount || 100) * 0.85);
  const timeAgo = getTimeAgo(parcel.created_at);

  let badgeText = '⚡ NEW DELIVERY REQUEST';
  let badgeStyle = '';
  let acceptLabel = '<i class="fa-solid fa-circle-check"></i> Accept Delivery Job';

  if (isMyJob) {
    badgeText = '🔄 YOUR ACCEPTED JOB';
    badgeStyle = 'background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.3);color:#22c55e;';
    acceptLabel = '<i class="fa-solid fa-arrow-right"></i> Continue Delivery';
  }

  return `
    <div class="feed-card${isMyJob ? ' highlighted' : ''}" id="card-${pId}">
      <div class="feed-top">
        <div>
          <span class="feed-badge" style="${badgeStyle}">${badgeText}</span>
          <div class="feed-id">${pId} <span style="font-size:0.68rem;color:#64748b;font-weight:400;">• ${timeAgo}</span></div>
        </div>
        <div>
          <div class="feed-fare">₹${parcel.total_amount || 0}</div>
          <div class="feed-payout">You earn: <strong>₹${riderEarning}</strong></div>
        </div>
      </div>

      <div class="feed-route">
        <div class="feed-route-row">
          <div class="feed-route-dot p"></div>
          <div class="feed-route-text">
            <div class="feed-route-tag">Pickup</div>
            <div class="feed-route-addr">${parcel.pickup_address}</div>
            <div class="feed-route-who">${parcel.sender_name || 'Sender'} • ${parcel.sender_phone || ''}</div>
          </div>
        </div>
        <div class="feed-route-row">
          <div class="feed-route-dot d"></div>
          <div class="feed-route-text">
            <div class="feed-route-tag">Drop</div>
            <div class="feed-route-addr">${parcel.drop_address}</div>
            <div class="feed-route-who">${parcel.receiver_name || 'Receiver'} • ${parcel.receiver_phone || ''}</div>
          </div>
        </div>
      </div>

      <div class="feed-meta">
        <span class="feed-meta-item"><i class="fa-solid fa-box"></i> ${parcel.parcel_type || 'Package'}</span>
        <span class="feed-meta-item"><i class="fa-solid fa-route"></i> ${parcel.distance_km || '?'} km</span>
        <span class="feed-meta-item"><i class="fa-solid fa-credit-card"></i> ${parcel.payment_method || 'COD'}</span>
      </div>

      <div class="feed-actions">
        <button class="btn-decline" onclick="rejectParcelJob('${pId}')">✕ Decline</button>
        <button class="btn-accept" onclick="acceptParcelJob('${pId}')">${acceptLabel}</button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   6. JOB ACCEPT / DECLINE / STATUS
   ========================================================================== */
async function acceptParcelJob(parcelId) {
  const allParcels = getAllParcelsFromStorage();
  const target = allParcels.find(p => (p.parcel_id === parcelId || p.id === parcelId));

  if (!target) { showToast('Delivery request not found.', 'error'); return; }

  // Check if another driver claimed it
  if (target.booking_status === 'driver_assigned' &&
      target.assigned_driver_phone !== currentDriver.driver_phone &&
      target.driver_id !== currentDriver.id) {
    showToast(`Already accepted by another rider (${target.assigned_driver_name || 'Fleet Member'}).`, 'error');
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

  saveAllParcelsToStorage(allParcels);

  currentActiveTrip = target;
  localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(target));

  showToast(`Job #${parcelId} accepted! Proceed to pickup. 🎉`, 'success');
  renderActiveTrip();
  loadDriverFeed();

  // Scroll to active trip
  const atc = document.getElementById('activeTripContainer');
  if (atc) setTimeout(() => atc.scrollIntoView({ behavior: 'smooth' }), 200);

  // Open WhatsApp to notify owner
  const waMsg = `✅ *JOB ACCEPTED*\n\nRider: *${currentDriver.driver_name}*\nPhone: *${currentDriver.driver_phone}*\nVehicle: *${currentDriver.vehicle_number}* (${currentDriver.vehicle_type})\n\nOrder ID: *${parcelId}*\nPickup: ${target.pickup_address}\nDrop: ${target.drop_address}\n\n_Rider is now heading to pickup location._`;
  const waUrl = `https://wa.me/917296831460?text=${encodeURIComponent(waMsg)}`;

  // Small delay so rider sees the toast first
  setTimeout(() => {
    if (confirm(`Send WhatsApp acceptance message to Owner?`)) {
      window.open(waUrl, '_blank');
    }
  }, 500);
}

function rejectParcelJob(parcelId) {
  const card = document.getElementById(`card-${parcelId}`);
  if (card) {
    card.style.transition = 'all 0.25s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(20px)';
    setTimeout(() => card.remove(), 250);
  }
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

    const statusLabels = {
      reached_pickup: '📍 Marked as Reached Pickup!',
      out_for_delivery: '🚀 Marked as Out for Delivery!',
      delivered: '🎉 Delivery Complete!'
    };
    showToast(statusLabels[status] || `Status updated: ${status}`, 'success');
  }
}

function loadActiveTripFromStorage() {
  const saved = localStorage.getItem('rudraksha_driver_active_trip');
  if (saved) {
    try { currentActiveTrip = JSON.parse(saved); renderActiveTrip(); } catch {}
  }
}

/* ==========================================================================
   7. ACTIVE TRIP CARD RENDERER
   ========================================================================== */
function renderActiveTrip() {
  const container = document.getElementById('activeTripContainer');
  if (!container) return;

  if (!currentActiveTrip) { container.innerHTML = ''; return; }

  const p = currentActiveTrip;
  const pId = p.parcel_id || p.id;
  const status = p.booking_status || p.status || 'driver_assigned';

  const pickupNav = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.pickup_address)}`;
  const dropNav = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.drop_address)}`;

  const statusLabels = {
    driver_assigned: { text: 'Driver Assigned — Head to Pickup', color: '#f97316' },
    reached_pickup: { text: 'Reached Pickup — Verify OTP', color: '#fbbf24' },
    picked_up: { text: 'Parcel Picked Up — In Transit', color: '#22c55e' },
    in_transit: { text: 'In Transit — En Route', color: '#22c55e' },
    out_for_delivery: { text: 'Out for Delivery — Verify Delivery OTP', color: '#38bdf8' },
  };
  const stInfo = statusLabels[status] || { text: status.replace(/_/g, ' '), color: '#94a3b8' };

  let actions = '';
  if (status === 'driver_assigned') {
    actions = `
      <div class="action-group">
        <a href="${pickupNav}" target="_blank" class="btn-nav"><i class="fa-solid fa-diamond-turn-right"></i> Navigate to Pickup</a>
        <button class="btn-status" onclick="updateTripStatus('${pId}','reached_pickup')"><i class="fa-solid fa-location-dot me-1"></i> Reached Pickup</button>
      </div>
      <button class="btn-otp" style="width:100%;margin-top:8px;" onclick="openOtpSheet('${pId}','pickup')"><i class="fa-solid fa-key"></i> Enter Pickup OTP</button>
    `;
  } else if (status === 'reached_pickup') {
    actions = `
      <button class="btn-otp" style="width:100%;" onclick="openOtpSheet('${pId}','pickup')"><i class="fa-solid fa-key"></i> Verify Pickup OTP & Start Trip</button>
    `;
  } else if (status === 'picked_up' || status === 'in_transit') {
    actions = `
      <div class="action-group">
        <a href="${dropNav}" target="_blank" class="btn-nav" style="border-color:#38bdf8;color:#38bdf8;"><i class="fa-solid fa-diamond-turn-right"></i> Navigate to Drop</a>
        <button class="btn-status" onclick="updateTripStatus('${pId}','out_for_delivery')"><i class="fa-solid fa-truck-fast me-1"></i> Reached Drop</button>
      </div>
      <button class="btn-otp" style="width:100%;margin-top:8px;" onclick="openOtpSheet('${pId}','delivery')"><i class="fa-solid fa-shield-check"></i> Enter Delivery OTP</button>
    `;
  } else if (status === 'out_for_delivery') {
    actions = `
      <button class="btn-otp" style="width:100%;" onclick="openOtpSheet('${pId}','delivery')"><i class="fa-solid fa-circle-check"></i> Verify Delivery OTP & Complete Trip</button>
    `;
  }

  container.innerHTML = `
    <div class="active-trip-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <span class="active-badge"><span class="pulse"></span> ACTIVE DELIVERY</span>
        <div class="trip-fare">₹${p.total_amount || 0}</div>
      </div>
      <div class="trip-id-label">Trip ID</div>
      <div class="trip-id-val">${pId}</div>
      <span class="trip-status-pill" style="border-color:${stInfo.color}33;color:${stInfo.color};background:${stInfo.color}15;margin-top:8px;display:inline-flex;">
        ${stInfo.text}
      </span>

      <div class="route-info-box">
        <div class="route-row">
          <div class="route-icon pickup"><i class="fa-solid fa-location-dot"></i></div>
          <div>
            <div class="route-label">Pickup</div>
            <div class="route-addr">${p.pickup_address}</div>
            <div class="route-contact">${p.sender_name} • <a href="tel:${p.sender_phone}"><i class="fa-solid fa-phone me-1"></i>${p.sender_phone}</a></div>
          </div>
        </div>
        <div class="route-row">
          <div class="route-icon drop"><i class="fa-solid fa-flag-checkered"></i></div>
          <div>
            <div class="route-label">Drop</div>
            <div class="route-addr">${p.drop_address}</div>
            <div class="route-contact">${p.receiver_name} • <a href="tel:${p.receiver_phone}"><i class="fa-solid fa-phone me-1"></i>${p.receiver_phone}</a></div>
          </div>
        </div>
      </div>

      <div class="meta-pills">
        <span class="meta-pill"><i class="fa-solid fa-box"></i> ${p.parcel_type || 'Package'}</span>
        <span class="meta-pill"><i class="fa-solid fa-route"></i> ${p.distance_km || '?'} km</span>
        <span class="meta-pill"><i class="fa-solid fa-credit-card"></i> ${p.payment_method || 'COD'}</span>
      </div>

      ${actions}
    </div>
  `;
}

/* ==========================================================================
   8. OTP BOTTOM SHEET
   ========================================================================== */
function initOtpDigitInputs() {
  const digits = ['otp1','otp2','otp3','otp4'];
  digits.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(-1);
      if (e.target.value && idx < digits.length - 1) {
        document.getElementById(digits[idx + 1])?.focus();
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        document.getElementById(digits[idx - 1])?.focus();
      }
    });
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      digits.forEach((did, di) => {
        const dEl = document.getElementById(did);
        if (dEl) dEl.value = text[di] || '';
      });
      document.getElementById(digits[Math.min(text.length, 3)])?.focus();
    });
  });
}

function openOtpSheet(parcelId, mode) {
  currentOtpMode = mode;
  currentOtpParcelId = parcelId;

  const overlay = document.getElementById('otpOverlay');
  const title = document.getElementById('otpSheetTitle');
  const sub = document.getElementById('otpSheetSub');
  const label = document.getElementById('btnVerifyLabel');
  const icon = document.getElementById('otpIconRing');

  // Clear digit inputs
  ['otp1','otp2','otp3','otp4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (mode === 'pickup') {
    if (title) title.innerText = 'Enter Pickup OTP';
    if (sub) sub.innerText = 'Ask the sender for the 4-digit secret code to confirm goods handover.';
    if (label) label.innerText = 'Verify Pickup OTP';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-key"></i>';
  } else {
    if (title) title.innerText = 'Enter Delivery OTP';
    if (sub) sub.innerText = 'Ask the receiver for the 4-digit secret code to confirm safe delivery.';
    if (label) label.innerText = 'Verify Delivery OTP';
    if (icon) { icon.innerHTML = '<i class="fa-solid fa-shield-check"></i>'; icon.style.background = 'rgba(34,197,94,0.12)'; icon.style.borderColor = 'rgba(34,197,94,0.3)'; icon.style.color = '#22c55e'; }
  }

  if (overlay) overlay.classList.add('active');
  setTimeout(() => document.getElementById('otp1')?.focus(), 300);
}

function closeOtpSheet() {
  const overlay = document.getElementById('otpOverlay');
  if (overlay) overlay.classList.remove('active');
}

function getOtpValue() {
  return ['otp1','otp2','otp3','otp4'].map(id => document.getElementById(id)?.value || '').join('');
}

function submitOtpVerification() {
  const otp = getOtpValue();

  if (otp.length < 4) {
    showToast('Please enter all 4 digits.', 'error');
    return;
  }

  const allParcels = getAllParcelsFromStorage();
  const target = allParcels.find(p => (p.parcel_id === currentOtpParcelId || p.id === currentOtpParcelId));

  if (!target) { showToast('Order not found.', 'error'); return; }

  const expectedOtp = currentOtpMode === 'pickup'
    ? (target.pickup_otp || '3412')
    : (target.delivery_otp || '7890');

  // Accept correct OTP or universal testing bypass
  if (otp !== expectedOtp && otp !== '1234') {
    showToast(`❌ Wrong OTP (${otp}). Ask customer for correct code.`, 'error');
    // Shake input
    const wrap = document.querySelector('.otp-input-wrap');
    if (wrap) {
      wrap.style.animation = 'none';
      wrap.offsetHeight;
      wrap.style.animation = 'shake 0.4s ease';
    }
    return;
  }

  closeOtpSheet();

  if (currentOtpMode === 'pickup') {
    target.booking_status = 'picked_up';
    target.status = 'picked_up';
    target.pickup_verified_at = new Date().toISOString();
    saveAllParcelsToStorage(allParcels);
    currentActiveTrip = target;
    localStorage.setItem('rudraksha_driver_active_trip', JSON.stringify(target));
    showToast('✅ Pickup OTP Verified! Parcel picked up. Head to drop location.', 'success');
    renderActiveTrip();
    loadDriverFeed();
  } else {
    // Delivery complete
    target.booking_status = 'delivered';
    target.status = 'delivered';
    target.completed_at = new Date().toISOString();
    saveAllParcelsToStorage(allParcels);

    // Update earnings
    const riderShare = Math.round((Number(target.total_amount) || 100) * 0.85);
    const prevEarnings = Number(localStorage.getItem('rudraksha_driver_earnings') || '1450');
    const prevTrips = Number(localStorage.getItem('rudraksha_driver_trips') || '7');
    localStorage.setItem('rudraksha_driver_earnings', String(prevEarnings + riderShare));
    localStorage.setItem('rudraksha_driver_trips', String(prevTrips + 1));

    currentActiveTrip = null;
    localStorage.removeItem('rudraksha_driver_active_trip');
    updateDriverStatsDisplay();
    renderActiveTrip();
    loadDriverFeed();

    showToast(`🎉 Delivery Complete! You earned ₹${riderShare} for this trip.`, 'success');
  }
}

/* ==========================================================================
   9. URL DISPATCH JOB DETECTION (WhatsApp link click)
   ========================================================================== */
function checkUrlDispatchJob() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetJobId = urlParams.get('jobId') || urlParams.get('orderId') || urlParams.get('id');
  if (!targetJobId) return;

  const all = getAllParcelsFromStorage();
  const match = all.find(p => (p.parcel_id === targetJobId || p.id === targetJobId));

  if (match) {
    if (match.booking_status !== 'searching_driver' && match.status !== 'searching_driver') {
      showToast(`Order #${targetJobId} already accepted by ${match.assigned_driver_name || 'another rider'}.`, 'info');
    } else {
      setTimeout(() => {
        const el = document.getElementById(`card-${targetJobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlighted');
          showToast(`📦 Delivery job #${targetJobId} highlighted for you!`, 'info');
        }
      }, 600);
    }
  } else {
    showToast(`Searching for job #${targetJobId}...`, 'info');
  }
}

/* ==========================================================================
   10. TOAST NOTIFICATION SYSTEM
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ==========================================================================
   11. UTILITY
   ========================================================================== */
function getTimeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
