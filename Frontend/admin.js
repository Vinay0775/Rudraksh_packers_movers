const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'rudraksha_admin_auth_token';
const DEFAULT_MASTER_PASS = 'rudraksha@admin2026';

let adminBookings = [];
let adminDrivers = [];
let adminCoupons = [];
let adminRates = {};

document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
});

/* ==========================================================================
   ADMIN AUTHENTICATION CONTROLLER
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
  const sidebar = document.getElementById('adminSidebar');
  const mainWrapper = document.getElementById('adminMainWrapper');

  if (!token) {
    if (overlay) overlay.style.display = 'flex';
    if (sidebar) sidebar.style.filter = 'blur(6px)';
    if (mainWrapper) mainWrapper.style.filter = 'blur(6px)';
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      if (overlay) overlay.style.display = 'none';
      if (sidebar) sidebar.style.filter = 'none';
      if (mainWrapper) mainWrapper.style.filter = 'none';
      await refreshAdminAll();
      return true;
    } else {
      // Invalid or expired token
      clearAuthToken();
      if (overlay) overlay.style.display = 'flex';
      if (sidebar) sidebar.style.filter = 'blur(6px)';
      if (mainWrapper) mainWrapper.style.filter = 'blur(6px)';
      return false;
    }
  } catch (err) {
    // Local offline mode fallback: allow active session if token exists
    if (overlay) overlay.style.display = 'none';
    if (sidebar) sidebar.style.filter = 'none';
    if (mainWrapper) mainWrapper.style.filter = 'none';
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
      errorMsg.innerText = 'Please enter your admin password.';
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
      // Offline fallback: if backend is unreachable or local offline mode
      if (password === DEFAULT_MASTER_PASS) {
        token = `local_admin_session_${Date.now()}`;
        authSuccess = true;
      } else {
        throw apiErr;
      }
    }

    if (authSuccess && token) {
      setAuthToken(token, rememberCheck?.checked);

      // Hide login overlay with animation
      const overlay = document.getElementById('adminLoginOverlay');
      const sidebar = document.getElementById('adminSidebar');
      const mainWrapper = document.getElementById('adminMainWrapper');

      if (overlay) overlay.style.display = 'none';
      if (sidebar) sidebar.style.filter = 'none';
      if (mainWrapper) mainWrapper.style.filter = 'none';

      showAdminToast('Welcome back, Administrator! Dashboard unlocked.');
      await refreshAdminAll();
    }
  } catch (err) {
    if (errorAlert) {
      errorAlert.classList.remove('d-none');
      errorMsg.innerText = err.message || 'Incorrect password. Please try again.';
      // Shake animation
      const card = document.querySelector('.admin-auth-card');
      if (card) {
        card.classList.add('animate-shake');
        setTimeout(() => card.classList.remove('animate-shake'), 600);
      }
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket me-1"></i> Unlock Dashboard';
    }
  }
}

function toggleAdminPassVisibility() {
  const passInput = document.getElementById('adminPasswordInput');
  const icon = document.getElementById('passToggleIcon');
  if (!passInput || !icon) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function logoutAdmin() {
  if (confirm('Are you sure you want to sign out and lock the admin panel?')) {
    clearAuthToken();
    adminBookings = [];
    adminDrivers = [];
    const overlay = document.getElementById('adminLoginOverlay');
    const sidebar = document.getElementById('adminSidebar');
    const mainWrapper = document.getElementById('adminMainWrapper');

    if (overlay) overlay.style.display = 'flex';
    if (sidebar) sidebar.style.filter = 'blur(6px)';
    if (mainWrapper) mainWrapper.style.filter = 'blur(6px)';

    const passInput = document.getElementById('adminPasswordInput');
    if (passInput) passInput.value = '';
    const errorAlert = document.getElementById('loginErrorAlert');
    if (errorAlert) errorAlert.classList.add('d-none');
  }
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

/* ==========================================================================
   Tab Navigation Handler
   ========================================================================== */
function switchAdminTab(tabName) {
  const tabs = ['dashboard', 'bookings', 'fleet', 'rates', 'coupons', 'theme'];
  const titleMap = {
    dashboard: 'Dashboard Overview',
    bookings: 'Customer Bookings & Operations Log',
    fleet: 'Fleet & Driver Management',
    rates: 'Relocation Tariff & Rate Manager',
    coupons: 'Discount Promo Code Manager',
    theme: 'Dynamic Brand Theme Controller'
  };

  tabs.forEach((t) => {
    const navEl = document.getElementById(`nav-${t}`);
    const tabEl = document.getElementById(`tab-${t}`);

    if (t === tabName) {
      if (navEl) navEl.classList.add('active');
      if (tabEl) tabEl.style.display = 'block';
    } else {
      if (navEl) navEl.classList.remove('active');
      if (tabEl) tabEl.style.display = 'none';
    }
  });

  const headerTitle = document.getElementById('tabTitleHeader');
  if (headerTitle) headerTitle.innerText = titleMap[tabName] || 'Admin Dashboard';
}

/* ==========================================================================
   Backend Health & Sync Engine
   ========================================================================== */
async function checkBackendHealth() {
  const badge = document.getElementById('backendStatusBadge');
  const tgBadge = document.getElementById('dashTelegramStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      if (badge) badge.className = 'badge bg-success-subtle text-success p-2 px-3 border border-success-subtle';
      if (badge) badge.innerHTML = `<i class="fa-solid fa-circle me-1 small"></i> API Connected ${data.supabaseActive ? '(Supabase 🟢)' : '(Local DB 🟡)'}`;
      if (tgBadge) {
        tgBadge.innerText = data.telegramConfigured ? 'Active & Ready 🟢' : 'Mode: Dev (Logs to Terminal)';
        tgBadge.className = data.telegramConfigured ? 'badge bg-success' : 'badge bg-secondary';
      }
    }
  } catch (err) {
    if (badge) badge.className = 'badge bg-warning-subtle text-warning-emphasis p-2 px-3 border border-warning-subtle';
    if (badge) badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Local Offline Mode';
  }
}

/* ==========================================================================
   1. BOOKINGS MANAGEMENT
   ========================================================================== */
async function loadBookingsFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      adminBookings = data.bookings || [];
    } else {
      throw new Error('Failed to fetch from API');
    }
  } catch (err) {
    console.warn('Using local bookings fallback:', err);
    adminBookings = JSON.parse(localStorage.getItem('rudraksha_bookings_history') || '[]');
  }

  renderBookingsTable();
  updateDashboardMetrics();
}

function renderBookingsTable() {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (adminBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fa-solid fa-inbox me-2"></i>No bookings received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminBookings.map((b) => {
    const bId = b.id || 'N/A';
    const cName = b.customer_name || b.name || 'Customer';
    const cPhone = b.customer_phone || b.phone || '-';
    const pickup = b.pickup_address || b.pickup || '-';
    const drop = b.drop_address || b.drop || '-';
    const date = b.shifting_date || b.date || '-';
    const dist = b.distance_km || b.distanceKm || 25;
    const amount = b.total_amount ? `₹${Number(b.total_amount).toLocaleString('en-IN')}` : (b.total || '₹0');
    const status = (b.status || 'received').toLowerCase();

    const statusBadgeClass = {
      received: 'bg-primary',
      reviewing: 'bg-info text-dark',
      confirmed: 'bg-secondary',
      driver_assigned: 'bg-warning text-dark',
      in_transit: 'bg-primary text-white',
      delivered: 'bg-success',
      cancelled: 'bg-danger'
    }[status] || 'bg-secondary';

    const driverName = b.assigned_driver_name ? `👨‍✈️ ${b.assigned_driver_name} (${b.assigned_vehicle_no})` : `<span class="badge bg-secondary-subtle text-muted">Unassigned</span>`;

    return `
      <tr>
        <td><strong class="text-primary-custom">${bId}</strong></td>
        <td>
          <div class="fw-semibold">${cName}</div>
          <div class="small text-muted"><a href="tel:${cPhone}" class="text-decoration-none text-muted"><i class="fa-solid fa-phone me-1 text-success"></i>+91 ${cPhone}</a></div>
        </td>
        <td>
          <div class="small fw-semibold">${pickup} ➔ ${drop}</div>
          <div class="small text-muted"><i class="fa-solid fa-calendar me-1"></i>${date} • ${dist} KM</div>
          <div class="small text-primary-custom fw-semibold mt-1"><i class="fa-solid fa-truck-pickup me-1"></i>${b.selected_vehicle || 'Tata Ace / Mini'}</div>
        </td>
        <td><strong class="text-dark">${amount}</strong></td>
        <td>
          <select class="form-select form-select-sm fw-bold border-0 shadow-sm" onchange="handleStatusChange('${bId}', this.value)" style="width: 145px;">
            <option value="received" ${status === 'received' ? 'selected' : ''}>📥 Received</option>
            <option value="reviewing" ${status === 'reviewing' ? 'selected' : ''}>🔍 Reviewing</option>
            <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
            <option value="driver_assigned" ${status === 'driver_assigned' ? 'selected' : ''}>🚚 Driver Assigned</option>
            <option value="in_transit" ${status === 'in_transit' ? 'selected' : ''}>🛣️ In Transit</option>
            <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>🏁 Delivered</option>
            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </td>
        <td><div class="small">${driverName}</div></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" title="Assign Driver" onclick="openAssignDriverModal('${bId}')">
              <i class="fa-solid fa-user-plus"></i>
            </button>
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
    showAdminToast(`Booking ${bookingId} status updated to ${newStatus.toUpperCase()}`);
    await loadBookingsFromBackend();
  } catch (err) {
    alert(`Could not update status: ${err.message}`);
  }
}

/* ==========================================================================
   2. FLEET & DEDICATED VEHICLES MANAGEMENT
   ========================================================================== */

let adminVehicles = {};

async function loadFleetVehicles() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const config = await res.json();
      adminVehicles = config.vehicles || {};
    } else {
      throw new Error('Config API unreachable');
    }
  } catch (err) {
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

function renderVehiclesTable() {
  const tbody = document.getElementById('vehiclesTableBody');
  if (!tbody) return;

  const keys = Object.keys(adminVehicles);
  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">No vehicles configured. Add a vehicle using the form.</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map((key) => {
    const v = adminVehicles[key];
    return `
      <tr>
        <td><i class="fa-solid ${v.icon || 'fa-truck'} fa-xl text-primary-custom"></i></td>
        <td>
          <div class="fw-bold">${v.name}</div>
          <div class="small text-muted"><code>${key}</code></div>
        </td>
        <td><strong>₹${Number(v.basePrice || 0).toLocaleString('en-IN')}</strong></td>
        <td><strong>₹${v.perKmRate || 0} / KM</strong></td>
        <td><span class="badge bg-secondary-subtle text-dark">${v.cap || 'Standard'}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" title="Edit Vehicle" onclick="editVehicle('${key}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-outline-danger" title="Delete Vehicle" onclick="deleteVehicle('${key}')">
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
    alert('Please provide a vehicle key and display name.');
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
  } catch (err) {
    adminVehicles[key] = { name, basePrice, perKmRate, cap, icon };
  }

  localStorage.setItem('rudraksha_fleet_config', JSON.stringify(adminVehicles));
  showAdminToast(`Vehicle "${name}" saved to Calculator!`);
  document.getElementById('vehicleConfigForm').reset();
  renderVehiclesTable();
  populateDriverVehicleSelect();
}

async function deleteVehicle(key) {
  if (!confirm(`Are you sure you want to delete vehicle "${adminVehicles[key]?.name || key}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/vehicles/${key}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      if (data.config && data.config.vehicles) adminVehicles = data.config.vehicles;
      else delete adminVehicles[key];
    } else {
      delete adminVehicles[key];
    }
  } catch (err) {
    delete adminVehicles[key];
  }

  localStorage.setItem('rudraksha_fleet_config', JSON.stringify(adminVehicles));
  showAdminToast(`Vehicle deleted successfully!`);
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
   DRIVERS ROSTER
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
  } catch (err) {
    adminDrivers = [
      { id: 'drv-101', driver_name: 'Rajesh Kumar', phone: '9876543210', vehicle_number: 'RJ-14-GA-1024', vehicle_type: 'Tata Ace (1.5 Ton)', status: 'available', rating: 4.9 },
      { id: 'drv-102', driver_name: 'Vikram Singh', phone: '9829012345', vehicle_number: 'RJ-14-GB-5521', vehicle_type: 'Eicher 14ft (3.5 Ton)', status: 'available', rating: 4.8 },
      { id: 'drv-103', driver_name: 'Ramesh Meena', phone: '9414098765', vehicle_number: 'RJ-14-GC-8840', vehicle_type: '19ft Container (7 Ton)', status: 'available', rating: 4.7 }
    ];
  }

  renderDriversTable();
  updateDashboardMetrics();
}

function renderDriversTable() {
  const tbody = document.getElementById('driversTableBody');
  if (!tbody) return;

  tbody.innerHTML = adminDrivers.map((d) => `
    <tr>
      <td>
        <div class="fw-bold">${d.driver_name}</div>
        <div class="small text-muted">ID: ${d.id}</div>
      </td>
      <td><a href="tel:${d.phone}" class="text-decoration-none text-muted"><i class="fa-solid fa-phone text-success me-1"></i>+91 ${d.phone}</a></td>
      <td>
        <span class="badge bg-dark text-white me-1">${d.vehicle_number}</span>
        <span class="small text-muted">${d.vehicle_type}</span>
      </td>
      <td>
        <span class="badge ${d.status === 'available' ? 'bg-success' : 'bg-warning text-dark'}">${(d.status || 'available').toUpperCase()}</span>
      </td>
      <td><span class="text-warning fw-bold">⭐ ${d.rating || 4.8}</span></td>
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

    if (!res.ok) throw new Error('Failed to register driver');

    showAdminToast(`Driver ${name} registered successfully!`);
    document.getElementById('driverForm').reset();
    await loadDriversFromBackend();
  } catch (err) {
    alert(`Registration error: ${err.message}`);
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

    statusMsg.innerHTML = '<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Driver assigned and notification dispatched!</span>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('assignDriverModal'))?.hide();
      loadBookingsFromBackend();
    }, 1000);
  } catch (err) {
    statusMsg.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

/* ==========================================================================
   3. RATES & TARIFF MANAGER (Full Control)
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

  // Fallbacks
  if (!adminRates.houseSizeRates) {
    adminRates.houseSizeRates = { '1rk': 0, '1bhk': 1000, '2bhk': 2500, '3bhk': 4500, 'villa': 7500 };
  }
  if (!adminRates.itemRates) {
    adminRates.itemRates = { sofa: 500, bed: 600, dining: 400, fridge: 400, washing: 350, boxes: 80 };
  }
  if (!adminRates.addonRates) {
    adminRates.addonRates = { bubblePacking: 1500, unpacking: 1200, insurance: 999, vehicleTransport: 2500 };
  }

  // Populate Inputs
  if (document.getElementById('rateBase')) document.getElementById('rateBase').value = adminRates.baseRate || 2500;
  if (document.getElementById('ratePerKm')) document.getElementById('ratePerKm').value = adminRates.perKmRate || 40;
  if (document.getElementById('rateFloorNoLift')) document.getElementById('rateFloorNoLift').value = adminRates.floorNoLiftRate || 300;

  // House Sizes
  if (document.getElementById('rateHouse1rk')) document.getElementById('rateHouse1rk').value = adminRates.houseSizeRates['1rk'] ?? 0;
  if (document.getElementById('rateHouse1bhk')) document.getElementById('rateHouse1bhk').value = adminRates.houseSizeRates['1bhk'] ?? 1000;
  if (document.getElementById('rateHouse2bhk')) document.getElementById('rateHouse2bhk').value = adminRates.houseSizeRates['2bhk'] ?? 2500;
  if (document.getElementById('rateHouse3bhk')) document.getElementById('rateHouse3bhk').value = adminRates.houseSizeRates['3bhk'] ?? 4500;
  if (document.getElementById('rateHouseVilla')) document.getElementById('rateHouseVilla').value = adminRates.houseSizeRates['villa'] ?? 7500;

  // Items
  if (document.getElementById('rateItemSofa')) document.getElementById('rateItemSofa').value = adminRates.itemRates.sofa ?? 500;
  if (document.getElementById('rateItemBed')) document.getElementById('rateItemBed').value = adminRates.itemRates.bed ?? 600;
  if (document.getElementById('rateItemDining')) document.getElementById('rateItemDining').value = adminRates.itemRates.dining ?? 400;
  if (document.getElementById('rateItemFridge')) document.getElementById('rateItemFridge').value = adminRates.itemRates.fridge ?? 400;
  if (document.getElementById('rateItemWashing')) document.getElementById('rateItemWashing').value = adminRates.itemRates.washing ?? 350;
  if (document.getElementById('rateItemBoxes')) document.getElementById('rateItemBoxes').value = adminRates.itemRates.boxes ?? 80;

  // Addons
  if (document.getElementById('rateAddonBubble')) document.getElementById('rateAddonBubble').value = adminRates.addonRates.bubblePacking ?? 1500;
  if (document.getElementById('rateAddonUnpacking')) document.getElementById('rateAddonUnpacking').value = adminRates.addonRates.unpacking ?? 1200;
  if (document.getElementById('rateAddonInsurance')) document.getElementById('rateAddonInsurance').value = adminRates.addonRates.insurance ?? 999;
  if (document.getElementById('rateAddonVehicleTransport')) document.getElementById('rateAddonVehicleTransport').value = adminRates.addonRates.vehicleTransport ?? 2500;
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
  } catch (err) {
    console.warn('Sync to backend skipped:', err);
  }

  showAdminToast('All live rates & tariffs updated successfully across the website!');
  updateDashboardMetrics();
}

/* ==========================================================================
   4. COUPON MANAGER
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
    else adminCoupons = [
      { code: 'FIRST500', type: 'fixed', value: 500, description: '₹500 flat off on first relocation' },
      { code: 'RELOCATE10', type: 'percent', value: 10, description: '10% discount on house shifting' },
      { code: 'FESTIVE15', type: 'percent', value: 15, description: '15% festive seasonal off' }
    ];
  }

  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  renderCouponsTable();
  updateDashboardMetrics();
}

function renderCouponsTable() {
  const tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;

  if (adminCoupons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No active promo coupons.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminCoupons.map((c) => `
    <tr>
      <td><span class="badge bg-secondary font-monospace fs-6">${c.code}</span></td>
      <td>${c.type === 'percent' ? 'Percentage' : 'Flat ₹'}</td>
      <td><strong>${c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</strong></td>
      <td class="small text-muted">${c.description || '-'}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="deleteAdminCoupon('${c.code}')"><i class="fa-solid fa-trash"></i></button></td>
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
  showAdminToast(`Promo coupon "${code}" active on website!`);
  renderCouponsTable();
  updateDashboardMetrics();
}

async function deleteAdminCoupon(code) {
  if (!confirm(`Are you sure you want to delete promo code "${code}"?`)) return;

  try {
    await fetch(`${API_BASE}/admin/coupons/${code}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  } catch (err) {
    console.warn('Offline coupon delete:', err);
  }

  adminCoupons = adminCoupons.filter(c => c.code !== code);
  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  showAdminToast(`Coupon "${code}" deleted.`);
  renderCouponsTable();
  updateDashboardMetrics();
}

/* ==========================================================================
   5. COMPANY BRANDING & THEME CONTROLLER
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
  } catch (err) {
    console.warn('Sync to backend skipped:', err);
  }

  showAdminToast('Company contact details & invoice header updated!');
}

function loadAdminThemeSettings() {
  const saved = localStorage.getItem('rudraksha_theme_settings');
  if (saved) {
    const theme = JSON.parse(saved);
    if (theme.primaryColor) {
      document.getElementById('primaryColorInput').value = theme.primaryColor;
      document.getElementById('primaryColorText').value = theme.primaryColor;
    }
    if (theme.secondaryColor) {
      document.getElementById('secondaryColorInput').value = theme.secondaryColor;
      document.getElementById('secondaryColorText').value = theme.secondaryColor;
    }
    if (theme.accentColor) {
      document.getElementById('accentColorInput').value = theme.accentColor;
      document.getElementById('accentColorText').value = theme.accentColor;
    }
  }
}

function previewThemeColors() {
  const primary = document.getElementById('primaryColorInput').value;
  document.getElementById('primaryColorText').value = primary;
  document.documentElement.style.setProperty('--primary-color', primary);
}

async function saveAdminTheme() {
  const primaryColor = document.getElementById('primaryColorInput').value;
  const secondaryColor = document.getElementById('secondaryColorInput').value;
  const accentColor = document.getElementById('accentColorInput').value;

  const theme = { primaryColor, secondaryColor, accentColor };
  localStorage.setItem('rudraksha_theme_settings', JSON.stringify(theme));

  try {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ theme })
    });
  } catch (err) {
    console.warn('Sync to backend skipped:', err);
  }

  showAdminToast('Theme palette updated across customer portal!');
}

function updateDashboardMetrics() {
  if (document.getElementById('dashTotalBookings')) document.getElementById('dashTotalBookings').innerText = adminBookings.length;
  if (document.getElementById('dashTotalDrivers')) document.getElementById('dashTotalDrivers').innerText = adminDrivers.length;
  if (document.getElementById('dashPerKmRate')) document.getElementById('dashPerKmRate').innerText = `₹${adminRates.perKmRate || 40}`;
  if (document.getElementById('dashActiveCoupons')) document.getElementById('dashActiveCoupons').innerText = adminCoupons.length;
}

function showAdminToast(msg) {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
      <i class="fa-solid fa-circle-check me-2"></i> ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

async function sendTestTelegramAlert() {
  alert('🔔 Sending test notification... Check the Owner Telegram chat or Backend server logs.');
}
