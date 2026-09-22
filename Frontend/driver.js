/* ==========================================================================
   RUDRAKSHA RIDER PARTNER APP ENGINE v3.0 | ENTERPRISE LOGISTICS
   Full Data Isolation • Profile Photo Upload • Daily Earnings Wallet • PWA
   ========================================================================== */

const isLocalhostDriver = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const DRIVER_API_BASE = isLocalhostDriver ? 'http://localhost:3000/api' : 'https://rudraksha-packers-movers.onrender.com/api';

const RIDER_TOKEN_KEY = 'rudraksha_rider_token';
const RIDER_SESSION_KEY = 'rudraksha_driver_session';

// Bulletproof Global Avatar Storage Identifier
window.AVATAR_PREFIX = window.AVATAR_PREFIX || 'rudraksha_rider_avatar_';
window.Avatar_prefix = window.Avatar_prefix || 'rudraksha_rider_avatar_';
var AVATAR_PREFIX = window.AVATAR_PREFIX;
var Avatar_prefix = window.Avatar_prefix;

function getAvatarStoragePrefix() {
  try {
    return window.AVATAR_PREFIX || window.Avatar_prefix || 'rudraksha_rider_avatar_';
  } catch {
    return 'rudraksha_rider_avatar_';
  }
}

// Active Rider State
let currentDriver = null;
let currentActiveTrip = null;
let currentOtpMode = 'pickup'; // 'pickup' or 'delivery'
let currentOtpParcelId = null;
let feedAutoRefreshTimer = null;
let deferredInstallPrompt = null;

/* ==========================================================================
   1. INITIALIZATION & AUTHENTICATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  initPwaInstallIcon();
  initOtpDigitInputs();

  const isAuth = await checkDriverAuth();
  if (isAuth) {
    onRiderAuthSuccess();
  } else {
    showLoginOverlay();
  }

  // Periodic Auto-refresh for live orders & dispatch (every 8 seconds)
  feedAutoRefreshTimer = setInterval(() => {
    if (getRiderToken()) {
      loadDriverFeed(false);
    }
  }, 8000);
});

function getRiderToken() {
  return localStorage.getItem(RIDER_TOKEN_KEY) || sessionStorage.getItem(RIDER_TOKEN_KEY);
}

function getRiderHeaders() {
  const token = getRiderToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function showLoginOverlay() {
  const overlay = document.getElementById('driverLoginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('driverLoginOverlay');
  if (overlay) {
    overlay.style.transition = 'all 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.opacity = '1';
    }, 300);
  }
}

function getActiveRiderAvatar() {
  if (!currentDriver) return null;
  try {
    const cleanPhone = String(currentDriver.phone || '').replace(/\D/g, '');
    const prefix = getAvatarStoragePrefix();
    return currentDriver.avatar_url || (cleanPhone ? localStorage.getItem(prefix + cleanPhone) : null);
  } catch {
    return currentDriver.avatar_url || null;
  }
}

/**
 * Validate current session with backend /api/rider/me
 */
async function checkDriverAuth() {
  const token = getRiderToken();
  const cachedSession = localStorage.getItem(RIDER_SESSION_KEY);

  if (cachedSession) {
    try {
      currentDriver = JSON.parse(cachedSession);
      const cleanPhone = String(currentDriver?.phone || '').replace(/\D/g, '');
      if (cleanPhone) {
        const prefix = getAvatarStoragePrefix();
        const localAvatar = localStorage.getItem(prefix + cleanPhone);
        if (localAvatar && !currentDriver.avatar_url) {
          currentDriver.avatar_url = localAvatar;
        }
      }
    } catch {}
  }

  if (!token) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${DRIVER_API_BASE}/rider/me`, {
      headers: getRiderHeaders(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.rider) {
        try {
          const cleanPhone = String(data.rider.phone || currentDriver?.phone || '').replace(/\D/g, '');
          const prefix = getAvatarStoragePrefix();
          const savedAvatar = cleanPhone ? localStorage.getItem(prefix + cleanPhone) : null;

          // Preserve avatar_url: if backend provided one, keep and store it; otherwise restore from local persistent avatar!
          if (data.rider.avatar_url) {
            if (cleanPhone) localStorage.setItem(prefix + cleanPhone, data.rider.avatar_url);
          } else if (savedAvatar) {
            data.rider.avatar_url = savedAvatar;
          } else if (currentDriver?.avatar_url) {
            data.rider.avatar_url = currentDriver.avatar_url;
            if (cleanPhone) localStorage.setItem(prefix + cleanPhone, currentDriver.avatar_url);
          }
        } catch (e) {
          console.warn('Avatar sync non-critical warning:', e);
        }

        currentDriver = data.rider;
        localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(currentDriver));
        return true;
      }
    }
  } catch (err) {
    // If backend timeout, allow cached session if valid token exists
    if (currentDriver && currentDriver.id) {
      return true;
    }
  }

  return Boolean(currentDriver && currentDriver.id);
}

function onRiderAuthSuccess() {
  hideLoginOverlay();
  renderNavProfile();
  renderDriverProfileView();
  loadDriverEarnings();
  loadDriverFeed(true);
}

async function submitDriverLogin() {
  const phoneInput = document.getElementById('loginDriverPhone')?.value.trim().replace(/\D/g, '');
  const pinInput = document.getElementById('loginDriverPin')?.value.trim();
  const rememberCheck = document.getElementById('rememberDriverCheck')?.checked;
  const errorEl = document.getElementById('loginErrorMsg');
  const btnLogin = document.getElementById('btnLoginDriver');

  if (!phoneInput || phoneInput.length < 10) {
    if (errorEl) {
      errorEl.innerText = 'Please enter a valid 10-digit mobile number.';
      errorEl.style.display = 'block';
    }
    return;
  }
  if (!pinInput || pinInput.length < 4) {
    if (errorEl) {
      errorEl.innerText = 'Please enter your 4-digit security PIN.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (errorEl) errorEl.style.display = 'none';
  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Logging in...';
  }

  try {
    let authSuccess = false;
    let driverData = null;
    let token = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${DRIVER_API_BASE}/rider/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, pin: pinInput }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        authSuccess = true;
        driverData = data.driver;
        token = data.token;
      } else if (res.status === 401 || res.status === 403 || res.status === 400) {
        throw new Error(data.error || 'Access Denied: Invalid phone or PIN.');
      }
    } catch (networkErr) {
      if (networkErr.message && networkErr.message.includes('Access Denied')) throw networkErr;
    }

    // Local Fallback Authorization if backend is sleeping or waking up
    if (!authSuccess) {
      const approvedList = JSON.parse(localStorage.getItem('rudraksha_approved_drivers') || '[]');
      const appsList = JSON.parse(localStorage.getItem('rudraksha_rider_applications') || '[]');
      
      const foundApproved = approvedList.find(d => String(d.driver_phone || d.phone || '').replace(/\D/g, '') === phoneInput);
      const foundApp = appsList.find(a => String(a.phone || '').replace(/\D/g, '') === phoneInput);

      if (foundApproved) {
        if (foundApproved.pin && String(foundApproved.pin).trim() !== pinInput) {
          throw new Error('❌ Incorrect Security PIN. Please enter the 4-digit PIN sent to your WhatsApp.');
        }
        driverData = {
          id: foundApproved.id || `RDR-${phoneInput.slice(-4)}`,
          driver_name: foundApproved.driver_name || foundApproved.name || 'Rider Partner',
          phone: phoneInput,
          vehicle_type: foundApproved.vehicle_type || 'Bike',
          vehicle_number: foundApproved.vehicle_number || '',
          status: 'Active',
          onDuty: true
        };
        token = `local_token_${phoneInput}_${Date.now()}`;
        authSuccess = true;
      } else if (foundApp && foundApp.status === 'Approved') {
        if (foundApp.pin && String(foundApp.pin).trim() !== pinInput) {
          throw new Error('❌ Incorrect Security PIN. Please check your WhatsApp approval message.');
        }
        driverData = {
          id: foundApp.driverId || `RDR-${phoneInput.slice(-4)}`,
          driver_name: foundApp.name,
          phone: phoneInput,
          vehicle_type: foundApp.vehType || 'Bike',
          vehicle_number: foundApp.vehNum || '',
          status: 'Active',
          onDuty: true
        };
        token = `local_token_${phoneInput}_${Date.now()}`;
        authSuccess = true;
      } else if (foundApp && foundApp.status === 'Pending') {
        throw new Error('⏳ Your driver application is under review. You will receive your PIN on WhatsApp once approved.');
      } else if (foundApp && foundApp.status === 'Rejected') {
        throw new Error('❌ Your driver application was declined. Please contact Rudraksha Support at +91 7296831460.');
      } else {
        throw new Error(`❌ No approved driver account found for +91 ${phoneInput}. Please register as a rider partner first.`);
      }
    }

    // Save persistent avatar
    try {
      const cleanPhone = String(driverData?.phone || phoneInput).replace(/\D/g, '');
      const prefix = getAvatarStoragePrefix();
      const savedAvatar = cleanPhone ? localStorage.getItem(prefix + cleanPhone) : null;
      if (savedAvatar && !driverData.avatar_url) {
        driverData.avatar_url = savedAvatar;
      }
    } catch {}

    const storage = rememberCheck ? localStorage : sessionStorage;
    storage.setItem(RIDER_TOKEN_KEY, token);
    localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(driverData));
    currentDriver = driverData;

    showToast(`🎉 Welcome, ${currentDriver.driver_name || 'Rider'}!`, 'success');
    onRiderAuthSuccess();
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = err.message || 'Login failed. Please verify your phone & PIN.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket me-2"></i> Login to Driver Dashboard';
    }
  }
}

/**
 * Rider Logout
 */
function logoutDriver() {
  if (confirm('Are you sure you want to log out from Rudraksha Rider?')) {
    localStorage.removeItem(RIDER_TOKEN_KEY);
    sessionStorage.removeItem(RIDER_TOKEN_KEY);
    localStorage.removeItem(RIDER_SESSION_KEY);
    currentDriver = null;
    currentActiveTrip = null;
    showLoginOverlay();
    showToast('👋 Successfully logged out. Stay safe on the road!', 'info');
  }
}

/* ==========================================================================
   2. PWA INSTALL ACTION ICON & DIRECT DOWNLOAD
   ========================================================================== */
const isStandaloneDriver = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function initPwaInstallIcon() {
  // 1. Service worker already registered in driver.html head; ensure update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg && reg.update) reg.update();
    }).catch(() => {});
  }

  // 2. Intercept install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window._driverInstallPrompt = e;
    console.log('[Rider PWA] Native install prompt captured!');
    if (window._waitingForDriverInstall) {
      window._waitingForDriverInstall = false;
      triggerPwaInstall();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window._driverInstallPrompt = null;
    closeDriverInstallModal();
    showToast('🚀 Rudraksha Rider Partner App installed on your device!', 'success');
  });
}

/**
 * Universal Infallible Driver PWA Installer
 * Works on Android Chrome, Samsung Internet, iOS Safari, and WhatsApp In-App Webviews
 */
async function triggerPwaInstall() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    showToast('✅ App pehle se hi aapke phone me installed hai!', 'success');
    return;
  }

  // 1. Check if native prompt is immediately available
  const nativePrompt = window._driverInstallPrompt || deferredInstallPrompt;
  if (nativePrompt) {
    try {
      await nativePrompt.prompt();
      const choice = await nativePrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        showToast('🎉 Rudraksha Driver App successfully installed!', 'success');
        window._driverInstallPrompt = null;
        deferredInstallPrompt = null;
        closeDriverInstallModal();
        return;
      }
    } catch (err) {
      console.warn('Native prompt error:', err);
    }
  }

  // 2. Wait briefly (up to 350ms) in case beforeinstallprompt was pending
  window._waitingForDriverInstall = true;
  const promptArrived = await new Promise((resolve) => {
    if (window._driverInstallPrompt || deferredInstallPrompt) return resolve(true);
    const timer = setTimeout(() => resolve(false), 350);
    const onPrompt = () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      resolve(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt, { once: true });
  });
  window._waitingForDriverInstall = false;

  if (promptArrived) {
    const freshPrompt = window._driverInstallPrompt || deferredInstallPrompt;
    if (freshPrompt) {
      try {
        await freshPrompt.prompt();
        const choice = await freshPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showToast('🎉 Rudraksha Driver App successfully installed!', 'success');
          window._driverInstallPrompt = null;
          deferredInstallPrompt = null;
          closeDriverInstallModal();
          return;
        }
      } catch (err) {}
    }
  }

  // 3. Guaranteed UI Fallback: Open Universal Installation Modal
  openDriverInstallModal();
}

function openDriverInstallModal() {
  const overlay = document.getElementById('driverInstallOverlay');
  const body = document.getElementById('driverInstallModalBody');
  if (!overlay || !body) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isWebview = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Telegram/i.test(navigator.userAgent);
  const nativePrompt = window._driverInstallPrompt || deferredInstallPrompt;

  let html = '';

  if (isWebview) {
    // A. WhatsApp / In-App Browser (Blocked from direct PWA download)
    html = `
      <div style="background: rgba(239,68,68,0.12); border: 1.5px solid rgba(239,68,68,0.3); border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="font-weight: 800; font-size: 0.88rem; color: #f87171; display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <i class="fa-brands fa-whatsapp text-danger"></i> WhatsApp Browser Detected
        </div>
        <p style="font-size: 0.78rem; color: #cbd5e1; margin: 0; line-height: 1.45;">
          WhatsApp ke andar direct app install nahi ho sakti. Neeche diye button par click karke <strong>Google Chrome me kholein</strong> aur 1 tap me install karein!
        </p>
      </div>

      <button type="button" onclick="openInAndroidChrome()" style="width: 100%; background: linear-gradient(135deg, #f97316, #ea580c); border: none; color: #fff; border-radius: 14px; padding: 14px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 18px rgba(249,115,22,0.45); margin-bottom: 12px;">
        <i class="fa-brands fa-chrome"></i>
        <span>🚀 Google Chrome me Kholein & Install Karein</span>
      </button>
    `;
  } else if (isIOS) {
    // B. Apple iOS (Safari)
    html = `
      <p style="font-size: 0.82rem; color: #cbd5e1; margin-bottom: 14px; line-height: 1.4;">
        iPhone Safari me Driver App install karne ke liye ye 3 aasan steps karein:
      </p>

      <div class="install-step-box">
        <div class="install-step-num">1</div>
        <div style="flex: 1;">Safari browser me screen ke bilkul niche <strong>Share icon ( <i class="fa-solid fa-arrow-up-from-bracket" style="color:#38bdf8;"></i> )</strong> par tap karein.</div>
      </div>

      <div class="install-step-box">
        <div class="install-step-num">2</div>
        <div style="flex: 1;">Options me thoda niche scroll karke <strong>'Add to Home Screen' ( <i class="fa-regular fa-square-plus" style="color:#22c55e;"></i> )</strong> chunein.</div>
      </div>

      <div class="install-step-box">
        <div class="install-step-num">3</div>
        <div style="flex: 1;">Upar right side me <strong>'Add'</strong> dabayein — Driver App aapke iPhone par turant install ho jayegi!</div>
      </div>
    `;
  } else {
    // C. Android Chrome / Desktop / Any browser
    html = `
      ${nativePrompt ? `
        <button type="button" onclick="executeNativeInstallPrompt()" style="width: 100%; background: linear-gradient(135deg, #22c55e, #16a34a); border: none; color: #fff; border-radius: 14px; padding: 14px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 18px rgba(34,197,94,0.45); margin-bottom: 14px;">
          <i class="fa-solid fa-circle-down"></i>
          <span>📲 Direct Install Dialog Kholein</span>
        </button>
      ` : ''}

      <p style="font-size: 0.82rem; color: #cbd5e1; margin-bottom: 14px; line-height: 1.4;">
        Mobile phone me direct install karne ke liye ye steps follow karein:
      </p>

      <div class="install-step-box">
        <div class="install-step-num">1</div>
        <div style="flex: 1;">Browser ke upar right corner me <strong>3 Dots ( <i class="fa-solid fa-ellipsis-vertical" style="color:#f97316;"></i> ) Menu</strong> par tap karein.</div>
      </div>

      <div class="install-step-box">
        <div class="install-step-num">2</div>
        <div style="flex: 1;">Menu me <strong>'Install app'</strong> ya <strong>'Add to Home screen'</strong> par tap karein.</div>
      </div>

      <div class="install-step-box">
        <div class="install-step-num">3</div>
        <div style="flex: 1;"><strong>'Install'</strong> dabayein — Rudraksha Rider Partner App aapke phone me turant install ho jayegi!</div>
      </div>
    `;
  }

  body.innerHTML = html;
  overlay.classList.add('active');
}

function closeDriverInstallModal() {
  const overlay = document.getElementById('driverInstallOverlay');
  if (overlay) overlay.classList.remove('active');
}

function openInAndroidChrome() {
  const currentUrl = window.location.href;
  const noProto = currentUrl.replace(/^https?:\/\//, '');
  const chromeIntent = `intent://${noProto}#Intent;scheme=https;package=com.android.chrome;end`;
  window.location.href = chromeIntent;
  setTimeout(() => {
    copyDriverAppLink();
  }, 1200);
}

function copyDriverAppLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('📋 Link copied! Paste in Chrome browser to install.', 'success');
  }).catch(() => {
    showToast(`App Link: ${url}`, 'info');
  });
}

async function executeNativeInstallPrompt() {
  const prompt = window._driverInstallPrompt || deferredInstallPrompt;
  if (prompt) {
    try {
      closeDriverInstallModal();
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        showToast('🎉 Rudraksha Driver App successfully installed!', 'success');
      }
      window._driverInstallPrompt = null;
      deferredInstallPrompt = null;
    } catch (err) {
      console.warn('Native prompt error:', err);
    }
  } else {
    showToast('Chrome Menu (⋮) ➔ "Install app" dabayein', 'info');
  }
}

/* ==========================================================================
   3. PROFILE & PHOTO UPLOAD (Camera / Gallery Support)
   ========================================================================== */
function renderNavProfile() {
  if (!currentDriver) return;
  const nameEl = document.getElementById('navDriverName');
  const vehEl = document.getElementById('navVehicleInfo');
  const avatarImg = document.getElementById('navAvatarImg');
  const avatarIcon = document.getElementById('navAvatarIcon');

  if (nameEl) nameEl.innerText = currentDriver.driver_name || 'Rudraksha Rider';
  if (vehEl) vehEl.innerText = `${currentDriver.vehicle_type || 'Vehicle'} • ${currentDriver.vehicle_number || '-'}`;

  const activeAvatar = getActiveRiderAvatar();
  if (activeAvatar) {
    if (avatarImg) {
      avatarImg.src = activeAvatar;
      avatarImg.style.display = 'block';
      avatarImg.onerror = () => {
        avatarImg.style.display = 'none';
        if (avatarIcon) avatarIcon.style.display = 'block';
      };
    }
    if (avatarIcon) avatarIcon.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarIcon) avatarIcon.style.display = 'block';
  }

  updateDutyDisplay();
}

function renderDriverProfileView() {
  if (!currentDriver) return;

  const pName = document.getElementById('profileRiderName');
  const pPhone = document.getElementById('profileRiderPhone');
  const pVeh = document.getElementById('profileRiderVehicle');
  const pDl = document.getElementById('profileDlNumber');
  const pCity = document.getElementById('profileCityShift');
  const pAvatar = document.getElementById('profileAvatarImg');
  const logPhone = document.getElementById('logoutPhoneLabel');

  if (pName) pName.innerText = currentDriver.driver_name || 'Rider Partner';
  if (pPhone) pPhone.innerText = currentDriver.phone ? `+91 ${currentDriver.phone}` : '-';
  if (pVeh) pVeh.innerText = `${currentDriver.vehicle_type || 'Fleet'} • ${currentDriver.vehicle_number || '-'}`;
  if (pDl) pDl.innerText = currentDriver.dl_number || 'RJ14-VERIFIED';
  if (pCity) pCity.innerText = `${currentDriver.city || 'Jaipur'} • ${currentDriver.shift || 'Full Time'}`;
  if (logPhone) logPhone.innerText = currentDriver.phone ? `+91 ${currentDriver.phone}` : '-';

  const activeAvatar = getActiveRiderAvatar();
  if (pAvatar && activeAvatar) {
    pAvatar.src = activeAvatar;
    pAvatar.onerror = () => { pAvatar.src = 'logo.png'; };
  }

  updateDutyDisplay();
}

/**
 * Handle Camera / Gallery Photo Upload
 * 1. Compresses image on canvas
 * 2. Uploads to Free Image Cloud Hosting (ImgBB CDN) to keep zero load on website
 * 3. Saves lightweight Cloud URL to backend and persistent local storage
 */
async function uploadToCloudImageHost(base64Data) {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const formData = new FormData();
    formData.append('image', cleanBase64);

    // Free ImgBB Cloud CDN API
    const res = await fetch('https://api.imgbb.com/1/upload?key=6d207e021d1221e525e9690d8012ad7b', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.data?.url) {
        console.log('✅ Image successfully saved on Cloud CDN:', data.data.url);
        return data.data.url;
      }
    }
  } catch (cloudErr) {
    console.warn('Cloud CDN upload fallback to local URI:', cloudErr);
  }
  return base64Data; // fallback to compressed data
}

function handleRiderPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  showToast('📸 Saving profile photo...', 'info');

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = async () => {
      // Compress to max 320x320 JPEG
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 320;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

      // Instantly update UI with local preview
      const pAvatar = document.getElementById('profileAvatarImg');
      const navAvatar = document.getElementById('navAvatarImg');
      const navIcon = document.getElementById('navAvatarIcon');

      if (pAvatar) {
        pAvatar.src = compressedBase64;
        pAvatar.style.display = 'block';
      }
      if (navAvatar) {
        navAvatar.src = compressedBase64;
        navAvatar.style.display = 'block';
      }
      if (navIcon) navIcon.style.display = 'none';

      // Permanently save to dedicated local persistent key by phone
      const cleanPhone = String(currentDriver?.phone || '').replace(/\D/g, '');
      const prefix = getAvatarStoragePrefix();
      if (cleanPhone) {
        localStorage.setItem(prefix + cleanPhone, compressedBase64);
      }

      if (currentDriver) {
        currentDriver.avatar_url = compressedBase64;
        localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(currentDriver));
      }

      // Update in local approved drivers & rider applications roster
      try {
        const approvedDrivers = JSON.parse(localStorage.getItem('rudraksha_approved_drivers') || '[]');
        const dIdx = approvedDrivers.findIndex(d => String(d.driver_phone || d.phone || '').replace(/\D/g, '') === cleanPhone);
        if (dIdx >= 0) {
          approvedDrivers[dIdx].avatar_url = compressedBase64;
          localStorage.setItem('rudraksha_approved_drivers', JSON.stringify(approvedDrivers));
        }

        const riderApps = JSON.parse(localStorage.getItem('rudraksha_rider_applications') || '[]');
        const aIdx = riderApps.findIndex(a => String(a.phone || '').replace(/\D/g, '') === cleanPhone);
        if (aIdx >= 0) {
          riderApps[aIdx].avatar_url = compressedBase64;
          localStorage.setItem('rudraksha_rider_applications', JSON.stringify(riderApps));
        }
      } catch (errLocal) {}

      // Try free Cloud CDN in background for smaller payload if possible
      let finalAvatarUrl = compressedBase64;
      try {
        const cloudUrl = await uploadToCloudImageHost(compressedBase64);
        if (cloudUrl && cloudUrl.startsWith('http')) {
          finalAvatarUrl = cloudUrl;
          if (cleanPhone) localStorage.setItem(prefix + cleanPhone, finalAvatarUrl);
          if (currentDriver) {
            currentDriver.avatar_url = finalAvatarUrl;
            localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(currentDriver));
          }
        }
      } catch (cErr) {}

      // Sync with backend across all devices & Admin Panel
      await syncPhotoToBackend(finalAvatarUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function syncPhotoToBackend(photoUrl) {
  const cleanPhone = String(currentDriver?.phone || '').replace(/\D/g, '');
  let synced = false;

  // 1. Send to dedicated /api/rider/avatar (updates DB + memory store immediately)
  try {
    const res = await fetch(`${DRIVER_API_BASE}/rider/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, avatar_url: photoUrl })
    });
    if (res.ok) {
      synced = true;
      showToast('✅ Face photo saved! Synced across all devices & Admin Panel.', 'success');
      return;
    }
  } catch (err1) {}

  // 2. Fallback to PATCH /api/rider/profile
  try {
    const res2 = await fetch(`${DRIVER_API_BASE}/rider/profile`, {
      method: 'PATCH',
      headers: getRiderHeaders(),
      body: JSON.stringify({ avatar_url: photoUrl })
    });
    if (res2.ok) {
      synced = true;
      showToast('✅ Profile photo updated!', 'success');
    }
  } catch (err2) {
    console.warn('Backend photo sync warning:', err2);
  }

  if (!synced) {
    showToast('Photo saved on this phone. Will sync to other devices once online.', 'info');
  }
}

function openSetupSheet() {
  const overlay = document.getElementById('setupOverlay');
  if (!overlay || !currentDriver) return;
  document.getElementById('setupName').value = currentDriver.driver_name || '';
  document.getElementById('setupPhone').value = currentDriver.phone || '';
  document.getElementById('setupVehicleNo').value = currentDriver.vehicle_number || '';
  document.getElementById('setupVehicleType').value = currentDriver.vehicle_type || '';
  overlay.classList.add('active');
}

async function saveRiderProfile() {
  const name = document.getElementById('setupName')?.value.trim();
  const vNo = document.getElementById('setupVehicleNo')?.value.trim();
  const vType = document.getElementById('setupVehicleType')?.value.trim();

  if (!name) {
    showToast('Please enter your full name.', 'error');
    return;
  }

  if (currentDriver) {
    currentDriver.driver_name = name;
    currentDriver.vehicle_number = vNo || currentDriver.vehicle_number;
    currentDriver.vehicle_type = vType || currentDriver.vehicle_type;
    localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(currentDriver));
  }

  document.getElementById('setupOverlay')?.classList.remove('active');
  renderNavProfile();
  renderDriverProfileView();

  try {
    await fetch(`${DRIVER_API_BASE}/rider/profile`, {
      method: 'PATCH',
      headers: getRiderHeaders(),
      body: JSON.stringify({
        driver_name: name,
        vehicle_number: vNo,
        vehicle_type: vType
      })
    });
    showToast('Profile saved!', 'success');
  } catch {}
}

/* ==========================================================================
   4. DUTY TOGGLE (Online / Offline)
   ========================================================================== */
async function toggleDriverDuty() {
  if (!currentDriver) return;
  const newDuty = !Boolean(currentDriver.onDuty);
  currentDriver.onDuty = newDuty;
  localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(currentDriver));

  updateDutyDisplay();

  try {
    await fetch(`${DRIVER_API_BASE}/rider/duty`, {
      method: 'PATCH',
      headers: getRiderHeaders(),
      body: JSON.stringify({ onDuty: newDuty })
    });
    showToast(newDuty ? '🟢 You are now ON DUTY! Ready to accept jobs.' : '🔴 You are now OFF DUTY.', newDuty ? 'success' : 'info');
  } catch {
    showToast(newDuty ? '🟢 On Duty (Local Mode)' : '🔴 Off Duty (Local Mode)', 'info');
  }

  loadDriverFeed(false);
}

function updateDutyDisplay() {
  if (!currentDriver) return;
  const isDuty = currentDriver.onDuty !== false;

  const navBadge = document.getElementById('navDutyBadge');
  const navPulse = document.getElementById('navDutyPulse');
  const navText = document.getElementById('navDutyText');
  const statusText = document.getElementById('profileDutyStatusText');
  const btnToggle = document.getElementById('btnToggleDuty');

  if (navBadge) {
    navBadge.style.color = isDuty ? 'var(--green)' : '#ef4444';
    navBadge.style.borderColor = isDuty ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
    navBadge.style.background = isDuty ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  }
  if (navPulse) {
    navPulse.style.background = isDuty ? 'var(--green)' : '#ef4444';
  }
  if (navText) navText.innerText = isDuty ? 'ON DUTY' : 'OFF DUTY';

  if (statusText) {
    statusText.innerText = isDuty ? '🟢 On Duty (Receiving Orders)' : '🔴 Off Duty (Not Accepting Orders)';
    statusText.style.color = isDuty ? 'var(--green)' : '#ef4444';
  }
  if (btnToggle) {
    btnToggle.innerText = isDuty ? 'Go Off Duty' : 'Go On Duty';
    btnToggle.className = isDuty ? 'btn btn-sm btn-outline-danger rounded-pill px-3 py-1 fw-bold' : 'btn btn-sm btn-outline-success rounded-pill px-3 py-1 fw-bold';
  }
}

/* ==========================================================================
   5. EARNINGS & TIME-FILTERED FINANCIAL LEDGER (100% Direct Customer Payment)
   ========================================================================== */
let allRiderTrips = [];
let allRiderEarningsData = null;
let currentEarningsFilter = '7d';

async function loadDriverEarnings() {
  if (!getRiderToken()) return;

  try {
    const res = await fetch(`${DRIVER_API_BASE}/rider/earnings`, {
      headers: getRiderHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      allRiderEarningsData = data;
      allRiderTrips = data.trips || [];

      updateEarningsUI(data);
      applyEarningsTimeFilter();
      return;
    }
  } catch (e) {
    console.warn('Earnings load offline fallback:', e);
  }

  fallbackLocalEarnings();
}

function updateEarningsUI(data) {
  const statEarn = document.getElementById('statEarnings');
  const statTrips = document.getElementById('statTrips');
  const pTotal = document.getElementById('profileTotalEarnings');
  const pTrips = document.getElementById('profileCompletedTrips');
  const pToday = document.getElementById('profileTodayEarnings');
  const jDateEl = document.getElementById('profileJoiningDate');

  const todayStr = `₹${(data.todayEarnings || 0).toLocaleString('en-IN')}`;
  const totalStr = `₹${(data.allTimeEarnings || data.totalEarnings || 0).toLocaleString('en-IN')}`;

  if (statEarn) statEarn.innerText = todayStr;
  if (statTrips) statTrips.innerText = data.completedTripsCount || 0;
  if (pTotal) pTotal.innerText = totalStr;
  if (pTrips) pTrips.innerText = data.completedTripsCount || 0;
  if (pToday) pToday.innerText = todayStr;

  // Render Date of Joining
  if (jDateEl && data.dateOfJoining) {
    const d = new Date(data.dateOfJoining);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const daysAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)));
    jDateEl.innerHTML = `<i class="fa-regular fa-calendar-check me-1"></i> Date of Joining: <strong style="color:#fff;">${dateStr}</strong> (${daysAgo === 0 ? 'Aaj jude hain' : `${daysAgo} din pehle`})`;
  }
}

/**
 * Handle Time Filter clicks: 7d, 30d, 6m, 1y, all
 */
function setTimeFilter(filterKey) {
  currentEarningsFilter = filterKey;

  // Toggle button active classes
  ['7d', '30d', '6m', '1y', 'all'].forEach(k => {
    const btn = document.getElementById(`filterBtn_${k}`);
    if (btn) {
      if (k === filterKey) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  applyEarningsTimeFilter();
}

function applyEarningsTimeFilter() {
  if (!allRiderEarningsData) return;

  const now = Date.now();
  const timeWindows = {
    '7d': { ms: 7 * 24 * 60 * 60 * 1000, label: 'Pichhle 7 din ki kamai • Customer se direct Cash/UPI mila', amount: allRiderEarningsData.last7DaysEarnings },
    '30d': { ms: 30 * 24 * 60 * 60 * 1000, label: 'Pichhle 30 din (1 Mahina) ki kamai • 100% Aapka', amount: allRiderEarningsData.last30DaysEarnings },
    '6m': { ms: 180 * 24 * 60 * 60 * 1000, label: 'Pichhle 6 mahine ki total kamai • 0% Commission', amount: allRiderEarningsData.last6MonthsEarnings },
    '1y': { ms: 365 * 24 * 60 * 60 * 1000, label: 'Pichhle 1 saal ki kamai • Complete Ledger', amount: allRiderEarningsData.last1YearEarnings },
    'all': { ms: Infinity, label: 'Jab se aap Jude hain tab se All Time kamai', amount: allRiderEarningsData.allTimeEarnings }
  };

  const selected = timeWindows[currentEarningsFilter] || timeWindows['7d'];
  const filteredValEl = document.getElementById('filteredEarningsVal');
  const filteredSubEl = document.getElementById('filteredEarningsSub');

  if (filteredValEl) {
    const amt = selected.amount !== undefined ? selected.amount : 0;
    filteredValEl.innerText = `₹${amt.toLocaleString('en-IN')}`;
  }
  if (filteredSubEl) {
    filteredSubEl.innerText = selected.label;
  }

  // Filter delivery history list according to selected window
  const cutoff = now - selected.ms;
  const filteredTrips = allRiderTrips.filter(t => {
    if (selected.ms === Infinity) return true;
    const tTime = t.timestamp || new Date(t.date).getTime();
    return tTime >= cutoff;
  });

  renderPastDeliveriesList(filteredTrips);
}

function renderPastDeliveriesList(trips) {
  const container = document.getElementById('myPastDeliveriesList');
  const badge = document.getElementById('profileTripsCountBadge');
  if (!container) return;

  if (badge) badge.innerText = trips.length;

  if (!trips || trips.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 14px; padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        <i class="fa-solid fa-box-open" style="font-size: 1.6rem; color: #475569; margin-bottom: 8px; display: block;"></i>
        Is time period mein koi delivery record nahi mila.
      </div>
    `;
    return;
  }

  container.innerHTML = trips.map(t => `
    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <span style="font-size: 0.76rem; font-weight: 800; color: #fff;">${t.id}</span>
          <span style="display: inline-block; margin-left: 6px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
            ✓ Customer se Prapt
          </span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.1rem; font-weight: 900; color: var(--green);">+₹${t.customer_price || t.driver_earning}</span>
        </div>
      </div>
      <div style="font-size: 0.74rem; color: #cbd5e1; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
        <i class="fa-solid fa-circle" style="font-size: 6px; color: var(--accent);"></i>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Pickup:</strong> ${t.pickup || 'Pickup Point'}</span>
      </div>
      <div style="font-size: 0.74rem; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-location-dot" style="font-size: 8px; color: var(--green);"></i>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Drop:</strong> ${t.drop || 'Drop Point'}</span>
      </div>
      <div style="font-size: 0.68rem; color: #64748b; margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span>Payment: <strong>${t.payment_mode || 'Cash / Direct UPI'}</strong></span>
        <span>${t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Delivered'}</span>
      </div>
    </div>
  `).join('');
}

function fallbackLocalEarnings() {
  if (!currentDriver) return;
  const cleanPhone = String(currentDriver.phone || '').replace(/\D/g, '');
  const driverId = currentDriver.id;

  const p1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
  const p2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
  const map = new Map();
  [...p1, ...p2].forEach(p => { if (p && (p.parcel_id || p.id)) map.set(p.parcel_id || p.id, p); });
  const allParcels = Array.from(map.values());

  const myDeliveredTrips = allParcels.filter(p => {
    const isThisDriver = (driverId && p.driver_id === driverId) ||
                         (cleanPhone && p.assigned_driver_phone && String(p.assigned_driver_phone).replace(/\D/g, '') === cleanPhone);
    const st = (p.booking_status || p.status || '').toLowerCase();
    const isCancelled = st === 'cancelled' || st === 'canceled' || st === 'rejected';
    const isDelivered = (st === 'delivered' || p.delivery_otp_verified === true) && !isCancelled && st !== 'searching_driver' && st !== 'received';
    return isThisDriver && isDelivered;
  }).map(p => ({
    id: p.parcel_id || p.id,
    customer_price: Number(p.total_amount || 0),
    driver_earning: Number(p.total_amount || 0),
    pickup: p.pickup_address,
    drop: p.drop_address,
    payment_mode: p.payment_method || 'Cash on Delivery',
    date: p.created_at || new Date().toISOString(),
    timestamp: new Date(p.created_at || Date.now()).getTime()
  }));

  const totalEarnings = myDeliveredTrips.reduce((acc, t) => acc + t.driver_earning, 0);

  allRiderTrips = myDeliveredTrips;
  allRiderEarningsData = {
    todayEarnings: totalEarnings,
    last7DaysEarnings: totalEarnings,
    last30DaysEarnings: totalEarnings,
    last6MonthsEarnings: totalEarnings,
    last1YearEarnings: totalEarnings,
    allTimeEarnings: totalEarnings,
    completedTripsCount: myDeliveredTrips.length,
    dateOfJoining: currentDriver.approved_at || currentDriver.created_at || new Date().toISOString()
  };

  updateEarningsUI(allRiderEarningsData);
  applyEarningsTimeFilter();
}

/* ==========================================================================
   7. LIVE JOBS FEED & ACTIVE TRIP DISPATCH
   ========================================================================== */
async function loadDriverFeed(showRefreshAnim = false) {
  const feedList = document.getElementById('driverFeedList');
  const feedCountEl = document.getElementById('feedCount');
  const activeContainer = document.getElementById('activeTripContainer');
  if (!feedList) return;

  if (showRefreshAnim) {
    const btn = document.getElementById('btnRefreshFeed');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) { icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 600); }
    }
  }

  let activeTripFound = null;
  let availableList = [];
  let feedLoadedFromBackend = false;

  try {
    const res = await fetch(`${DRIVER_API_BASE}/rider/jobs`, {
      headers: getRiderHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      feedLoadedFromBackend = true;
      
      // Filter out any trip that has status delivered
      if (data.activeTrip) {
        const st = data.activeTrip.booking_status || data.activeTrip.status;
        if (st !== 'delivered' && !data.activeTrip.delivery_otp_verified) {
          activeTripFound = data.activeTrip;
        }
      }

      availableList = (data.availableJobs || []).filter(p => {
        const st = p.booking_status || p.status;
        return st !== 'delivered' && !p.delivery_otp_verified && (st === 'searching_driver' || st === 'received');
      });
    }
  } catch (err) {
    console.warn('Jobs feed network notice, using local cache:', err);
  }

  // Local Storage Fallback if backend is offline or waking up
  if (!feedLoadedFromBackend) {
    const p1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
    const p2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
    const map = new Map();
    [...p1, ...p2].forEach(p => { if (p && (p.parcel_id || p.id)) map.set(p.parcel_id || p.id, p); });
    const allParcels = Array.from(map.values());

    const cleanPhone = String(currentDriver?.phone || '').replace(/\D/g, '');
    const driverId = currentDriver?.id;

    // Check active trip for this driver
    const localActive = allParcels.find(p => {
      const isAssigned = (driverId && p.driver_id === driverId) ||
                         (cleanPhone && p.assigned_driver_phone && String(p.assigned_driver_phone).replace(/\D/g, '') === cleanPhone);
      const st = p.booking_status || p.status || '';
      const isDelivered = st === 'delivered' || p.delivery_otp_verified;
      const isActiveStatus = ['driver_assigned', 'reached_pickup', 'picked_up', 'in_transit', 'out_for_delivery'].includes(st);
      return isAssigned && isActiveStatus && !isDelivered;
    });

    activeTripFound = localActive || null;

    if (!activeTripFound && currentDriver?.onDuty !== false) {
      availableList = allParcels.filter(p => {
        const st = p.booking_status || p.status || '';
        const isDelivered = st === 'delivered' || p.delivery_otp_verified;
        return (st === 'searching_driver' || st === 'received') && !p.driver_id && !isDelivered;
      });
    }
  }

  currentActiveTrip = activeTripFound;

  // Render Active Trip if rider is assigned
  if (activeContainer) {
    if (currentActiveTrip) {
      activeContainer.innerHTML = buildActiveTripCard(currentActiveTrip);
    } else {
      activeContainer.innerHTML = '';
    }
  }

  // Render Available Jobs Feed
  if (feedCountEl) feedCountEl.innerText = availableList.length > 0 ? availableList.length : '';

  if (currentActiveTrip) {
    feedList.innerHTML = `
      <div class="empty-state" style="padding: 24px 16px;">
        <div class="empty-icon" style="color: var(--green);"><i class="fa-solid fa-circle-check"></i></div>
        <div class="empty-title">Trip in Progress</div>
        <div class="empty-sub">Complete your active trip above to receive new orders.</div>
      </div>
    `;
    return;
  }

  if (availableList.length === 0) {
    feedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div>
        <div class="empty-title">Scanning for Delivery Jobs...</div>
        <div class="empty-sub">New orders appear here automatically every 8 seconds.</div>
      </div>
    `;
    return;
  }

  feedList.innerHTML = availableList.map(p => buildFeedCard(p)).join('');
}

function buildActiveTripCard(trip) {
  const pId = trip.parcel_id || trip.id;
  const st = trip.booking_status || trip.status || 'driver_assigned';
  const isDelivered = st === 'delivered' || trip.delivery_otp_verified;

  // Safety check: Never render active trip box if trip is delivered
  if (isDelivered) {
    return '';
  }

  const pickupAddr = trip.pickup_address || 'Pickup Point';
  const dropAddr = trip.drop_address || 'Drop Point';
  const fare = Number(trip.total_amount || 0);
  const riderShare = fare; // 100% Direct Customer Payment, 0% Company Commission
  const isPickedUp = st === 'picked_up' || st === 'in_transit' || st === 'out_for_delivery';

  const customerPhone = isPickedUp ? (trip.receiver_phone || trip.sender_phone) : (trip.sender_phone || trip.receiver_phone);
  const targetAddress = isPickedUp ? dropAddr : pickupAddr;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetAddress)}`;

  return `
    <div class="active-trip-card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span class="active-badge"><i class="fa-solid fa-bolt"></i> ACTIVE TRIP</span>
        <span class="trip-status-pill">${st.replace(/_/g, ' ').toUpperCase()}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <div>
          <div class="trip-id-label">Order Number</div>
          <div class="trip-id-val">${pId}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.65rem; color: #22c55e; font-weight: 800; text-transform: uppercase;">100% Direct Cash/UPI</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: var(--green);">₹${riderShare}</div>
        </div>
      </div>

      <div class="route-info-box">
        <div class="route-row">
          <div class="route-icon pickup"><i class="fa-solid fa-arrow-up"></i></div>
          <div style="flex: 1;">
            <div class="route-label">PICKUP FROM</div>
            <div class="route-addr">${pickupAddr}</div>
            <div class="route-contact">Sender: ${trip.sender_name || 'Customer'} (+91 ${trip.sender_phone || '-'})</div>
          </div>
        </div>
        <div class="route-row">
          <div class="route-icon drop"><i class="fa-solid fa-location-dot"></i></div>
          <div style="flex: 1;">
            <div class="route-label">DELIVER TO</div>
            <div class="route-addr">${dropAddr}</div>
            <div class="route-contact">Receiver: ${trip.receiver_name || 'Customer'} (+91 ${trip.receiver_phone || '-'})</div>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons: Call & Google Maps Navigation -->
      <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 8px; margin-bottom: 14px;">
        <a href="tel:${customerPhone}" class="btn-refresh" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 0.82rem; font-weight: 700; color: #fff; text-decoration: none; border-color: rgba(255,255,255,0.2);">
          <i class="fa-solid fa-phone text-success"></i> Call Customer
        </a>
        <a href="${mapsUrl}" target="_blank" class="btn-refresh" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 0.82rem; font-weight: 700; color: #38bdf8; text-decoration: none; border-color: rgba(56,189,248,0.3); background: rgba(56,189,248,0.08);">
          <i class="fa-solid fa-diamond-turn-right"></i> Google Maps
        </a>
      </div>

      <!-- OTP Verification Trigger Button -->
      ${!isPickedUp ? `
        <button type="button" class="btn-verify-otp" style="background: linear-gradient(135deg, #f97316, #ea580c);" onclick="openOtpSheet('pickup', '${pId}')">
          <i class="fa-solid fa-key"></i> Enter Customer Pickup PIN
        </button>
      ` : `
        <button type="button" class="btn-verify-otp" onclick="openOtpSheet('delivery', '${pId}')">
          <i class="fa-solid fa-circle-check"></i> Enter Delivery PIN & Complete Trip
        </button>
      `}
    </div>
  `;
}

function buildFeedCard(parcel) {
  const pId = parcel.parcel_id || parcel.id;
  const fare = Number(parcel.total_amount || 0);
  const riderShare = fare; // 100% Direct to Rider

  return `
    <div class="feed-card" id="card-${pId}">
      <div class="feed-top">
        <div>
          <span class="feed-badge">⚡ NEW DELIVERY JOB</span>
          <div class="feed-title">${pId} • ${(parcel.parcel_type || 'Package').toUpperCase()}</div>
        </div>
        <div class="feed-fare">
          <div class="feed-fare-val">₹${riderShare}</div>
          <div class="feed-fare-sub">100% Direct Cash/UPI</div>
        </div>
      </div>

      <div class="feed-routes">
        <div class="feed-route-row">
          <i class="fa-solid fa-arrow-up feed-route-icon pickup"></i>
          <span class="feed-route-text"><strong>Pickup:</strong> ${parcel.pickup_address || 'Pickup Point'}</span>
        </div>
        <div class="feed-route-row">
          <i class="fa-solid fa-location-dot feed-route-icon drop"></i>
          <span class="feed-route-text"><strong>Drop:</strong> ${parcel.drop_address || 'Drop Point'}</span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; margin-top: 12px;">
        <button class="btn-accept-job" onclick="acceptDriverJob('${pId}')" style="flex: 1; padding: 11px;">
          <i class="fa-solid fa-circle-check me-1"></i> Accept Job (Earn ₹${riderShare})
        </button>
      </div>
    </div>
  `;
}

async function acceptDriverJob(parcelId) {
  if (!currentDriver) return;
  if (!currentDriver.onDuty) {
    showToast('Please toggle ON DUTY before accepting jobs.', 'error');
    return;
  }

  try {
    const res = await fetch(`${DRIVER_API_BASE}/rider/jobs/${parcelId}/accept`, {
      method: 'POST',
      headers: getRiderHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to accept this job.');
    }

    showToast('🚀 Job accepted! Heading to pickup.', 'success');
    switchDriverView('feed');
    loadDriverFeed(true);
  } catch (err) {
    showToast(err.message || 'Error accepting job.', 'error');
  }
}

/* ==========================================================================
   8. OTP BOTTOM SHEET VERIFICATION
   ========================================================================== */
function initOtpDigitInputs() {
  const digits = [document.getElementById('otp1'), document.getElementById('otp2'), document.getElementById('otp3'), document.getElementById('otp4')];
  digits.forEach((el, idx) => {
    if (!el) return;
    el.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val && idx < 3) digits[idx + 1]?.focus();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        digits[idx - 1]?.focus();
      }
    });
  });
}

function openOtpSheet(mode, parcelId) {
  currentOtpMode = mode;
  currentOtpParcelId = parcelId;

  const overlay = document.getElementById('otpOverlay');
  const title = document.getElementById('otpSheetTitle');
  const sub = document.getElementById('otpSheetSub');
  const btnLabel = document.getElementById('btnVerifyLabel');

  [1, 2, 3, 4].forEach(i => {
    const inp = document.getElementById(`otp${i}`);
    if (inp) inp.value = '';
  });

  if (mode === 'pickup') {
    if (title) title.innerText = 'Enter Pickup Verification PIN';
    if (sub) sub.innerText = 'Ask the sender on ground for their 4-digit PIN to load the parcel.';
    if (btnLabel) btnLabel.innerText = 'Verify Pickup PIN';
  } else {
    if (title) title.innerText = 'Enter Delivery PIN';
    if (sub) sub.innerText = 'Ask the receiver for their 4-digit PIN to complete delivery.';
    if (btnLabel) btnLabel.innerText = 'Verify & Complete Delivery';
  }

  if (overlay) overlay.classList.add('active');
  setTimeout(() => document.getElementById('otp1')?.focus(), 200);
}

function closeOtpSheet() {
  const overlay = document.getElementById('otpOverlay');
  if (overlay) overlay.classList.remove('active');
}

async function submitOtpVerification() {
  const digits = [
    document.getElementById('otp1')?.value.trim() || '',
    document.getElementById('otp2')?.value.trim() || '',
    document.getElementById('otp3')?.value.trim() || '',
    document.getElementById('otp4')?.value.trim() || ''
  ];
  const enteredOtp = digits.join('');

  if (enteredOtp.length !== 4) {
    showToast('Please enter all 4 digits of the PIN.', 'error');
    return;
  }

  const btn = document.getElementById('btnVerifyOtp');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Verifying...'; }

  const endpoint = currentOtpMode === 'pickup' ? 'verify-pickup-otp' : 'verify-delivery-otp';

  try {
    let isSuccess = false;
    let serverMessage = '';

    try {
      const res = await fetch(`${DRIVER_API_BASE}/parcels/${currentOtpParcelId}/${endpoint}`, {
        method: 'POST',
        headers: getRiderHeaders(),
        body: JSON.stringify({ otp: enteredOtp })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        isSuccess = true;
        serverMessage = data.message || '';
      } else if (res.status === 400 && data.error) {
        throw new Error(data.error);
      }
    } catch (fetchErr) {
      if (fetchErr.message && fetchErr.message.includes('PIN')) throw fetchErr;
    }

    // Local Storage synchronization & fallback check
    const p1 = JSON.parse(localStorage.getItem('rudraksha_parcels') || '[]');
    const p2 = JSON.parse(localStorage.getItem('rudraksha_parcels_history') || '[]');
    const all = [...p1, ...p2];
    const targetParcel = all.find(p => (p.parcel_id === currentOtpParcelId || p.id === currentOtpParcelId));

    if (targetParcel) {
      if (currentOtpMode === 'pickup') {
        const expected = String(targetParcel.pickup_otp || '').replace(/\D/g, '');
        if (expected && enteredOtp !== expected) {
          throw new Error('Invalid Pickup PIN. Please ask sender for the correct PIN.');
        }
        targetParcel.booking_status = 'picked_up';
        targetParcel.status = 'picked_up';
        targetParcel.pickup_otp_verified = true;
      } else {
        const expected = String(targetParcel.delivery_otp || '').replace(/\D/g, '');
        if (expected && enteredOtp !== expected) {
          throw new Error('Invalid Delivery PIN. Please ask receiver for the correct PIN.');
        }
        targetParcel.booking_status = 'delivered';
        targetParcel.status = 'delivered';
        targetParcel.delivery_otp_verified = true;
        targetParcel.pickup_otp_verified = true;
      }
      localStorage.setItem('rudraksha_parcels', JSON.stringify(p1));
      localStorage.setItem('rudraksha_parcels_history', JSON.stringify(p2));
    }

    closeOtpSheet();

    if (currentOtpMode === 'pickup') {
      showToast('✅ Pickup PIN verified! Parcel marked as Picked Up.', 'success');
    } else {
      const fare = currentActiveTrip?.total_amount ? `₹${currentActiveTrip.total_amount}` : '';
      showToast(`🎉 Delivery Complete! ${fare} added to your wallet!`, 'success');
      currentActiveTrip = null;
      const activeContainer = document.getElementById('activeTripContainer');
      if (activeContainer) activeContainer.innerHTML = '';
      loadDriverEarnings();
      renderDriverProfileView();
    }

    loadDriverFeed(true);
  } catch (err) {
    showToast(err.message || 'Verification failed.', 'error');
    // Shake inputs
    const wrap = document.querySelector('.otp-input-wrap');
    if (wrap) {
      wrap.style.animation = 'shake 0.4s ease';
      setTimeout(() => wrap.style.animation = '', 400);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-circle-check me-2"></i> <span id="btnVerifyLabel">${currentOtpMode === 'pickup' ? 'Verify Pickup PIN' : 'Verify & Complete Delivery'}</span>`;
    }
  }
}

/* ==========================================================================
   9. VIEW NAVIGATION & TOASTS
   ========================================================================== */
function switchDriverView(viewName) {
  const feedSec = document.getElementById('driverFeedSection');
  const profSec = document.getElementById('driverProfileSection');
  const btnFeed = document.getElementById('btnTabFeed');
  const btnActive = document.getElementById('btnTabActive');
  const btnProf = document.getElementById('btnTabProfile');

  [btnFeed, btnActive, btnProf].forEach(b => b?.classList.remove('active'));

  if (viewName === 'profile') {
    if (feedSec) feedSec.style.display = 'none';
    if (profSec) profSec.style.display = 'block';
    if (btnProf) btnProf.classList.add('active');
    loadDriverEarnings();
    renderDriverProfileView();
  } else if (viewName === 'active') {
    if (feedSec) feedSec.style.display = 'block';
    if (profSec) profSec.style.display = 'none';
    if (btnActive) btnActive.classList.add('active');
    const activeEl = document.getElementById('activeTripContainer');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth' });
  } else {
    if (feedSec) feedSec.style.display = 'block';
    if (profSec) profSec.style.display = 'none';
    if (btnFeed) btnFeed.classList.add('active');
    loadDriverFeed(false);
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-bell');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
