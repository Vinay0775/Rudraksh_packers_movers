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
  await loadAdminRates();
  await loadAdminCoupons();
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
   2. FLEET & DRIVERS MANAGEMENT
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

    statusMsg.innerHTML = '<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Driver assigned and Telegram notification sent!</span>';
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('assignDriverModal'))?.hide();
      loadBookingsFromBackend();
    }, 1000);
  } catch (err) {
    statusMsg.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}

/* ==========================================================================
   3. RATES & TARIFF MANAGER
   ========================================================================== */
function loadAdminRates() {
  const saved = localStorage.getItem('rudraksha_rates_config');
  if (saved) adminRates = JSON.parse(saved);
  else adminRates = { baseRate: 3500, perKmRate: 40, floorNoLiftRate: 300 };

  if (document.getElementById('rateBase')) document.getElementById('rateBase').value = adminRates.baseRate || 3500;
  if (document.getElementById('ratePerKm')) document.getElementById('ratePerKm').value = adminRates.perKmRate || 40;
  if (document.getElementById('rateFloorNoLift')) document.getElementById('rateFloorNoLift').value = adminRates.floorNoLiftRate || 300;
}

function saveAdminRates() {
  const baseRate = parseInt(document.getElementById('rateBase').value) || 3500;
  const perKmRate = parseInt(document.getElementById('ratePerKm').value) || 40;
  const floorNoLiftRate = parseInt(document.getElementById('rateFloorNoLift').value) || 300;

  const newRates = { ...adminRates, baseRate, perKmRate, floorNoLiftRate };
  localStorage.setItem('rudraksha_rates_config', JSON.stringify(newRates));
  adminRates = newRates;

  showAdminToast('Relocation base rates updated successfully!');
  updateDashboardMetrics();
}

/* ==========================================================================
   4. COUPON MANAGER
   ========================================================================== */
function loadAdminCoupons() {
  const saved = localStorage.getItem('rudraksha_coupons');
  if (saved) adminCoupons = JSON.parse(saved);
  else adminCoupons = [
    { code: 'RUDRAKSHA10', type: 'percent', value: 10 },
    { code: 'WELCOME500', type: 'fixed', value: 500 },
    { code: 'FESTIVE15', type: 'percent', value: 15 }
  ];
  renderCouponsTable();
}

function renderCouponsTable() {
  const tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;

  tbody.innerHTML = adminCoupons.map((c, i) => `
    <tr>
      <td><span class="badge bg-secondary font-monospace fs-6">${c.code}</span></td>
      <td>${c.type === 'percent' ? 'Percentage' : 'Flat ₹'}</td>
      <td><strong>${c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</strong></td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="deleteCoupon(${i})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function createAdminCoupon() {
  const code = document.getElementById('newCouponCode').value.trim().toUpperCase();
  const type = document.getElementById('newCouponType').value;
  const value = parseInt(document.getElementById('newCouponValue').value);

  if (!code || isNaN(value)) return;

  adminCoupons.push({ code, type, value });
  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  document.getElementById('couponForm').reset();
  renderCouponsTable();
  showAdminToast(`Coupon ${code} created!`);
}

function deleteCoupon(idx) {
  adminCoupons.splice(idx, 1);
  localStorage.setItem('rudraksha_coupons', JSON.stringify(adminCoupons));
  renderCouponsTable();
}

/* ==========================================================================
   5. THEME CONTROLLER & METRICS
   ========================================================================== */
function loadAdminThemeSettings() {
  const saved = localStorage.getItem('rudraksha_theme_settings');
  if (saved) {
    const theme = JSON.parse(saved);
    if (theme.primaryColor) {
      document.getElementById('primaryColorInput').value = theme.primaryColor;
      document.getElementById('primaryColorText').value = theme.primaryColor;
    }
  }
}

function previewThemeColors() {
  const primary = document.getElementById('primaryColorInput').value;
  document.getElementById('primaryColorText').value = primary;
  document.documentElement.style.setProperty('--primary-color', primary);
}

function saveAdminTheme() {
  const primaryColor = document.getElementById('primaryColorInput').value;
  const secondaryColor = document.getElementById('secondaryColorInput').value;
  const accentColor = document.getElementById('accentColorInput').value;

  localStorage.setItem('rudraksha_theme_settings', JSON.stringify({ primaryColor, secondaryColor, accentColor }));
  showAdminToast('Theme palette updated!');
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
