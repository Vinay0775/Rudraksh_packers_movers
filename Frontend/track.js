const API_BASE = 'http://localhost:3000/api';

let currentBooking = null;
let trackMap = null;
let pickupMarker = null;
let dropMarker = null;
let vehicleMarker = null;
let routePolyline = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check URL parameters for direct tracking link (e.g. track.html?id=RB-6DFFD540 or track.html?phone=8619384774)
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('id') || urlParams.get('phone') || urlParams.get('ref') || urlParams.get('b');

  if (queryParam) {
    document.getElementById('trackSearchInput').value = queryParam;
    fetchBookingAndTrack(queryParam);
  } else {
    // Populate sample chips from local storage if available
    loadQuickChips();
  }
});

function loadQuickChips() {
  try {
    const saved = localStorage.getItem('rudraksha_bookings_history');
    if (saved) {
      const list = JSON.parse(saved);
      if (list && list.length > 0) {
        const chipsContainer = document.getElementById('trackerSampleChips');
        chipsContainer.innerHTML = list.slice(0, 3).map(b => `
          <button type="button" class="sample-chip" onclick="quickFillTrack('${b.id}')">${b.id}</button>
        `).join('');
      }
    }
  } catch {}
}

function quickFillTrack(val) {
  document.getElementById('trackSearchInput').value = val;
  fetchBookingAndTrack(val);
}

function handleTrackingSearch() {
  const query = document.getElementById('trackSearchInput')?.value.trim();
  if (!query) return;
  fetchBookingAndTrack(query);
}

async function fetchBookingAndTrack(query) {
  const loadingEl = document.getElementById('trackerLoading');
  const notFoundEl = document.getElementById('trackerNotFound');
  const contentEl = document.getElementById('trackerContent');
  const btnSubmit = document.getElementById('btnTrackSubmit');

  if (loadingEl) loadingEl.classList.remove('d-none');
  if (notFoundEl) notFoundEl.classList.add('d-none');
  if (contentEl) contentEl.classList.add('d-none');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Tracking...';
  }

  try {
    let booking = null;

    // 1. Try Backend API
    try {
      const res = await fetch(`${API_BASE}/bookings/track/${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        booking = data.booking;
      }
    } catch (apiErr) {
      console.warn('Backend track API offline, checking local cache...', apiErr);
    }

    // 2. Fallback to local storage if API didn't find or offline
    if (!booking) {
      const localHistory = localStorage.getItem('rudraksha_bookings_history');
      if (localHistory) {
        const list = JSON.parse(localHistory);
        const cleanQ = query.trim().toLowerCase();
        const phoneClean = cleanQ.replace(/\D/g, '');
        booking = list.find(b => 
          (b.id && b.id.toLowerCase().includes(cleanQ)) ||
          (phoneClean && b.customer_phone && b.customer_phone.replace(/\D/g, '') === phoneClean) ||
          (phoneClean && b.phone && b.phone.replace(/\D/g, '') === phoneClean)
        );
      }
    }

    // 3. Fallback Sample Demo Booking if user tests with sample ID
    if (!booking && (query === 'RB-6DFFD540' || query === '8619384774')) {
      booking = {
        id: 'RB-6DFFD540',
        customer_name: 'Vinay Kumar',
        customer_phone: '8619384774',
        customer_email: 'vinay@rudraksha.com',
        pickup_address: 'Ajmer Road, Jaipur, Rajasthan',
        drop_address: 'Sector 54, Gurugram, Delhi NCR',
        distance_km: 274,
        shifting_date: 'Today, 30 Aug 2026',
        selected_vehicle: 'Closed Car Carrier',
        house_type: '2 BHK Apartment',
        total_amount: 15090,
        status: 'in_transit',
        assigned_driver_name: 'Vikram Singh',
        assigned_driver_phone: '9829012345',
        assigned_vehicle_no: 'RJ-14-GB-5521',
        assigned_vehicle_type: 'Closed Hydraulic Carrier',
        addons: ['Bubble Packing', 'Transit Insurance'],
        items: { sofa: 1, bed: 2, boxes: 10 }
      };
    }

    if (!booking) {
      throw new Error(`No booking found matching "${query}". Please verify your reference ID or mobile number.`);
    }

    currentBooking = booking;
    renderTrackingDashboard(booking);

    if (loadingEl) loadingEl.classList.add('d-none');
    if (contentEl) {
      contentEl.classList.remove('d-none');
      contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('d-none');
    if (notFoundEl) {
      notFoundEl.classList.remove('d-none');
      document.getElementById('trackerErrorMsg').innerText = err.message || 'Booking not found.';
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-location-crosshairs me-1"></i> <span>Track Live</span>';
    }
  }
}

/* ==========================================================================
   2. RENDER TRACKING DETAILS & TIMELINE
   ========================================================================== */
function renderTrackingDashboard(b) {
  const bId = b.id || 'RB-XXXXXX';
  const cName = b.customer_name || b.name || 'Customer';
  const cPhone = b.customer_phone || b.phone || '-';
  const pickup = b.pickup_address || b.pickup || 'Jaipur';
  const drop = b.drop_address || b.drop || 'Delhi NCR';
  const dist = b.distance_km || b.distanceKm || 25;
  const date = b.shifting_date || b.date || 'Today';
  const vehicle = b.selected_vehicle || 'Dedicated Truck';
  const amount = b.total_amount ? `₹${Number(b.total_amount).toLocaleString('en-IN')}` : (b.total || '₹0');
  const status = (b.status || 'received').toLowerCase();

  // Top Banner
  document.getElementById('displayBookingId').innerText = bId;
  document.getElementById('displayShiftingDate').innerHTML = `<i class="fa-solid fa-calendar-day text-warning me-1"></i> ${date}`;

  // Status mapping
  const statusConfig = {
    'received': { heading: 'Booking Received & Logged', sub: 'Our team is preparing your relocation dispatch', pill: '📥 Order Received', icon: 'fa-inbox' },
    'reviewing': { heading: 'Cargo Inventory Verified', sub: 'Packaging checklist and cargo clearance approved', pill: '🔍 Verified & Confirmed', icon: 'fa-clipboard-check' },
    'confirmed': { heading: 'Relocation Confirmed', sub: 'Vehicle and driver scheduled for transit', pill: '✅ Booking Confirmed', icon: 'fa-circle-check' },
    'driver_assigned': { heading: 'Driver & Vehicle Assigned', sub: 'Driver is moving to your pickup location', pill: '🚚 Driver Assigned', icon: 'fa-id-badge' },
    'in_transit': { heading: 'Shipment In Transit (On Road)', sub: 'Moving safely towards destination on schedule', pill: '🛣️ In Transit (Live GPS)', icon: 'fa-truck-fast' },
    'delivered': { heading: 'Safely Delivered & Completed', sub: 'Goods unloaded and inspected at destination', pill: '🏁 Delivered', icon: 'fa-flag-checkered' },
    'cancelled': { heading: 'Booking Cancelled', sub: 'This relocation order has been cancelled', pill: '❌ Cancelled', icon: 'fa-ban' }
  };

  const currentStatusInfo = statusConfig[status] || statusConfig['received'];
  document.getElementById('displayStatusHeading').innerText = currentStatusInfo.heading;
  document.getElementById('displayStatusSub').innerText = currentStatusInfo.sub;
  document.getElementById('displayStatusPill').innerText = currentStatusInfo.pill;
  document.getElementById('bannerStatusIcon').innerHTML = `<i class="fa-solid ${currentStatusInfo.icon}"></i>`;

  // Milestone Stepper Timeline
  updateTimelineMilestones(status);

  // Driver Profile Card
  const driverName = b.assigned_driver_name || 'Mukesh Sharma (Assigned Driver)';
  const driverPhone = b.assigned_driver_phone || '9876543210';
  const driverVehicleNo = b.assigned_vehicle_no || 'RJ-14-GA-1024';
  const driverVehicleType = b.assigned_vehicle_type || vehicle;

  document.getElementById('driverName').innerText = driverName;
  document.getElementById('driverVehicleNo').innerText = driverVehicleNo;
  document.getElementById('driverVehicleType').innerText = driverVehicleType;
  document.getElementById('btnCallDriver').href = `tel:${driverPhone}`;
  document.getElementById('btnWhatsappDriver').href = `https://wa.me/91${driverPhone}?text=Hello%20${encodeURIComponent(driverName)},%20regarding%20my%20Rudraksha%20booking%20${bId}`;

  // Shipment Breakdown
  document.getElementById('summaryCustomerName').innerText = cName;
  document.getElementById('summaryCustomerPhone').innerText = `+91 ${cPhone}`;
  document.getElementById('summaryHouseType').innerText = (b.house_type || 'Standard Cargo').toUpperCase();
  document.getElementById('summaryVehicle').innerText = vehicle;
  document.getElementById('summaryPickup').innerText = pickup;
  document.getElementById('summaryDrop').innerText = drop;
  document.getElementById('summaryTotalAmount').innerText = amount;

  const addonsList = Array.isArray(b.addons) && b.addons.length > 0 ? b.addons.join(', ') : 'Standard Transit Protection';
  document.getElementById('summaryAddons').innerText = addonsList;

  // Map Route Names
  document.getElementById('mapPickupName').innerText = pickup.split(',')[0];
  document.getElementById('mapDropName').innerText = drop.split(',')[0];
  document.getElementById('mapDistanceText').innerText = `Total Distance: ~${dist} KM • Live Real-time GPS Track`;

  // Initialize and Render Map
  initLiveTrackMap(b, status);
}

/* ==========================================================================
   3. TIMELINE STEPPER HIGHLIGHTER
   ========================================================================== */
function updateTimelineMilestones(status) {
  const steps = ['received', 'reviewing', 'assigned', 'transit', 'delivered'];
  const lines = ['line-1', 'line-2', 'line-3', 'line-4'];

  // Status index mapping
  let activeIdx = 0;
  if (status === 'received') activeIdx = 0;
  else if (status === 'reviewing' || status === 'confirmed') activeIdx = 1;
  else if (status === 'driver_assigned') activeIdx = 2;
  else if (status === 'in_transit') activeIdx = 3;
  else if (status === 'delivered') activeIdx = 4;

  steps.forEach((stepKey, idx) => {
    const stepEl = document.getElementById(`step-${stepKey}`);
    if (!stepEl) return;

    stepEl.classList.remove('completed', 'active');
    if (idx < activeIdx) {
      stepEl.classList.add('completed');
    } else if (idx === activeIdx) {
      stepEl.classList.add('active');
    }
  });

  lines.forEach((lineId, idx) => {
    const lineEl = document.getElementById(lineId);
    if (!lineEl) return;

    lineEl.classList.remove('completed', 'active');
    if (idx < activeIdx) {
      lineEl.classList.add('completed');
    } else if (idx === activeIdx) {
      lineEl.classList.add('active');
    }
  });
}

/* ==========================================================================
   4. LEAFLET MAP & ANIMATED TRUCK
   ========================================================================== */
function initLiveTrackMap(booking, status) {
  // Default coordinates: Jaipur to Delhi/Gurugram
  let pLat = parseFloat(booking.pickup_lat) || 26.9124;
  let pLng = parseFloat(booking.pickup_lng) || 75.7873;
  let dLat = parseFloat(booking.drop_lat) || 28.4595;
  let dLng = parseFloat(booking.drop_lng) || 77.0266;

  // If map not initialized yet
  if (!trackMap) {
    trackMap = L.map('liveTrackMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([pLat, pLng], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(trackMap);
  }

  // Clear existing layers
  if (pickupMarker) trackMap.removeLayer(pickupMarker);
  if (dropMarker) trackMap.removeLayer(dropMarker);
  if (vehicleMarker) trackMap.removeLayer(vehicleMarker);
  if (routePolyline) trackMap.removeLayer(routePolyline);

  // Custom Icon Helpers
  const greenIcon = L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="width:20px;height:20px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px #22c55e;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const orangeIcon = L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="width:20px;height:20px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px #f97316;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  pickupMarker = L.marker([pLat, pLng], { icon: greenIcon }).addTo(trackMap)
    .bindPopup(`<b>Origin (Pickup):</b><br>${booking.pickup_address || 'Jaipur'}`);

  dropMarker = L.marker([dLat, dLng], { icon: orangeIcon }).addTo(trackMap)
    .bindPopup(`<b>Destination (Drop):</b><br>${booking.drop_address || 'Delhi NCR'}`);

  // Route Polyline
  const routePoints = [[pLat, pLng], [dLat, dLng]];
  routePolyline = L.polyline(routePoints, {
    color: '#f97316',
    weight: 4,
    opacity: 0.8,
    dashArray: '8, 8'
  }).addTo(trackMap);

  // Calculate Vehicle position on route
  let progressRatio = 0.05;
  if (status === 'received') progressRatio = 0.05;
  else if (status === 'reviewing' || status === 'confirmed') progressRatio = 0.15;
  else if (status === 'driver_assigned') progressRatio = 0.30;
  else if (status === 'in_transit') progressRatio = 0.65;
  else if (status === 'delivered') progressRatio = 1.0;

  const vLat = pLat + (dLat - pLat) * progressRatio;
  const vLng = pLng + (dLng - pLng) * progressRatio;

  const truckIcon = L.divIcon({
    className: 'custom-truck-pin',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:40px;height:40px;background:rgba(208,253,56,0.25);border-radius:50%;animation:pulseDot 1.5s infinite;"></div>
        <div style="width:34px;height:34px;background:#17171A;border:2px solid #D0FD38;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#D0FD38;box-shadow:0 0 15px rgba(208,253,56,0.6);font-size:14px;position:relative;z-index:2;">
          <i class="fa-solid fa-truck-fast"></i>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  vehicleMarker = L.marker([vLat, vLng], { icon: truckIcon }).addTo(trackMap)
    .bindPopup(`<b>🚚 Moving Vehicle:</b><br>${booking.assigned_driver_name || 'Fleet Driver'}<br>Status: ${(status).toUpperCase()}`)
    .openPopup();

  // Fit bounds to show both origin and destination
  const bounds = L.latLngBounds(routePoints);
  trackMap.fitBounds(bounds, { padding: [40, 40] });

  setTimeout(() => { trackMap.invalidateSize(); }, 300);
}

function recenterMap() {
  if (trackMap && vehicleMarker) {
    trackMap.setView(vehicleMarker.getLatLng(), 11, { animate: true });
    vehicleMarker.openPopup();
  }
}

function copyBookingRef() {
  if (!currentBooking) return;
  navigator.clipboard.writeText(currentBooking.id || '');
  alert(`Booking Reference ID "${currentBooking.id}" copied to clipboard!`);
}

/* ==========================================================================
   5. TAX INVOICE PREVIEW MODAL
   ========================================================================== */
function openInvoicePreview() {
  if (!currentBooking) return;
  const b = currentBooking;

  const modalBody = document.getElementById('invoiceModalBody');
  if (!modalBody) return;

  const bId = b.id || 'RB-XXXXXX';
  const cName = b.customer_name || b.name || 'Valued Customer';
  const cPhone = b.customer_phone || b.phone || '-';
  const pickup = b.pickup_address || b.pickup || 'Jaipur';
  const drop = b.drop_address || b.drop || 'Delhi NCR';
  const dist = b.distance_km || b.distanceKm || 25;
  const date = b.shifting_date || b.date || 'Today';
  const vehicle = b.selected_vehicle || 'Tata Ace (1.5 Ton)';
  const total = b.total_amount ? Number(b.total_amount) : 15090;

  modalBody.innerHTML = `
    <div style="background: #ffffff; color: #1e293b; padding: 24px; border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif;">
      <!-- Invoice Header -->
      <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
        <div>
          <h4 class="fw-bold text-dark mb-0">RUDRAKSHA PACKERS & MOVERS</h4>
          <div class="small text-muted">All India Relocation & Logistics • ISO 9001:2015</div>
          <div class="small text-muted">Near SNM Hospital, Gandhipath (West), Jaipur, RJ • +91 7296831460</div>
        </div>
        <div class="text-end">
          <span class="badge bg-dark fs-6">TAX INVOICE</span>
          <div class="fw-bold mt-1 text-dark">REF: ${bId}</div>
          <div class="small text-muted">Date: ${date}</div>
        </div>
      </div>

      <!-- Bill To & Route -->
      <div class="row g-3 mb-3">
        <div class="col-6">
          <div class="p-2 border rounded bg-light">
            <div class="small fw-bold text-secondary">CUSTOMER DETAILS:</div>
            <div class="fw-bold text-dark">${cName}</div>
            <div class="small text-muted">Phone: +91 ${cPhone}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="p-2 border rounded bg-light">
            <div class="small fw-bold text-secondary">RELOCATION ROUTE:</div>
            <div class="small text-dark fw-semibold">${pickup} ➔ ${drop}</div>
            <div class="small text-muted">Distance: ${dist} KM • Vehicle: ${vehicle}</div>
          </div>
        </div>
      </div>

      <!-- Charge Summary Table -->
      <table class="table table-bordered table-sm mb-3">
        <thead class="table-light">
          <tr>
            <th>Description of Services</th>
            <th class="text-end">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Base Relocation & Transport Fee (${vehicle})</td>
            <td class="text-end">₹${Math.round(total * 0.70).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td>Professional Packing, Labor & Handling Charges</td>
            <td class="text-end">₹${Math.round(total * 0.20).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td>Transit Insurance & Cargo Protection</td>
            <td class="text-end">₹${Math.round(total * 0.10).toLocaleString('en-IN')}</td>
          </tr>
          <tr class="table-light fw-bold">
            <td>TOTAL AMOUNT PAYABLE</td>
            <td class="text-end fs-6 text-primary">₹${total.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer Signature -->
      <div class="d-flex justify-content-between align-items-end pt-2 border-top">
        <div class="small text-muted">
          <div>Payment Mode: Confirmed</div>
          <div>Computer generated invoice. No signature required.</div>
        </div>
        <div class="text-end">
          <div class="fw-bold text-dark" style="font-family: cursive;">Rudraksha Logistics</div>
          <div class="small text-muted">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
  modal.show();
}
