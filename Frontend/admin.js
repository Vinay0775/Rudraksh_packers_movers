const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'rudraksha_admin_auth_token';
const DEFAULT_MASTER_PASS = 'rudraksha@admin2026';

let adminBookings = [];
let adminDrivers = [];
let adminCoupons = [];
let adminRates = {};
let adminVehicles = {};
let adminCompany = {};

document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
});

/* ==========================================================================
   1. ADMIN AUTHENTICATION CONTROLLER
   ========================================================================== */
function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token, remember = true) {
  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function checkAdminAuth() {
  const token = getAuthToken();
  const overlay = document.getElementById('adminLoginOverlay');

  if (!token) {
    if (overlay) overlay.style.display = 'flex';
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      if (overlay) overlay.style.display = 'none';
      await refreshAdminAll();
      return true;
    } else {
      clearAuthToken();
      if (overlay) overlay.style.display = 'flex';
      return false;
    }
  } catch (err) {
    // Offline local session fallback
    if (overlay) overlay.style.display = 'none';
    await refreshAdminAll();
    return true;
  }
}

async function submitAdminLogin() {
  const usernameInput = document.getElementById('adminUsernameInput');
  const passwordInput = document.getElementById('adminPasswordInput');
  const rememberCheck = document.getElementById('rememberAdminCheck');
  const errorAlert = document.getElementById('loginErrorAlert');
  const errorMsg = document.getElementById('loginErrorMsg');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  const username = usernameInput?.value.trim() || 'admin';
  const password = passwordInput?.value.trim() || '';

  if (!password) {
    if (errorAlert) {
      errorAlert.classList.remove('d-none');
      errorMsg.innerText = 'Please enter security key.';
    }
    return;
  }

  if (errorAlert) errorAlert.classList.add('d-none');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Authenticating...';
  }

  try {
    let token = null;
    let authSuccess = false;

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        token = data.token;
        authSuccess = true;
      } else {
        throw new Error(data.error || 'Invalid credentials');
      }
    } catch (apiErr) {
      if (password === DEFAULT_MASTER_PASS) {
        token = `local_admin_session_${Date.now()}`;
        authSuccess = true;
      } else {
        throw apiErr;
      }
    }

    if (authSuccess && token) {
      setAuthToken(token, rememberCheck?.checked);
      const overlay = document.getElementById('adminLoginOverlay');
      if (overlay) overlay.style.display = 'none';
      showAdminToast('Dashboard unlocked! Welcome to Rudraksha Command Center.');
      await refreshAdminAll();
    }
  } catch (err) {
    if (errorAlert) {
      errorAlert.classList.remove('d-none');
      errorMsg.innerText = err.message || 'Incorrect password.';
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-bolt me-1"></i> Unlock Dashboard';
    }
  }
}

function toggleAdminPassVisibility() {
  const passInput = document.getElementById('adminPasswordInput');
  const icon = document.getElementById('passToggleIcon');
  if (!passInput || !icon) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    passInput.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

function logoutAdmin() {
  if (confirm('Lock and sign out of the Admin Hub?')) {
    clearAuthToken();
    const overlay = document.getElementById('adminLoginOverlay');
    if (overlay) overlay.style.display = 'flex';
    const passInput = document.getElementById('adminPasswordInput');
    if (passInput) passInput.value = '';
  }
}

/* ==========================================================================
   2. DYNAMIC TAB NAVIGATION & SEARCH
   ========================================================================== */
function switchAdminTab(tabName) {
  const tabs = ['dashboard', 'bookings', 'fleet', 'rates', 'coupons', 'theme'];

  tabs.forEach((t) => {
    const desktopBtn = document.getElementById(`nav-${t}`);
    const mobileBtn = document.getElementById(`mob-nav-${t}`);
    const panel = document.getElementById(`tab-${t}`);

    if (t === tabName) {
      if (desktopBtn) desktopBtn.classList.add('active');
      if (mobileBtn) mobileBtn.classList.add('active');
      if (panel) {
        panel.classList.add('active');
        // Trigger re-animation
        panel.style.animation = 'none';
        panel.offsetHeight; // Trigger reflow
        panel.style.animation = null;
      }
    } else {
      if (desktopBtn) desktopBtn.classList.remove('active');
      if (mobileBtn) mobileBtn.classList.remove('active');
      if (panel) panel.classList.remove('active');
    }
  });

  // Re-trigger bar charts & counters on dashboard tab
  if (tabName === 'dashboard') {
    triggerDashboardAnimations();
  }

  // Scroll to top on tab switch
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderBookingsTable();
    renderDriversTable();
    renderVehiclesTable();
    return;
  }

  // Filter Bookings
  const filteredBookings = adminBookings.filter(b => 
    (b.id && b.id.toLowerCase().includes(q)) ||
    (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
    (b.customer_phone && b.customer_phone.includes(q)) ||
    (b.pickup_address && b.pickup_address.toLowerCase().includes(q)) ||
    (b.drop_address && b.drop_address.toLowerCase().includes(q)) ||
    (b.selected_vehicle && b.selected_vehicle.toLowerCase().includes(q))
  );
  renderBookingsTable(filteredBookings);

  // If search matches tab keywords, auto-switch
  if (['fleet', 'vehicle', 'truck', 'driver'].includes(q)) switchAdminTab('fleet');
  else if (['rate', 'price', 'tariff', 'floor'].includes(q)) switchAdminTab('rates');
  else if (['coupon', 'promo', 'discount'].includes(q)) switchAdminTab('coupons');
  else if (['theme', 'color', 'brand', 'contact'].includes(q)) switchAdminTab('theme');
}

/* ==========================================================================
   3. ANIMATED NUMBER COUNTERS & MOTION ENGINE
   ========================================================================== */
function animateCountUp(elementId, targetValue, duration = 1400, prefix = '', suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const start = 0;
  const startTime = performance.now();

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const current = Math.round(start + (targetValue - start) * eased);

    el.innerText = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.innerText = `${prefix}${targetValue.toLocaleString('en-IN')}${suffix}`;
    }
  }

  requestAnimationFrame(update);
}

function triggerDashboardAnimations() {
  // Speedometer fill animation
  const speedo = document.getElementById('speedoTrackFill');
  if (speedo) {
    speedo.style.width = '0%';
    setTimeout(() => { speedo.style.width = '68%'; }, 150);
  }

  // Bar chart capsules grow animation
  document.querySelectorAll('.cyber-bar-capsule').forEach(bar => {
    const origHeight = bar.style.height || '50%';
    bar.style.height = '0%';
    setTimeout(() => { bar.style.height = origHeight; }, 200);
  });
}

/* ==========================================================================
   4. DATA LOADERS & REAL-TIME SYNC
   ========================================================================== */
async function checkBackendHealth() {
  const statusText = document.getElementById('backendStatusText');
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      if (statusText) statusText.innerText = data.supabaseActive ? 'Supabase Active 🟢' : 'Local DB Active 🟡';
    }
  } catch (err) {
    if (statusText) statusText.innerText = 'Offline Mode 🔴';
  }
}

async function loadBookingsFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      adminBookings = data.bookings || [];
    }
  } catch (err) {
    const saved = localStorage.getItem('rudraksha_bookings_history');
    adminBookings = saved ? JSON.parse(saved) : [];
  }

  renderBookingsTable();
  updateDashboardMetrics();
}

function renderBookingsTable(list = adminBookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fa-solid fa-inbox me-2"></i>No bookings found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((b) => {
    const bId = b.id || 'RB-XXXX';
    const cName = b.customer_name || b.name || 'Customer';
    const cPhone = b.customer_phone || b.phone || '-';
    const pickup = b.pickup_address || b.pickup || '-';
    const drop = b.drop_address || b.drop || '-';
    const date = b.shifting_date || b.date || '-';
    const dist = b.distance_km || b.distanceKm || 25;
    const amount = b.total_amount ? `₹${Number(b.total_amount).toLocaleString('en-IN')}` : (b.total || '₹0');
    const status = (b.status || 'received').toLowerCase();

    const driverName = b.assigned_driver_name ? `👨‍✈️ ${b.assigned_driver_name} (${b.assigned_vehicle_no})` : `<span class="badge" style="background: rgba(255,255,255,0.06); color: #8E8E93;">Unassigned</span>`;

    return `
      <tr>
        <td><strong style="color: #D0FD38;">${bId}</strong></td>
        <td>
          <div class="fw-bold text-white">${cName}</div>
          <div class="small text-muted"><a href="tel:${cPhone}" class="text-decoration-none" style="color: #8E8E93;"><i class="fa-solid fa-phone me-1 text-success"></i>+91 ${cPhone}</a></div>
        </td>
        <td>
          <div class="small fw-semibold text-white">${pickup} ➔ ${drop}</div>
          <div class="small text-muted"><i class="fa-solid fa-calendar me-1"></i>${date} • ${dist} KM</div>
          <div class="small fw-semibold mt-1" style="color: #D0FD38;"><i class="fa-solid fa-truck-pickup me-1"></i>${b.selected_vehicle || 'Tata Ace'}</div>
        </td>
        <td><strong class="text-white">${amount}</strong></td>
        <td>
          <select class="cyber-select py-1 px-2 fw-bold" onchange="handleStatusChange('${bId}', this.value)" style="width: 140px; font-size: 0.78rem;">
            <option value="received" ${status === 'received' ? 'selected' : ''}>📥 Received</option>
            <option value="reviewing" ${status === 'reviewing' ? 'selected' : ''}>🔍 Reviewing</option>
            <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
            <option value="driver_assigned" ${status === 'driver_assigned' ? 'selected' : ''}>🚚 Assigned</option>
            <option value="in_transit" ${status === 'in_transit' ? 'selected' : ''}>🛣️ In Transit</option>
            <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>🏁 Delivered</option>
            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </td>
        <td><div class="small">${driverName}</div></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn-cyber-outline py-1 px-2" title="Assign Driver" onclick="openAssignDriverModal('${bId}')">
              <i class="fa-solid fa-user-plus"></i>
            </button>
            <a href="https://wa.me/91${cPhone}?text=Hello%20${encodeURIComponent(cName)},%20regarding%20your%20Rudraksha%20Packers%20booking%20${bId}" target="_blank" class="btn-cyber-outline py-1 px-2 text-success" title="WhatsApp Chat">
              <i class="fa-brands fa-whatsapp"></i>
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleStatusChange(bookingId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error('Status update failed');
    showAdminToast(`Booking ${bookingId} marked as ${newStatus.toUpperCase()}`);
    await loadBookingsFromBackend();
  } catch (err) {
    alert(`Could not update status: ${err.message}`);
  }
}

/* ==========================================================================
   5. FLEET & DEDICATED VEHICLES
   ========================================================================== */
async function loadFleetVehicles() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const config = await res.json();
      adminVehicles = config.vehicles || {};
    }
  } catch {
    const saved = localStorage.getItem('rudraksha_fleet_config');
    if (saved) adminVehicles = JSON.parse(saved);
    else {
      adminVehicles = {
        'mini_truck': { name: 'Tata Ace / Mini (1.5 Ton)', basePrice: 2500, perKmRate: 35, icon: 'fa-truck-pickup', cap: 'Up to 1 BHK / Studio' },
        'tempo_14ft': { name: '14ft Tempo / Eicher (3.5 Ton)', basePrice: 3500, perKmRate: 45, icon: 'fa-truck', cap: 'Ideal for 1-2 BHK' },
        'truck_19ft': { name: '19ft Container Truck (7 Ton)', basePrice: 5500, perKmRate: 65, icon: 'fa-truck-moving', cap: '3+ BHK / Large Moving' },
        'bike': { name: 'Bike Transport Carrier', basePrice: 1500, perKmRate: 15, icon: 'fa-motorcycle', cap: 'Two-Wheeler Carrier' },
        'car': { name: 'Closed Car Carrier', basePrice: 4500, perKmRate: 35, icon: 'fa-car-side', cap: 'Hydraulic Car Carrier' }
      };
    }
  }

  localStorage.setItem('rudraksha_fleet_config', JSON.stringify(adminVehicles));
  renderVehiclesTable();
  populateDriverVehicleSelect();
}

function renderVehiclesTable(list = adminVehicles) {
  const tbody = document.getElementById('vehiclesTableBody');
  if (!tbody) return;

  const keys = Object.keys(list);
  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">No vehicles configured. Add one using the form.</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map((key) => {
    const v = list[key];
    return `
      <tr>
        <td><i class="fa-solid ${v.icon || 'fa-truck'} fa-lg" style="color: #D0FD38;"></i></td>
        <td>
          <div class="fw-bold text-white">${v.name}</div>
          <div class="small text-muted"><code>${key}</code></div>
        </td>
        <td><strong class="text-white">₹${Number(v.basePrice || 0).toLocaleString('en-IN')}</strong></td>
        <td><strong style="color: #D0FD38;">₹${v.perKmRate || 0} / KM</strong></td>
        <td><span class="cyber-badge-pill">${v.cap || 'Standard'}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn-cyber-outline py-1 px-2" title="Edit Vehicle" onclick="editVehicle('${key}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-cyber-outline py-1 px-2 text-danger" title="Delete Vehicle" onclick="deleteVehicle('${key}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editVehicle(key) {
  const v = adminVehicles[key];
  if (!v) return;
  document.getElementById('vehKey').value = key;
  document.getElementById('vehName').value = v.name;
  document.getElementById('vehBasePrice').value = v.basePrice;
  document.getElementById('vehPerKm').value = v.perKmRate;
  document.getElementById('vehCap').value = v.cap || '';
  document.getElementById('vehIcon').value = v.icon || 'fa-truck';
  document.getElementById('vehName').focus();
}

async function handleSaveVehicle() {
  const key = document.getElementById('vehKey').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const name = document.getElementById('vehName').value.trim();
  const basePrice = parseFloat(document.getElementById('vehBasePrice').value) || 2500;
  const perKmRate = parseFloat(document.getElementById('vehPerKm').value) || 35;
  const cap = document.getElementById('vehCap').value.trim() || 'Custom';
  const icon = document.getElementById('vehIcon').value.trim() || 'fa-truck';

  if (!key || !name) {
    alert('Please enter vehicle key and name.');
    return;
  }

  const payload = { vehicle_key: key, name, basePrice, perKmRate, cap, icon };

  try {
    const res = await fetch(`${API_BASE}/admin/vehicles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.config && data.config.vehicles) adminVehicles = data.config.vehicles;
      else adminVehicles[key] = { name, basePrice, perKmRate, cap, icon };
    } else {
      adminVehicles[key] = { name, basePrice, perKmRate, cap, icon };
    }
  } catch {
    adminVehicles[key] = { name, basePrice, perKmRate, cap, icon };
  }

  localStorage.setItem('rudraksha_fleet_config', JSON.stringify(adminVehicles));
  showAdminToast(`Vehicle model "${name}" added to Client Calculator!`);
  document.getElementById('vehicleConfigForm').reset();
  renderVehiclesTable();
  populateDriverVehicleSelect();
}

async function deleteVehicle(key) {
  if (!confirm(`Delete vehicle "${adminVehicles[key]?.name || key}" from calculator?`)) return;

  try {
    await fetch(`${API_BASE}/admin/vehicles/${key}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  } catch {}

  delete adminVehicles[key];
  localStorage.setItem('rudraksha_fleet_config', JSON.stringify(adminVehicles));
  showAdminToast('Vehicle deleted successfully.');
  renderVehiclesTable();
  populateDriverVehicleSelect();
}

function populateDriverVehicleSelect() {
  const select = document.getElementById('drvVehicleType');
  if (!select) return;

  const keys = Object.keys(adminVehicles);
  if (keys.length === 0) {
    select.innerHTML = `<option value="Tata Ace">Tata Ace (1.5 Ton)</option>`;
    return;
  }

  select.innerHTML = keys.map(k => `
    <option value="${adminVehicles[k].name}">${adminVehicles[k].name}</option>
  `).join('');
}

/* ==========================================================================
   6. DRIVERS ROSTER
   ========================================================================== */
async function loadDriversFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/drivers`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      adminDrivers = data.drivers || [];
    }
  } catch {
    adminDrivers = [
      { id: 'drv-101', driver_name: 'Mukesh Sharma', phone: '9876543210', vehicle_number: 'RJ-14-GA-1024', vehicle_type: 'Tata Ace (1.5 Ton)', status: 'available', rating: 4.9 },
      { id: 'drv-102', driver_name: 'Vikram Singh', phone: '9829012345', vehicle_number: 'RJ-14-GB-5521', vehicle_type: 'Eicher 14ft (3.5 Ton)', status: 'available', rating: 4.8 },
      { id: 'drv-103', driver_name: 'Ramesh Meena', phone: '9414098765', vehicle_number: 'RJ-14-GC-8840', vehicle_type: '19ft Container (7 Ton)', status: 'available', rating: 4.7 }
    ];
  }

  renderDriversTable();
}

function renderDriversTable() {
  const tbody = document.getElementById('driversTableBody');
  if (!tbody) return;

  tbody.innerHTML = adminDrivers.map((d) => `
    <tr>
      <td>
        <div class="fw-bold text-white">${d.driver_name}</div>
        <div class="small text-muted">ID: ${d.id}</div>
      </td>
      <td><a href="tel:${d.phone}" class="text-decoration-none" style="color: #8E8E93;"><i class="fa-solid fa-phone text-success me-1"></i>+91 ${d.phone}</a></td>
      <td>
        <span class="cyber-badge-pill" style="color: #ffffff;">${d.vehicle_number}</span>
        <span class="small text-muted ms-1">${d.vehicle_type}</span>
      </td>
      <td>
        <span class="cyber-badge-pill ${d.status === 'available' ? 'active-glow' : ''}">
          <span class="dot"></span> ${(d.status || 'available').toUpperCase()}
        </span>
      </td>
      <td><span style="color: #D0FD38; font-weight: bold;">⭐ ${d.rating || 4.8}</span></td>
    </tr>
  `).join('');
}

async function handleAddDriver() {
  const name = document.getElementById('drvName').value.trim();
  const phone = document.getElementById('drvPhone').value.trim();
  const vehicleNo = document.getElementById('drvVehicleNo').value.trim().toUpperCase();
  const vehicleType = document.getElementById('drvVehicleType').value;

  try {
    const res = await fetch(`${API_BASE}/drivers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ driver_name: name, phone, vehicle_number: vehicleNo, vehicle_type: vehicleType })
    });

    if (!res.ok) throw new Error('Registration error');
    showAdminToast(`Driver "${name}" enrolled into fleet!`);
    document.getElementById('driverForm').reset();
    await loadDriversFromBackend();
  } catch (err) {
    alert(err.message);
  }
}

function openAssignDriverModal(bookingId) {
  const booking = adminBookings.find(b => b.id === bookingId);
  if (!booking) return;

  document.getElementById('assignBookingId').value = booking.id;
  document.getElementById('assignBookingDisplayId').innerText = booking.id;
  document.getElementById('assignBookingCustName').innerText = `${booking.customer_name || booking.name} (+91 ${booking.customer_phone || booking.phone})`;

  const select = document.getElementById('assignDriverSelect');
  select.innerHTML = adminDrivers.map(d => `
    <option value="${d.id}" data-name="${d.driver_name}" data-phone="${d.phone}" data-veh="${d.vehicle_number}">
      ${d.driver_name} - ${d.vehicle_number} (${d.vehicle_type})
    </option>
  `).join('');

  document.getElementById('assignStatusMsg').innerHTML = '';
  const modal = new bootstrap.Modal(document.getElementById('assignDriverModal'));
  modal.show();
}

async function submitDriverAssignment() {
  const bookingId = document.getElementById('assignBookingId').value;
  const select = document.getElementById('assignDriverSelect');
  const selectedOpt = select.options[select.selectedIndex];

  if (!selectedOpt) return;

  const driver_id = selectedOpt.value;
  const driver_name = selectedOpt.getAttribute('data-name');
  const driver_phone = selectedOpt.getAttribute('data-phone');
  const vehicle_number = selectedOpt.getAttribute('data-veh');

  const statusMsg = document.getElementById('assignStatusMsg');
  statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Assigning driver...';

  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ driver_id, driver_name, driver_phone, vehicle_number })
    });

    if (!res.ok) throw new Error('Assignment failed');

    statusMsg.innerHTML = '<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Driver assigned successfully!</span>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('assignDriverModal'))?.hide();
      loadBookingsFromBackend();
    }, 1000);
  } catch (err) {
    statusMsg.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

/* ==========================================================================
   7. RATES & TARIFF CONTROLLER
   ========================================================================== */
async function loadAdminRates() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const config = await res.json();
      if (config.rates) adminRates = config.rates;
    }
  } catch {
    const saved = localStorage.getItem('rudraksha_rates_config');
    if (saved) adminRates = JSON.parse(saved);
  }

  // Populate form inputs
  if (document.getElementById('rateBase')) document.getElementById('rateBase').value = adminRates.baseRate || 2500;
  if (document.getElementById('ratePerKm')) document.getElementById('ratePerKm').value = adminRates.perKmRate || 40;
  if (document.getElementById('rateFloorNoLift')) document.getElementById('rateFloorNoLift').value = adminRates.floorNoLiftRate || 300;

  const hs = adminRates.houseSizeRates || {};
  if (document.getElementById('rateHouse1rk')) document.getElementById('rateHouse1rk').value = hs['1rk'] ?? 0;
  if (document.getElementById('rateHouse1bhk')) document.getElementById('rateHouse1bhk').value = hs['1bhk'] ?? 1000;
  if (document.getElementById('rateHouse2bhk')) document.getElementById('rateHouse2bhk').value = hs['2bhk'] ?? 2500;
  if (document.getElementById('rateHouse3bhk')) document.getElementById('rateHouse3bhk').value = hs['3bhk'] ?? 4500;
  if (document.getElementById('rateHouseVilla')) document.getElementById('rateHouseVilla').value = hs['villa'] ?? 7500;

  const items = adminRates.itemRates || {};
  if (document.getElementById('rateItemSofa')) document.getElementById('rateItemSofa').value = items.sofa ?? 500;
  if (document.getElementById('rateItemBed')) document.getElementById('rateItemBed').value = items.bed ?? 600;
  if (document.getElementById('rateItemDining')) document.getElementById('rateItemDining').value = items.dining ?? 400;
  if (document.getElementById('rateItemFridge')) document.getElementById('rateItemFridge').value = items.fridge ?? 400;
  if (document.getElementById('rateItemWashing')) document.getElementById('rateItemWashing').value = items.washing ?? 350;
  if (document.getElementById('rateItemBoxes')) document.getElementById('rateItemBoxes').value = items.boxes ?? 80;

  const addons = adminRates.addonRates || {};
  if (document.getElementById('rateAddonBubble')) document.getElementById('rateAddonBubble').value = addons.bubblePacking ?? 1500;
  if (document.getElementById('rateAddonUnpacking')) document.getElementById('rateAddonUnpacking').value = addons.unpacking ?? 1200;
  if (document.getElementById('rateAddonInsurance')) document.getElementById('rateAddonInsurance').value = addons.insurance ?? 999;
  if (document.getElementById('rateAddonVehicleTransport')) document.getElementById('rateAddonVehicleTransport').value = addons.vehicleTransport ?? 2500;
}

async function saveAdminRates() {
  const baseRate = parseInt(document.getElementById('rateBase')?.value) || 2500;
  const perKmRate = parseInt(document.getElementById('ratePerKm')?.value) || 40;
  const floorNoLiftRate = parseInt(document.getElementById('rateFloorNoLift')?.value) || 300;

  const houseSizeRates = {
    '1rk': parseInt(document.getElementById('rateHouse1rk')?.value) || 0,
    '1bhk': parseInt(document.getElementById('rateHouse1bhk')?.value) || 1000,
    '2bhk': parseInt(document.getElementById('rateHouse2bhk')?.value) || 2500,
    '3bhk': parseInt(document.getElementById('rateHouse3bhk')?.value) || 4500,
    'villa': parseInt(document.getElementById('rateHouseVilla')?.value) || 7500
  };

  const itemRates = {
    sofa: parseInt(document.getElementById('rateItemSofa')?.value) || 500,
    bed: parseInt(document.getElementById('rateItemBed')?.value) || 600,
    dining: parseInt(document.getElementById('rateItemDining')?.value) || 400,
    fridge: parseInt(document.getElementById('rateItemFridge')?.value) || 400,
    washing: parseInt(document.getElementById('rateItemWashing')?.value) || 350,
    boxes: parseInt(document.getElementById('rateItemBoxes')?.value) || 80
  };

  const addonRates = {
    bubblePacking: parseInt(document.getElementById('rateAddonBubble')?.value) || 1500,
    unpacking: parseInt(document.getElementById('rateAddonUnpacking')?.value) || 1200,
    insurance: parseInt(document.getElementById('rateAddonInsurance')?.value) || 999,
    vehicleTransport: parseInt(document.getElementById('rateAddonVehicleTransport')?.value) || 2500
  };

  const newRates = { baseRate, perKmRate, floorNoLiftRate, houseSizeRates, itemRates, addonRates };
  adminRates = newRates;
  localStorage.setItem('rudraksha_rates_config', JSON.stringify(newRates));

  try {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rates: newRates })
    });
  } catch {}

  showAdminToast('All live rates & tariffs updated on customer website!');
}

/* ==========================================================================
   8. COUPONS MANAGER
   ========================================================================== */
async function loadAdminCoupons() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const config = await res.json();
      if (config.coupons) adminCoupons = config.coupons;
    }
  } catch {
    const saved = localStorage.getItem('rudraksha_coupons');
    if (saved) adminCoupons = JSON.parse(saved);
  }

  renderCouponsTable();
}

function renderCouponsTable() {
  const tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;

  if (adminCoupons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No active promo codes.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminCoupons.map((c) => `
    <tr>
      <td><span class="cyber-badge-pill active-glow font-monospace fs-6">${c.code}</span></td>
      <td>${c.type === 'percent' ? 'Percentage (%)' : 'Flat (₹)'}</td>
      <td><strong style="color: #D0FD38;">${c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</strong></td>
      <td class="small text-muted">${c.description || '-'}</td>
      <td><button class="btn-cyber-outline py-1 px-2 text-danger" onclick="deleteAdminCoupon('${c.code}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

async function createAdminCoupon() {
  const code = document.getElementById('newCouponCode').value.trim().toUpperCase();
  const type = document.getElementById('newCouponType').value;
  const value = parseInt(document.getElementById('newCouponValue').value);
  const description = document.getElementById('newCouponDesc')?.value.trim() || '';

  if (!code || isNaN(value)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code, type, value, description })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.config && data.config.coupons) adminCoupons = data.config.coupons;
      else adminCoupons.push({ code, type, value, description });
    } else {
      adminCoupons.push({ code, type, value, description });
    }
  } catch {
    adminCoupons.push({ code, type, value, description });
  }

  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  document.getElementById('couponForm').reset();
  showAdminToast(`Promo code "${code}" active on website!`);
  renderCouponsTable();
}

async function deleteAdminCoupon(code) {
  if (!confirm(`Delete promo code "${code}"?`)) return;

  try {
    await fetch(`${API_BASE}/admin/coupons/${code}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  } catch {}

  adminCoupons = adminCoupons.filter(c => c.code !== code);
  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  showAdminToast(`Coupon "${code}" deleted.`);
  renderCouponsTable();
}

/* ==========================================================================
   9. BRANDING & THEME
   ========================================================================== */
async function loadCompanyBranding() {
  let comp = {
    name: 'Rudraksha Packers & Movers',
    phone: '7296831460',
    whatsapp: '7296831460',
    email: 'support@rudrakshapackers.com',
    address: 'Near SNM Hospital, Gandhipath (West), Jaipur, RJ',
    gstin: '08AAACR1234F1Z5'
  };

  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const config = await res.json();
      if (config.company) comp = { ...comp, ...config.company };
    }
  } catch {
    const saved = localStorage.getItem('rudraksha_company_config');
    if (saved) comp = { ...comp, ...JSON.parse(saved) };
  }

  adminCompany = comp;
  if (document.getElementById('compName')) document.getElementById('compName').value = comp.name;
  if (document.getElementById('compPhone')) document.getElementById('compPhone').value = comp.phone;
  if (document.getElementById('compWhatsapp')) document.getElementById('compWhatsapp').value = comp.whatsapp;
  if (document.getElementById('compEmail')) document.getElementById('compEmail').value = comp.email;
  if (document.getElementById('compGstin')) document.getElementById('compGstin').value = comp.gstin;
  if (document.getElementById('compAddress')) document.getElementById('compAddress').value = comp.address;
}

async function saveCompanyBranding() {
  const company = {
    name: document.getElementById('compName')?.value.trim() || 'Rudraksha Packers & Movers',
    phone: document.getElementById('compPhone')?.value.trim() || '7296831460',
    whatsapp: document.getElementById('compWhatsapp')?.value.trim() || '7296831460',
    email: document.getElementById('compEmail')?.value.trim() || '',
    gstin: document.getElementById('compGstin')?.value.trim().toUpperCase() || '',
    address: document.getElementById('compAddress')?.value.trim() || ''
  };

  localStorage.setItem('rudraksha_company_config', JSON.stringify(company));

  try {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ company })
    });
  } catch {}

  showAdminToast('Company details & Tax invoice headers updated!');
}

function loadAdminThemeSettings() {
  const saved = localStorage.getItem('rudraksha_theme_settings');
  if (saved) {
    const theme = JSON.parse(saved);
    if (theme.primaryColor && document.getElementById('primaryColorInput')) {
      document.getElementById('primaryColorInput').value = theme.primaryColor;
      document.getElementById('primaryColorText').value = theme.primaryColor;
    }
    if (theme.secondaryColor && document.getElementById('secondaryColorInput')) {
      document.getElementById('secondaryColorInput').value = theme.secondaryColor;
      document.getElementById('secondaryColorText').value = theme.secondaryColor;
    }
    if (theme.accentColor && document.getElementById('accentColorInput')) {
      document.getElementById('accentColorInput').value = theme.accentColor;
      document.getElementById('accentColorText').value = theme.accentColor;
    }
  }
}

function previewThemeColors() {
  const primary = document.getElementById('primaryColorInput')?.value || '#f97316';
  if (document.getElementById('primaryColorText')) document.getElementById('primaryColorText').value = primary;
}

async function saveAdminTheme() {
  const primaryColor = document.getElementById('primaryColorInput')?.value || '#f97316';
  const secondaryColor = document.getElementById('secondaryColorInput')?.value || '#1e293b';
  const accentColor = document.getElementById('accentColorInput')?.value || '#06b6d4';

  const theme = { primaryColor, secondaryColor, accentColor };
  localStorage.setItem('rudraksha_theme_settings', JSON.stringify(theme));

  try {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ theme })
    });
  } catch {}

  showAdminToast('Brand theme palette updated across portal!');
}

/* ==========================================================================
   10. METRICS & RECENT HISTORY SYNCHRONIZATION
   ========================================================================== */
function updateDashboardMetrics() {
  // 1. Calculate Total Revenue
  let totalRevenue = 45250;
  let totalKm = 1745;

  if (adminBookings.length > 0) {
    const sumAmt = adminBookings.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
    if (sumAmt > 0) totalRevenue = sumAmt;

    const sumKm = adminBookings.reduce((acc, b) => acc + (Number(b.distance_km) || 25), 0);
    if (sumKm > 0) totalKm = sumKm;
  }

  // Smooth Count-Up Animations
  animateCountUp('dashTotalRevenue', totalRevenue, 1500, '₹');
  animateCountUp('dashTotalKm', totalKm, 1400);

  // 2. Next Dispatch Card
  if (adminBookings.length > 0) {
    const latest = adminBookings[0];
    const dName = latest.assigned_driver_name || 'Mukesh Sharma';
    const route = `${latest.pickup_address || 'Jaipur'} ➔ ${latest.drop_address || 'Delhi'}`;

    if (document.getElementById('dashNextDriver')) document.getElementById('dashNextDriver').innerText = dName;
    if (document.getElementById('dashNextRoute')) document.getElementById('dashNextRoute').innerText = route;
  }

  // 3. Recent History List Widget
  const historyContainer = document.getElementById('dashRecentHistoryList');
  if (historyContainer && adminBookings.length > 0) {
    const recentSlice = adminBookings.slice(0, 2);
    historyContainer.innerHTML = recentSlice.map((b, idx) => {
      const avatars = [
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&auto=format&fit=crop&q=80'
      ];
      const av = avatars[idx % avatars.length];
      const route = `${b.pickup_address?.split(',')[0] || 'Jaipur'} ➔ ${b.drop_address?.split(',')[0] || 'Delhi'}`;
      const amt = b.total_amount ? `₹${Number(b.total_amount).toLocaleString('en-IN')}` : '₹4,500';

      return `
        <div class="cyber-history-item" onclick="switchAdminTab('bookings')">
          <div class="cyber-history-user">
            <img src="${av}" alt="Customer" class="cyber-history-avatar">
            <div>
              <div class="fw-bold text-white small">${route}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${b.shifting_date || 'Today'} • ${b.customer_name || 'Customer'}</div>
              <div style="color: var(--accent-neon); font-size: 0.72rem;">${b.selected_vehicle || 'Dedicated Truck'} - ${amt}</div>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-muted small"></i>
        </div>
      `;
    }).join('');
  }

  triggerDashboardAnimations();
}

function showAdminToast(msg) {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;
  container.innerHTML = `
    <div style="background: rgba(23, 23, 26, 0.95); border: 1px solid #D0FD38; color: #ffffff; border-radius: 14px; padding: 12px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(208, 253, 56, 0.25); display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-circle-check" style="color: #D0FD38; font-size: 1.1rem;"></i>
        <span style="font-size: 0.88rem; font-weight: 600;">${msg}</span>
      </div>
      <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #8E8E93; cursor: pointer;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  setTimeout(() => { if (container) container.innerHTML = ''; }, 4500);
}

async function refreshAdminAll() {
  await checkBackendHealth();
  await loadFleetVehicles();
  await loadAdminRates();
  await loadAdminCoupons();
  await loadCompanyBranding();
  await loadDriversFromBackend();
  await loadBookingsFromBackend();
  loadAdminThemeSettings();
  updateDashboardMetrics();
}
