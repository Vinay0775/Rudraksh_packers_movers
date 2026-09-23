require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./services/supabase');
const telegram = require('./services/telegram');
const otpService = require('./services/otp');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_USER = process.env.ADMIN_USER || 'Rudrakshapackers&parcel';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bannaji1234@';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'RudrakshaEnterpriseKey_Bannaji2026!';

if (!isProduction && (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET_KEY)) {
  console.warn('Warning: development admin credentials are active. Set ADMIN_USER, ADMIN_PASSWORD and ADMIN_SECRET_KEY before deployment.');
}

function generateAdminToken() {
  const payload = JSON.stringify({ role: 'admin', time: Date.now() });
  const hmac = crypto.createHmac('sha256', ADMIN_SECRET_KEY).update(payload).digest('hex');
  return Buffer.from(`${payload}::${hmac}`).toString('base64');
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = Buffer.from(cleanToken, 'base64').toString('utf8');
    const [payloadStr, hmac] = decoded.split('::');
    if (!payloadStr || !hmac) return false;
    const expectedHmac = crypto.createHmac('sha256', ADMIN_SECRET_KEY).update(payloadStr).digest('hex');
    const received = Buffer.from(hmac, 'utf8');
    const expected = Buffer.from(expectedHmac, 'utf8');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return false;
    const payload = JSON.parse(payloadStr);
    if (payload.role !== 'admin' || !Number.isFinite(payload.time) || payload.time > Date.now()) return false;
    // Token valid for 7 days
    if (Date.now() - payload.time > 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASSWORD || !ADMIN_SECRET_KEY || !verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  next();
}

/* ==========================================================================
   RIDER AUTHENTICATION & SECURITY MIDDLEWARE
   ========================================================================== */
const RIDER_SECRET_KEY = process.env.RIDER_SECRET_KEY || 'RudrakshaRiderSecretKey_2026_SecureFleet!';

function generateRiderToken(driver) {
  const payload = JSON.stringify({
    role: 'rider',
    driver_id: driver.id,
    phone: driver.phone,
    driver_name: driver.driver_name,
    time: Date.now()
  });
  const hmac = crypto.createHmac('sha256', RIDER_SECRET_KEY).update(payload).digest('hex');
  return Buffer.from(`${payload}::${hmac}`).toString('base64');
}

function verifyRiderToken(token) {
  if (!token) return null;
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = Buffer.from(cleanToken, 'base64').toString('utf8');
    const [payloadStr, hmac] = decoded.split('::');
    if (!payloadStr || !hmac) return null;
    const expectedHmac = crypto.createHmac('sha256', RIDER_SECRET_KEY).update(payloadStr).digest('hex');
    const received = Buffer.from(hmac, 'utf8');
    const expected = Buffer.from(expectedHmac, 'utf8');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.role !== 'rider' || !payload.driver_id) return null;
    // Valid for 30 days
    if (Date.now() - payload.time > 30 * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireRider(req, res, next) {
  const authHeader = req.headers.authorization;
  const decoded = verifyRiderToken(authHeader);
  if (!decoded) {
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (rawToken && rawToken.startsWith('local_token_')) {
      const parts = rawToken.split('_');
      const phone = parts[2];
      if (phone) {
        const driver = await db.getDriverByPhone(phone);
        if (driver) {
          req.rider = driver;
          return next();
        }
      }
    }
    return res.status(401).json({ error: 'Rider authentication required. Please log in again.' });
  }
  const driver = await db.getDriverById(decoded.driver_id) || await db.getDriverByPhone(decoded.phone);
  if (!driver) {
    return res.status(401).json({ error: 'Rider account not found or deactivated.' });
  }
  req.rider = driver;
  next();
}

function requireAdminOrRider(req, res, next) {
  if (verifyAdminToken(req.headers.authorization)) {
    req.isAdmin = true;
    return next();
  }
  const decoded = verifyRiderToken(req.headers.authorization);
  if (decoded) {
    req.isRider = true;
    req.riderId = decoded.driver_id;
    return next();
  }
  // Allow unauthenticated OTP verification if correct OTP is provided
  next();
}

// Health Check (Pings Supabase to Keep Database & Render Awake 24x7)
app.get('/api/health', async (req, res) => {
  let supabaseConnected = db.isSupabaseActive();
  let supabasePing = false;

  if (supabaseConnected) {
    try {
      await db.getBookings();
      supabasePing = true;
    } catch (e) {
      console.warn('Health check Supabase ping warning:', e.message);
    }
  }

  res.json({
    ok: true,
    service: 'rudraksha-packers-api',
    supabaseActive: supabaseConnected,
    supabasePing,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    otpMode: process.env.OTP_MODE || 'dev',
    time: new Date().toISOString()
  });
});

/* ==========================================================================
   ADMIN AUTHENTICATION ENDPOINTS
   ========================================================================== */
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    if (!ADMIN_USER || !ADMIN_PASSWORD || !ADMIN_SECRET_KEY) {
      return res.status(503).json({ error: 'Admin credentials are not configured on the server.' });
    }

    const isUserValid = username && username.trim().toLowerCase() === ADMIN_USER.toLowerCase();
    const isPassValid = password.trim() === ADMIN_PASSWORD;

    if (!isUserValid || !isPassValid) {
      return res.status(401).json({ error: 'Invalid admin username or password.' });
    }

    const token = generateAdminToken();
    res.json({
      success: true,
      token,
      user: { name: 'Owner / Administrator', role: 'owner' },
      message: 'Authentication successful.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !verifyAdminToken(authHeader)) {
    return res.status(401).json({ valid: false, error: 'Unauthorized or session expired.' });
  }
  res.json({ valid: true, message: 'Admin session is active.' });
});

/* ==========================================================================
   RIDER APPLICATION ENDPOINTS
   ========================================================================== */
app.get('/api/rider-applications', requireAdmin, async (req, res, next) => {
  try {
    const applications = await db.getRiderApplications();
    const enriched = applications.map(app => {
      const cleanPhone = String(app.phone || '').replace(/\D/g, '');
      return {
        ...app,
        avatar_url: app.avatar_url || (cleanPhone && riderAvatarStore.has(cleanPhone) ? riderAvatarStore.get(cleanPhone) : null)
      };
    });
    res.json({ applications: enriched });
  } catch (err) {
    next(err);
  }
});

app.post('/api/rider-applications', async (req, res, next) => {
  try {
    const { name, phone, city, shift, vehType, vehNum, dlNum } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    if (!name || !city || !cleanPhone || cleanPhone.length !== 10 || !vehNum || !dlNum) {
      return res.status(400).json({ error: 'Please fill all required rider partner details.' });
    }

    const existingApps = await db.getRiderApplications();
    const duplicate = existingApps.find(app => String(app.phone || '').replace(/\D/g, '') === cleanPhone);
    if (duplicate) {
      if (duplicate.status === 'Pending') {
        const updated = await db.updateRiderApplication(duplicate.id, {
          name: String(name).trim(),
          city: String(city).trim(),
          shift: shift || duplicate.shift,
          vehType: vehType || duplicate.vehType,
          vehNum: String(vehNum).trim(),
          dlNum: String(dlNum).trim(),
          date: new Date().toISOString()
        });
        return res.status(200).json({ success: true, application: updated || duplicate, message: 'Application updated successfully.' });
      }
      return res.status(409).json({
        error: `This mobile number +91 ${cleanPhone} is already registered as a rider partner (${duplicate.status}).`,
        application: duplicate
      });
    }

    const application = await db.createRiderApplication({
      id: `app-${Date.now()}`,
      name: String(name).trim(),
      phone: cleanPhone,
      city: String(city).trim(),
      shift: shift || 'Full Time (8-10 Hours)',
      vehType: vehType || 'Bike / Scooter',
      vehNum: String(vehNum).trim(),
      dlNum: String(dlNum).trim(),
      status: 'Pending',
      date: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    res.status(201).json({ success: true, application, message: 'Rider application submitted successfully.' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/rider-applications/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const { pin } = req.body;
    const applications = await db.getRiderApplications();
    const app = applications.find(item => item.id === req.params.id);

    if (!app) {
      return res.status(404).json({ error: 'Rider application not found.' });
    }

    const phoneClean = String(app.phone || '').replace(/\D/g, '');
    const driverCode = app.driverId || `RDR-${phoneClean.slice(-4)}`;
    const driverPin = pin || app.pin || String(Math.floor(1000 + Math.random() * 9000));

    const existingDrivers = await db.getDrivers();
    const matchedDriver = existingDrivers.find(d => String(d.phone || '').replace(/\D/g, '') === phoneClean);

    const driverPayload = {
      id: matchedDriver?.id,
      driver_name: app.name,
      phone: phoneClean,
      vehicle_number: app.vehNum || app.vehicle_number || '',
      vehicle_type: app.vehType || app.vehicle_type || 'Bike / Scooter',
      status: 'available',
      rating: matchedDriver?.rating || 4.8
    };

    let savedDriver = null;
    if (matchedDriver && matchedDriver.id) {
      savedDriver = await db.updateDriver(matchedDriver.id, driverPayload);
    } else {
      savedDriver = await db.createDriver(driverPayload);
    }

    const updatedApp = await db.updateRiderApplication(app.id, {
      status: 'Approved',
      driverId: driverCode,
      pin: driverPin,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    res.json({
      success: true,
      application: updatedApp,
      driver: { ...savedDriver, driverId: driverCode, pin: driverPin },
      message: `Rider ${app.name} approved successfully with PIN ${driverPin}.`
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/rider-applications/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const applications = await db.getRiderApplications();
    const app = applications.find(item => item.id === req.params.id);
    if (!app) {
      return res.status(404).json({ error: 'Rider application not found.' });
    }
    const updated = await db.updateRiderApplication(app.id, {
      status: 'Rejected',
      updated_at: new Date().toISOString()
    });
    res.json({ success: true, application: updated, message: 'Rider application rejected.' });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   DEDICATED RIDER PARTNER APP API ENGINE
   Full Data Isolation • PWA Profile • Earnings Wallet • Duty Engine
   ========================================================================== */

const riderAvatarStore = new Map();

// 1. Rider Login with Phone & 4-Digit Security PIN
app.post('/api/rider/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanPin = String(pin || '').trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!cleanPin || cleanPin.length < 4) {
      return res.status(400).json({ error: 'Please enter your 4-digit security PIN.' });
    }

    // Lookup in approved drivers first
    const drivers = await db.getDrivers();
    let matchedDriver = drivers.find(d => String(d.phone || '').replace(/\D/g, '') === cleanPhone);

    // If not found in drivers, lookup approved rider applications
    if (!matchedDriver) {
      const apps = await db.getRiderApplications();
      const matchedApp = apps.find(a => String(a.phone || '').replace(/\D/g, '') === cleanPhone);

      if (matchedApp) {
        if (matchedApp.status === 'Pending') {
          return res.status(403).json({
            error: '⏳ Your rider application is currently under review by Admin. You will receive your PIN on WhatsApp once approved.'
          });
        }
        if (matchedApp.status === 'Rejected') {
          return res.status(403).json({
            error: '❌ Your rider application was declined. Please contact Rudraksha Support at +91 7296831460.'
          });
        }

        // Auto-provision driver record for approved application
        const driverId = matchedApp.driverId || `RDR-${cleanPhone.slice(-4)}`;
        matchedDriver = {
          id: driverId,
          driver_name: matchedApp.name,
          phone: cleanPhone,
          vehicle_number: matchedApp.vehNum || '',
          vehicle_type: matchedApp.vehType || 'Bike / Scooter',
          dl_number: matchedApp.dlNum || '',
          city: matchedApp.city || 'Jaipur',
          shift: matchedApp.shift || 'Full Time',
          status: 'available',
          pin: matchedApp.pin || cleanPin,
          rating: 4.9,
          onDuty: true,
          created_at: new Date().toISOString()
        };
        await db.createDriver(matchedDriver);
      }
    }

    if (!matchedDriver) {
      return res.status(404).json({
        error: `❌ No registered partner found for +91 ${cleanPhone}. Please register as a rider first.`
      });
    }

    // Validate PIN
    const expectedPin = String(matchedDriver.pin || matchedDriver.password || '1234').trim();
    if (expectedPin !== cleanPin) {
      return res.status(401).json({
        error: '❌ Incorrect security PIN. Please enter the 4-digit PIN sent to your WhatsApp.'
      });
    }

    // Generate cryptographic Rider Session Token
    const token = generateRiderToken(matchedDriver);

    // Return sanitized driver object (never return pin back to client)
    const sanitizedDriver = { ...matchedDriver };
    delete sanitizedDriver.pin;
    delete sanitizedDriver.password;

    if (!sanitizedDriver.avatar_url && riderAvatarStore.has(cleanPhone)) {
      sanitizedDriver.avatar_url = riderAvatarStore.get(cleanPhone);
    }

    res.json({
      success: true,
      token,
      driver: sanitizedDriver,
      message: `Welcome back, ${matchedDriver.driver_name || 'Partner'}!`
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get Authenticated Rider's Own Profile (100% Private & Isolated)
app.get('/api/rider/me', requireRider, async (req, res, next) => {
  try {
    const cleanPhone = String(req.rider.phone || '').replace(/\D/g, '');
    const driver = { ...req.rider };
    if (!driver.avatar_url && cleanPhone && riderAvatarStore.has(cleanPhone)) {
      driver.avatar_url = riderAvatarStore.get(cleanPhone);
    }
    delete driver.pin;
    delete driver.password;
    res.json({ success: true, rider: driver });
  } catch (err) {
    next(err);
  }
});

// 3. Update Rider Profile (Photo Upload / Avatar / Vehicle / Contact)
app.patch('/api/rider/profile', requireRider, async (req, res, next) => {
  try {
    const { avatar_url, driver_name, vehicle_number, vehicle_type, dl_number, city, shift } = req.body;
    const cleanPhone = String(req.rider.phone || '').replace(/\D/g, '');
    let cloudAvatar = avatar_url;
    if (avatar_url) {
      try {
        cloudAvatar = await db.uploadDriverAvatar(cleanPhone, avatar_url);
      } catch (uploadErr) {
        console.warn('Supabase storage upload error in profile update:', uploadErr);
      }
      riderAvatarStore.set(cleanPhone, cloudAvatar);
    }

    const updates = {};
    if (avatar_url !== undefined) updates.avatar_url = cloudAvatar;
    if (driver_name) updates.driver_name = String(driver_name).trim();
    if (vehicle_number) updates.vehicle_number = String(vehicle_number).trim();
    if (vehicle_type) updates.vehicle_type = String(vehicle_type).trim();
    if (dl_number) updates.dl_number = String(dl_number).trim();
    if (city) updates.city = String(city).trim();
    if (shift) updates.shift = String(shift).trim();
    updates.updated_at = new Date().toISOString();

    const updated = await db.updateDriver(req.rider.id, updates);

    // Also update rider_applications table so admin immediately sees photo in applications tab
    if (cloudAvatar && cleanPhone) {
      try {
        const apps = await db.getRiderApplications();
        const matchedApp = apps.find(a => String(a.phone || '').replace(/\D/g, '') === cleanPhone);
        if (matchedApp) {
          await db.updateRiderApplication(matchedApp.id, { avatar_url: cloudAvatar });
        }
      } catch (appSyncErr) {
        console.warn('Sync rider application avatar warning:', appSyncErr);
      }
    }

    const sanitized = { ...(updated || req.rider) };
    if (cloudAvatar) sanitized.avatar_url = cloudAvatar;
    delete sanitized.pin;
    delete sanitized.password;

    res.json({ success: true, rider: sanitized, message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// Dedicated Public/Rider Avatar Upload & Sync Endpoint (Supabase Storage Cloud Bucket)
app.post('/api/rider/avatar', async (req, res, next) => {
  try {
    const { phone, avatar_url } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone || !avatar_url) {
      return res.status(400).json({ error: 'Phone number and avatar_url are required.' });
    }

    // Upload to Supabase Storage 'driver-avatars' public bucket
    let cloudAvatarUrl = avatar_url;
    try {
      cloudAvatarUrl = await db.uploadDriverAvatar(cleanPhone, avatar_url);
    } catch (uploadErr) {
      console.warn('Supabase storage upload error:', uploadErr);
    }

    riderAvatarStore.set(cleanPhone, cloudAvatarUrl);

    // Update in drivers table
    try {
      const drivers = await db.getDrivers();
      const d = drivers.find(x => String(x.phone || '').replace(/\D/g, '') === cleanPhone);
      if (d) {
        await db.updateDriver(d.id, { avatar_url: cloudAvatarUrl });
      }
    } catch (dErr) {}

    // Update in rider_applications table
    try {
      const apps = await db.getRiderApplications();
      const a = apps.find(x => String(x.phone || '').replace(/\D/g, '') === cleanPhone);
      if (a) {
        await db.updateRiderApplication(a.id, { avatar_url: cloudAvatarUrl });
      }
    } catch (aErr) {}

    res.json({
      success: true,
      message: 'Driver photo uploaded to Supabase Storage and synced across devices & admin.',
      avatar_url: cloudAvatarUrl
    });
  } catch (err) {
    next(err);
  }
});

// 4. Toggle Rider Duty Switch (On-Duty / Off-Duty)
app.patch('/api/rider/duty', requireRider, async (req, res, next) => {
  try {
    const { onDuty } = req.body;
    const isDuty = Boolean(onDuty);
    await db.updateDriver(req.rider.id, {
      onDuty: isDuty,
      status: isDuty ? 'available' : 'off_duty',
      updated_at: new Date().toISOString()
    });
    res.json({ success: true, onDuty: isDuty, message: isDuty ? 'You are now ONLINE & ready for trips! 🟢' : 'You are now OFFLINE. 🔴' });
  } catch (err) {
    next(err);
  }
});

// 5. Get Rider Trips & Live Assigned Jobs (Strictly for Authenticated Rider)
app.get('/api/rider/jobs', requireRider, async (req, res, next) => {
  try {
    const riderId = req.rider.id;
    const riderPhone = String(req.rider.phone || '').replace(/\D/g, '');
    const parcels = await db.getParcels();

    // 1. Find currently active assigned trip
    const activeTrip = parcels.find(p => {
      const isAssigned = (p.driver_id === riderId) || (p.assigned_driver_phone && String(p.assigned_driver_phone).replace(/\D/g, '') === riderPhone);
      const activeStatuses = ['driver_assigned', 'reached_pickup', 'picked_up', 'in_transit', 'out_for_delivery'];
      return isAssigned && activeStatuses.includes(p.booking_status || p.status);
    }) || null;

    // 2. Find available jobs waiting for acceptance (if rider is on-duty)
    let availableJobs = [];
    if (req.rider.onDuty !== false && !activeTrip) {
      availableJobs = parcels.filter(p => {
        const st = p.booking_status || p.status;
        return (st === 'searching_driver' || st === 'received') && !p.driver_id;
      }).slice(0, 5);
    }

    res.json({
      success: true,
      activeTrip,
      availableJobs,
      onDuty: req.rider.onDuty !== false
    });
  } catch (err) {
    next(err);
  }
});

// 6. Accept Available Job
app.post('/api/rider/jobs/:id/accept', requireRider, async (req, res, next) => {
  try {
    const parcelId = req.params.id;
    const updated = await db.assignParcelDriver(parcelId, {
      driver_id: req.rider.id,
      driver_name: req.rider.driver_name,
      driver_phone: req.rider.phone,
      vehicle_number: req.rider.vehicle_number || '',
      vehicle_type: req.rider.vehicle_type || 'Bike'
    });

    if (!updated) return res.status(404).json({ error: 'Order not found or already assigned.' });

    // Send Telegram alert
    const msg = `🛵 *RIDER ACCEPTED JOB* 🚀\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 *Order:* \`${updated.parcel_id}\`\n` +
                `👨‍✈️ *Rider:* ${req.rider.driver_name} (+91 ${req.rider.phone})\n` +
                `📍 *Pickup:* ${updated.pickup_address}\n` +
                `🏁 *Drop:* ${updated.drop_address}\n` +
                `💰 *Fare:* ₹${updated.total_amount}\n` +
                `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(msg).catch(console.error);

    res.json({ success: true, parcel: updated, message: 'Trip accepted! Please head to the pickup point.' });
  } catch (err) {
    next(err);
  }
});

// 7. Rider Earnings & Financial Ledger (100% Direct Customer Payment • Zero Commission)
app.get('/api/rider/earnings', requireRider, async (req, res, next) => {
  try {
    const riderId = req.rider.id;
    const riderPhone = String(req.rider.phone || '').replace(/\D/g, '');
    const parcels = await db.getParcels();

    // Filter delivered parcels completed by THIS rider only
    const myDelivered = parcels.filter(p => {
      const isMyTrip = (p.driver_id === riderId) || (p.assigned_driver_phone && String(p.assigned_driver_phone).replace(/\D/g, '') === riderPhone);
      const isDone = (p.booking_status === 'delivered' || p.status === 'delivered');
      return isMyTrip && isDone;
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = now.getTime() - (180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = now.getTime() - (365 * 24 * 60 * 60 * 1000);

    let todayEarnings = 0;
    let last7DaysEarnings = 0;
    let last30DaysEarnings = 0;
    let last6MonthsEarnings = 0;
    let last1YearEarnings = 0;
    let allTimeEarnings = 0;

    const trips = myDelivered.map(p => {
      // 100% of customer booking amount is kept directly by the rider (Zero commission)
      const orderFare = Number(p.total_amount || 0);
      const tripTime = new Date(p.delivery_time || p.updated_at || p.created_at).getTime();

      allTimeEarnings += orderFare;
      if (tripTime >= startOfToday) todayEarnings += orderFare;
      if (tripTime >= sevenDaysAgo) last7DaysEarnings += orderFare;
      if (tripTime >= thirtyDaysAgo) last30DaysEarnings += orderFare;
      if (tripTime >= sixMonthsAgo) last6MonthsEarnings += orderFare;
      if (tripTime >= oneYearAgo) last1YearEarnings += orderFare;

      return {
        id: p.parcel_id || p.id,
        date: p.delivery_time || p.updated_at || p.created_at,
        timestamp: tripTime,
        pickup: p.pickup_address,
        drop: p.drop_address,
        distance_km: p.distance_km || 4,
        customer_price: orderFare,
        driver_earning: orderFare, // 100% received by driver directly from customer
        payment_mode: p.payment_method || 'Cash / Direct UPI',
        status: 'Delivered'
      };
    });

    res.json({
      success: true,
      commission_rate: 0, // 0% commission
      driver_share_percent: 100, // 100% goes to driver
      dateOfJoining: req.rider.approved_at || req.rider.created_at || req.rider.date || '2026-08-01T00:00:00.000Z',
      todayEarnings,
      last7DaysEarnings,
      last30DaysEarnings,
      last6MonthsEarnings,
      last1YearEarnings,
      allTimeEarnings,
      completedTripsCount: myDelivered.length,
      trips
    });
  } catch (err) {
    next(err);
  }
});

// 8. Submit Payout / Withdrawal Request
app.post('/api/rider/payout-request', requireRider, async (req, res, next) => {
  try {
    const { amount, payment_method, upi_id, account_number, ifsc_code, bank_name } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum payout withdrawal request is ₹100.' });
    }

    if (payment_method === 'upi' && (!upi_id || !upi_id.includes('@'))) {
      return res.status(400).json({ error: 'Please provide a valid UPI ID (e.g., yourname@okaxis).' });
    }
    if (payment_method === 'bank' && (!account_number || !ifsc_code)) {
      return res.status(400).json({ error: 'Please provide Bank Account Number and IFSC Code.' });
    }

    const payoutItem = await db.createPayoutRequest({
      driver_id: req.rider.id,
      driver_name: req.rider.driver_name,
      driver_phone: req.rider.phone,
      amount: numAmount,
      payment_method: payment_method || 'upi',
      upi_id: upi_id || null,
      account_number: account_number ? String(account_number).slice(-4).padStart(String(account_number).length, '*') : null,
      full_account_number: account_number || null,
      ifsc_code: ifsc_code || null,
      bank_name: bank_name || null
    });

    // Alert Owner on Telegram
    const alertMsg = `💳 *NEW RIDER PAYOUT REQUEST* 💰\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 *Payout ID:* \`${payoutItem.id}\`\n` +
                     `👨‍✈️ *Rider:* ${req.rider.driver_name} (+91 ${req.rider.phone})\n` +
                     `💵 *Amount:* ₹${numAmount}\n` +
                     `🏦 *Method:* ${(payment_method || 'UPI').toUpperCase()}\n` +
                     `📲 *Details:* ${upi_id || `${bank_name || 'Bank'} A/C: ${account_number} (IFSC: ${ifsc_code})`}\n` +
                     `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(alertMsg).catch(console.error);

    res.status(201).json({
      success: true,
      payout: payoutItem,
      message: `Payout request of ₹${numAmount} submitted to Admin! Processing takes 12-24 hours.`
    });
  } catch (err) {
    next(err);
  }
});

// 9. Get Rider Past Payout Requests
app.get('/api/rider/payouts', requireRider, async (req, res, next) => {
  try {
    const list = await db.getPayoutRequests(req.rider.id);
    res.json({ success: true, payouts: list });
  } catch (err) {
    next(err);
  }
});

// 10. Admin: Get All Payout Requests
app.get('/api/admin/payouts', requireAdmin, async (req, res, next) => {
  try {
    const list = await db.getPayoutRequests();
    res.json({ success: true, payouts: list });
  } catch (err) {
    next(err);
  }
});

// 11. Admin: Update Payout Status (Mark as Paid or Rejected)
app.patch('/api/admin/payouts/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['pending', 'processing', 'paid', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }
    const updated = await db.updatePayoutStatus(req.params.id, status, notes);
    if (!updated) return res.status(404).json({ error: 'Payout request not found.' });

    res.json({ success: true, payout: updated, message: `Payout marked as ${status.toUpperCase()}.` });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   OTP ENDPOINTS
   ========================================================================== */
app.post('/api/otp/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    const result = await otpService.sendOTP(phone);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/otp/verify', (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required.' });
    }
    const result = otpService.verifyOTP(phone, otp);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   BOOKINGS ENDPOINTS
   ========================================================================== */

// 1. Get all bookings (Admin)
app.get('/api/bookings', requireAdmin, async (req, res, next) => {
  try {
    const bookings = await db.getBookings();
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
});

// 2. Track Booking (Customer)
app.get('/api/bookings/track/:idOrPhone', async (req, res, next) => {
  try {
    const booking = await db.getBookingByIdOrPhone(req.params.idOrPhone);
    if (!booking) {
      return res.status(404).json({ error: 'No active booking found matching your ID or Phone number.' });
    }
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

// 3. Create Booking
app.post('/api/bookings', async (req, res, next) => {
  try {
    const body = req.body;
    const name = body.customer_name || body.name;
    const phone = String(body.customer_phone || body.phone || '').replace(/\D/g, '');
    const pickup = body.pickup_address || body.pickup;
    const drop = body.drop_address || body.drop;
    const date = body.shifting_date || body.date;

    if (!name || !phone || phone.length !== 10 || !pickup || !drop || !date) {
      return res.status(400).json({ error: 'Please provide name, phone, pickup, drop and shifting date.' });
    }

    if (body.phone_verified !== true) {
      return res.status(400).json({ error: 'Phone verification is required before booking.' });
    }

    const bookingId = `RB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Normalize amount
    let totalAmt = 0;
    if (body.total_amount !== undefined) totalAmt = Number(body.total_amount);
    else if (body.estimatedTotal) totalAmt = Number(String(body.estimatedTotal).replace(/[^\d.]/g, '')) || 0;

    if (!Number.isFinite(totalAmt) || totalAmt < 0) {
      return res.status(400).json({ error: 'Total amount must be a valid non-negative number.' });
    }

    const pickupOtp = body.pickup_otp || String(Math.floor(1000 + Math.random() * 9000));

    const bookingPayload = {
      id: bookingId,
      customer_name: name,
      customer_phone: phone,
      customer_email: body.customer_email || body.email || null,
      
      pickup_address: pickup,
      pickup_lat: body.pickup_lat || null,
      pickup_lng: body.pickup_lng || null,
      pickup_floor: body.pickup_floor || body.floors?.pickup?.number || 0,
      pickup_lift: body.pickup_lift ?? (body.floors?.pickup?.lift ?? false),
      
      drop_address: drop,
      drop_lat: body.drop_lat || null,
      drop_lng: body.drop_lng || null,
      drop_floor: body.drop_floor || body.floors?.drop?.number || 0,
      drop_lift: body.drop_lift ?? (body.floors?.drop?.lift ?? false),
      
      distance_km: Number(body.distance_km || body.distanceKm || 25),
      shifting_date: date,
      service_type: body.service_type || 'House Shifting',
      selected_vehicle: body.selected_vehicle || 'Tata Ace / Mini (1.5 Ton)',
      house_type: body.house_type || body.houseType || '1bhk',
      items: body.items || {},
      addons: body.addons || [],
      coupon_applied: body.coupon_applied || body.coupon || null,
      
      base_price: Number(body.base_price || 3500),
      distance_charge: Number(body.distance_charge || 0),
      labor_charge: Number(body.labor_charge || 0),
      addons_charge: Number(body.addons_charge || 0),
      discount_amount: Number(body.discount_amount || 0),
      total_amount: totalAmt,
      payment_status: body.payment_status || 'pending',
      payment_mode: body.payment_mode || 'cash_on_delivery',
      
      pickup_otp: pickupOtp,
      pickup_otp_verified: false,
      notes: `PICKUP_PIN:${pickupOtp}`,
      status: 'received',
      phone_verified: Boolean(body.phone_verified),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const savedBooking = await db.createBooking(bookingPayload);

    // Send Real-time Telegram Alert to Owner (Non-blocking)
    telegram.sendTelegramMessage(telegram.formatNewBookingAlert(savedBooking)).catch(console.error);

    res.status(201).json({ booking: savedBooking });
  } catch (err) {
    next(err);
  }
});

// 4. Update Booking Status
app.patch('/api/bookings/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['received', 'reviewing', 'confirmed', 'driver_assigned', 'in_transit', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const updated = await db.updateBookingStatus(req.params.id, status, notes);
    if (!updated) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Telegram status alert
    telegram.sendTelegramMessage(telegram.formatStatusUpdateAlert(updated, 'Current', status)).catch(console.error);

    res.json({ booking: updated });
  } catch (err) {
    next(err);
  }
});

// Delete specific booking (Admin)
app.delete('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  try {
    await db.deleteBooking(req.params.id);
    res.json({ success: true, message: `Booking ${req.params.id} deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

// Clear all bookings (Admin fresh start)
app.delete('/api/bookings', requireAdmin, async (req, res, next) => {
  try {
    await db.clearAllBookings();
    res.json({ success: true, message: 'All bookings cleared successfully.' });
  } catch (err) {
    next(err);
  }
});

// 5. Assign Driver & Vehicle
app.post('/api/bookings/:id/assign', requireAdmin, async (req, res, next) => {
  try {
    const { driver_id, driver_name, driver_phone, vehicle_number } = req.body;
    if (!driver_name || !driver_phone || !vehicle_number) {
      return res.status(400).json({ error: 'Driver name, phone and vehicle number are required.' });
    }

    const updated = await db.assignDriverToBooking(req.params.id, {
      driver_id,
      driver_name,
      driver_phone,
      vehicle_number
    });

    if (!updated) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Telegram Alert for Driver Assignment
    const alertMsg = `🚚 *DRIVER ASSIGNED TO BOOKING*\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 *Booking ID:* \`${updated.id}\`\n` +
                     `👤 *Customer:* ${updated.customer_name}\n` +
                     `👨‍✈️ *Driver:* ${driver_name} (+91 ${driver_phone})\n` +
                     `🚛 *Vehicle:* ${vehicle_number}\n` +
                     `🔄 *Status:* DRIVER ASSIGNED\n` +
                     `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(alertMsg).catch(console.error);

    res.json({ booking: updated });
  } catch (err) {
    next(err);
  }
});

// 6. Verify Booking Pickup OTP (Customer shares 4-digit code with moving driver on ground)
app.post('/api/bookings/:id/verify-pickup-otp', async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Pickup OTP is required.' });
    const booking = await db.getBookingByIdOrPhone(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const expectedOtp = booking.pickup_otp || (booking.notes && booking.notes.match(/PICKUP_PIN:(\d{4})/)?.[1]);
    if (expectedOtp && String(expectedOtp).trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid Pickup Verification PIN. Please verify with customer.' });
    }

    const updated = await db.updateBookingStatus(booking.id, 'in_transit', 'Pickup PIN verified on ground. Shifting started.');
    
    // Telegram Alert for Pickup Verification
    const alertMsg = `🚚 *PICKUP VERIFIED & LOADED* ✅\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 *Booking ID:* \`${booking.id}\`\n` +
                     `👤 *Customer:* ${booking.customer_name}\n` +
                     `🔑 *Pickup PIN Verified:* \`${otp}\`\n` +
                     `🔄 *Status:* IN TRANSIT (On Route)\n` +
                     `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(alertMsg).catch(console.error);

    res.json({ success: true, booking: updated, message: 'Pickup OTP verified! Goods loaded and vehicle in transit.' });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   PARCEL DELIVERY ENDPOINTS (Porter-Style Logistics)
   ========================================================================== */

// 1. Get Parcel Rates Configuration
app.get('/api/parcels/rates', async (req, res, next) => {
  try {
    const config = await db.getConfig();
    res.json({ parcelRates: config.parcelRates || {} });
  } catch (err) {
    next(err);
  }
});

// 2. Get All Parcels (Admin)
app.get('/api/parcels', requireAdmin, async (req, res, next) => {
  try {
    const parcels = await db.getParcels();
    const { status, search } = req.query;
    let filtered = parcels;
    if (status && status !== 'all') {
      filtered = filtered.filter(p => (p.booking_status || p.status) === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.parcel_id?.toLowerCase().includes(q) ||
        p.sender_name?.toLowerCase().includes(q) ||
        p.receiver_name?.toLowerCase().includes(q) ||
        p.sender_phone?.includes(q) ||
        p.receiver_phone?.includes(q)
      );
    }
    res.json({ parcels: filtered });
  } catch (err) {
    next(err);
  }
});

// 3. Track Parcel by ID or Phone (Public)
app.get('/api/parcels/track/:idOrPhone', async (req, res, next) => {
  try {
    const parcel = await db.getParcelByIdOrPhone(req.params.idOrPhone);
    if (!parcel) {
      return res.status(404).json({ error: 'No active parcel found matching this ID or Phone number.' });
    }
    res.json({ parcel });
  } catch (err) {
    next(err);
  }
});

// 4. Create Parcel Booking
app.post('/api/parcels', async (req, res, next) => {
  try {
    const body = req.body;
    const senderName = body.sender_name || body.senderName;
    const senderPhone = String(body.sender_phone || body.senderPhone || '').replace(/\D/g, '');
    const receiverName = body.receiver_name || body.receiverName;
    const receiverPhone = String(body.receiver_phone || body.receiverPhone || '').replace(/\D/g, '');
    const pickupAddress = body.pickup_address || body.pickupAddress;
    const dropAddress = body.drop_address || body.dropAddress;

    if (!senderName || senderPhone.length !== 10 || !receiverName || receiverPhone.length !== 10 || !pickupAddress || !dropAddress) {
      return res.status(400).json({ error: 'Please provide sender name & phone, receiver name & phone, and pickup & drop addresses.' });
    }

    const parcelId = `RP-PCL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

    const parcelPayload = {
      id: parcelId,
      parcel_id: parcelId,
      sender_name: senderName,
      sender_phone: senderPhone,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      pickup_address: pickupAddress,
      pickup_lat: body.pickup_lat || null,
      pickup_lng: body.pickup_lng || null,
      drop_address: dropAddress,
      drop_lat: body.drop_lat || null,
      drop_lng: body.drop_lng || null,
      distance_km: Number(body.distance_km || body.distance || 5),
      estimated_time: body.estimated_time || '35-45 min',
      
      parcel_type: body.parcel_type || 'Package',
      weight_category: body.weight_category || body.weight || '1_5kg',
      package_size: body.package_size || 'Small',
      dimensions: body.dimensions || { length: 0, width: 0, height: 0 },
      vehicle_type: body.vehicle_type || 'bike',
      
      base_fare: Number(body.base_fare || 40),
      distance_fare: Number(body.distance_fare || 25),
      weight_fare: Number(body.weight_fare || 15),
      vehicle_fare: Number(body.vehicle_fare || 0),
      handling_fee: Number(body.handling_fee || 10),
      addons_fee: Number(body.addons_fee || 0),
      addons: body.addons || [],
      discount: Number(body.discount || 0),
      tax: Number(body.tax || 18),
      total_amount: Number(body.total_amount || 108),
      
      payment_method: body.payment_method || 'pay_at_pickup',
      payment_status: body.payment_status || 'pending',
      booking_status: 'searching_driver',
      status: 'searching_driver',
      
      driver_id: null,
      assigned_driver_name: null,
      assigned_driver_phone: null,
      assigned_vehicle_no: null,
      assigned_vehicle_type: null,
      
      pickup_otp: pickupOtp,
      pickup_otp_verified: false,
      delivery_otp: deliveryOtp,
      delivery_otp_verified: false,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const savedParcel = await db.createParcel(parcelPayload);

    // Send Telegram alert
    const alertMsg = `📦 *NEW PARCEL DELIVERY ORDER* 🛵\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 *Parcel ID:* \`${savedParcel.parcel_id}\`\n` +
                     `👤 *Sender:* ${savedParcel.sender_name} (+91 ${savedParcel.sender_phone})\n` +
                     `🎯 *Receiver:* ${savedParcel.receiver_name} (+91 ${savedParcel.receiver_phone})\n` +
                     `📍 *From:* ${savedParcel.pickup_address}\n` +
                     `🏁 *To:* ${savedParcel.drop_address}\n` +
                     `⚖️ *Parcel:* ${savedParcel.parcel_type} (${savedParcel.weight_category})\n` +
                     `🛵 *Vehicle:* ${savedParcel.vehicle_type.toUpperCase()}\n` +
                     `💰 *Fare:* ₹${savedParcel.total_amount}\n` +
                     `🔑 *Pickup OTP:* ${savedParcel.pickup_otp} | *Delivery OTP:* ${savedParcel.delivery_otp}\n` +
                     `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(alertMsg).catch(console.error);

    res.status(201).json({ parcel: savedParcel });
  } catch (err) {
    next(err);
  }
});

// 5. Assign Driver to Parcel
app.post('/api/parcels/:id/assign', requireAdmin, async (req, res, next) => {
  try {
    const { driver_id, driver_name, driver_phone, vehicle_number, vehicle_type, pickup_otp, delivery_otp } = req.body;
    if (!driver_name || !driver_phone) {
      return res.status(400).json({ error: 'Please provide driver name and phone.' });
    }

    const updated = await db.assignParcelDriver(req.params.id, {
      driver_id,
      driver_name,
      driver_phone,
      vehicle_number,
      vehicle_type,
      pickup_otp,
      delivery_otp
    });

    if (!updated) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ parcel: updated });
  } catch (err) {
    next(err);
  }
});

// 5B. Assign / Update Security OTPs for Parcel (Admin)
app.patch('/api/parcels/:id/otps', requireAdmin, async (req, res, next) => {
  try {
    const { pickup_otp, delivery_otp } = req.body;
    if (!pickup_otp && !delivery_otp) {
      return res.status(400).json({ error: 'Please provide pickup_otp or delivery_otp to update.' });
    }
    const updated = await db.assignParcelOtps(req.params.id, pickup_otp, delivery_otp);
    if (!updated) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ parcel: updated });
  } catch (err) {
    next(err);
  }
});

// 6. Update Parcel Status
app.patch('/api/parcels/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status, notes, updated_by } = req.body;
    const allowed = ['searching_driver', 'driver_assigned', 'reached_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const updated = await db.updateParcelStatus(req.params.id, status, updated_by || 'admin', notes || '');
    if (!updated) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ parcel: updated });
  } catch (err) {
    next(err);
  }
});

// 7. Verify Pickup OTP (Driver reaches sender)
app.post('/api/parcels/:id/verify-pickup-otp', requireAdminOrRider, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Pickup OTP is required' });
    const updated = await db.verifyParcelOtp(req.params.id, 'pickup', otp);

    // Send Telegram alert
    const msg = `📦 *PARCEL PICKED UP* 🛵\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 *Order:* \`${updated.parcel_id || req.params.id}\`\n` +
                `👨‍✈️ *Rider:* ${updated.assigned_driver_name || 'Driver'}\n` +
                `📍 *Pickup:* ${updated.pickup_address}\n` +
                `🏁 *Drop:* ${updated.drop_address}\n` +
                `✅ *Pickup OTP Verified:* YES\n` +
                `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(msg).catch(console.error);

    res.json({ success: true, parcel: updated, message: 'Pickup OTP verified! Parcel marked as Picked Up.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Verify Delivery OTP (Driver reaches receiver)
app.post('/api/parcels/:id/verify-delivery-otp', requireAdminOrRider, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Delivery OTP is required' });
    const updated = await db.verifyParcelOtp(req.params.id, 'delivery', otp);

    // Send Telegram alert on successful delivery
    const fare = Number(updated.total_amount || 0);
    const msg = `🎉 *PARCEL DELIVERED SUCCESSFULLY* 🏁\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 *Order:* \`${updated.parcel_id || req.params.id}\`\n` +
                `👨‍✈️ *Rider:* ${updated.assigned_driver_name || 'Driver'}\n` +
                `📍 *Drop Address:* ${updated.drop_address}\n` +
                `💰 *Collected Fare:* ₹${fare}\n` +
                `🛡️ *Delivery OTP Verified:* YES ✅\n` +
                `🎉 *Status:* DELIVERED\n` +
                `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(msg).catch(console.error);

    res.json({ success: true, parcel: updated, message: 'Delivery OTP verified! Parcel marked as Delivered.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Assign / Update OTPs for Movers Booking
app.post('/api/bookings/:id/otps', requireAdmin, async (req, res, next) => {
  try {
    const { pickup_otp, delivery_otp } = req.body;
    const updated = await db.assignBookingOtps(req.params.id, pickup_otp, delivery_otp);
    if (!updated) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ success: true, booking: updated });
  } catch (err) {
    next(err);
  }
});

// 10. Verify Movers Pickup OTP (Driver reaches customer home to load items)
app.post('/api/bookings/:id/verify-pickup-otp', requireAdminOrRider, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Pickup PIN is required' });
    const updated = await db.verifyBookingOtp(req.params.id, 'pickup', otp);

    // Send Telegram alert
    const msg = `🚚 *RELOCATION SHIPMENT LOADED & PICKED UP* 📦\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 *Booking ID:* \`${updated.id || req.params.id}\`\n` +
                `👤 *Customer:* ${updated.customer_name || 'Customer'} (+91 ${updated.customer_phone || ''})\n` +
                `👨‍✈️ *Driver:* ${updated.assigned_driver_name || 'Driver'}\n` +
                `📍 *Pickup:* ${updated.pickup_address}\n` +
                `🏁 *Destination:* ${updated.drop_address}\n` +
                `✅ *Pickup PIN Verified:* YES\n` +
                `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(msg).catch(console.error);

    res.json({ success: true, booking: updated, message: 'Pickup PIN verified! Booking marked as In Transit.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Verify Movers Delivery OTP (Driver unloads at new destination)
app.post('/api/bookings/:id/verify-delivery-otp', requireAdminOrRider, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Delivery PIN is required' });
    const updated = await db.verifyBookingOtp(req.params.id, 'delivery', otp);

    const fare = Number(updated.total_amount || 0);
    const msg = `🎉 *RELOCATION DELIVERED SUCCESSFULLY* 🏁\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 *Booking ID:* \`${updated.id || req.params.id}\`\n` +
                `👤 *Customer:* ${updated.customer_name || 'Customer'}\n` +
                `👨‍✈️ *Driver:* ${updated.assigned_driver_name || 'Driver'}\n` +
                `📍 *Destination:* ${updated.drop_address}\n` +
                `💰 *Total Amount:* ₹${fare}\n` +
                `🛡️ *Delivery PIN Verified:* YES ✅\n` +
                `🎉 *Status:* DELIVERED / COMPLETED\n` +
                `━━━━━━━━━━━━━━━━━━━━`;
    telegram.sendTelegramMessage(msg).catch(console.error);

    res.json({ success: true, booking: updated, message: 'Delivery PIN verified! Relocation marked as Delivered.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==========================================================================
   DRIVERS & FLEET ENDPOINTS
   ========================================================================== */
app.get('/api/drivers/public', async (req, res, next) => {
  try {
    const drivers = await db.getDrivers();
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

app.get('/api/drivers', requireAdmin, async (req, res, next) => {
  try {
    const rawDrivers = await db.getDrivers();
    const drivers = rawDrivers.map(d => {
      const cleanPhone = String(d.phone || '').replace(/\D/g, '');
      return {
        ...d,
        avatar_url: d.avatar_url || (cleanPhone && riderAvatarStore.has(cleanPhone) ? riderAvatarStore.get(cleanPhone) : null)
      };
    });
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

app.get('/api/drivers/lookup/:phone', async (req, res, next) => {
  try {
    const phoneClean = String(req.params.phone || '').replace(/\D/g, '');
    const drivers = await db.getDrivers();
    const driver = drivers.find(item => String(item.phone || '').replace(/\D/g, '') === phoneClean);
    if (!driver) {
      return res.status(404).json({ error: 'No approved driver found for this phone number.' });
    }
    if (!driver.avatar_url && phoneClean && riderAvatarStore.has(phoneClean)) {
      driver.avatar_url = riderAvatarStore.get(phoneClean);
    }
    res.json({ driver });
  } catch (err) {
    next(err);
  }
});

app.post('/api/drivers', requireAdmin, async (req, res, next) => {
  try {
    const { driver_name, phone, vehicle_number, vehicle_type } = req.body;
    if (!driver_name || !phone || !vehicle_number) {
      return res.status(400).json({ error: 'Driver name, phone and vehicle number are required.' });
    }
    const created = await db.createDriver({
      driver_name,
      phone: String(phone).replace(/\D/g, ''),
      vehicle_number,
      vehicle_type: vehicle_type || 'Tata Ace / Pickup',
      status: 'available',
      rating: 4.8
    });
    res.status(201).json({ driver: created });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   FEEDBACK ENDPOINTS
   ========================================================================== */
app.post('/api/feedback', async (req, res, next) => {
  try {
    const { booking_id, customer_name, rating, review } = req.body;
    const numericRating = Number(rating);
    if (!booking_id || !customer_name || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating (1-5) is required.' });
    }
    const saved = await db.addFeedback({ booking_id, customer_name, rating: numericRating, review: String(review || '').slice(0, 2000) });
    res.status(201).json({ feedback: saved });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   CONFIG & FULL CONTROL ENDPOINTS (Rates, Fleet, Coupons, Branding, Theme)
   ========================================================================== */

// 1. Get entire live website configuration
app.get('/api/config', async (req, res, next) => {
  try {
    const config = await db.getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// 2. Save / Update entire live website configuration
app.post('/api/config', requireAdmin, async (req, res, next) => {
  try {
    const updated = await db.saveConfig(req.body);
    res.json({ success: true, config: updated, message: 'Configuration saved and synced successfully.' });
  } catch (err) {
    next(err);
  }
});

// 3. Add or Update Vehicle in Fleet
app.post('/api/admin/vehicles', requireAdmin, async (req, res, next) => {
  try {
    const { vehicle_key, name, basePrice, perKmRate, icon, cap } = req.body;
    if (!vehicle_key || !name || !basePrice || !perKmRate) {
      return res.status(400).json({ error: 'Vehicle key, name, basePrice, and perKmRate are required.' });
    }

    const currentConfig = await db.getConfig();
    const cleanKey = vehicle_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    currentConfig.vehicles[cleanKey] = {
      name,
      basePrice: Number(basePrice),
      perKmRate: Number(perKmRate),
      icon: icon || 'fa-truck',
      cap: cap || 'Custom Vehicle'
    };

    const saved = await db.saveConfig(currentConfig);
    res.status(201).json({ success: true, vehicle: currentConfig.vehicles[cleanKey], config: saved });
  } catch (err) {
    next(err);
  }
});

// 4. Delete Vehicle from Fleet
app.delete('/api/admin/vehicles/:key', requireAdmin, async (req, res, next) => {
  try {
    const key = req.params.key;
    const currentConfig = await db.getConfig();

    if (!currentConfig.vehicles[key]) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    delete currentConfig.vehicles[key];
    const saved = await db.saveConfig(currentConfig);
    res.json({ success: true, message: `Vehicle ${key} deleted successfully.`, config: saved });
  } catch (err) {
    next(err);
  }
});

// 5. Add Coupon
app.post('/api/admin/coupons', requireAdmin, async (req, res, next) => {
  try {
    const { code, type, value, description } = req.body;
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: 'Coupon code, type (percent/fixed), and value are required.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const currentConfig = await db.getConfig();
    
    // Remove if existing
    currentConfig.coupons = (currentConfig.coupons || []).filter(c => c.code !== cleanCode);
    
    currentConfig.coupons.push({
      code: cleanCode,
      type: type === 'percent' ? 'percent' : 'fixed',
      value: Number(value),
      description: description || `${type === 'percent' ? value + '%' : '₹' + value} Discount`
    });

    const saved = await db.saveConfig(currentConfig);
    res.status(201).json({ success: true, coupon: currentConfig.coupons[currentConfig.coupons.length - 1], config: saved });
  } catch (err) {
    next(err);
  }
});

// 6. Delete Coupon
app.delete('/api/admin/coupons/:code', requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const currentConfig = await db.getConfig();
    currentConfig.coupons = (currentConfig.coupons || []).filter(c => c.code !== code);
    const saved = await db.saveConfig(currentConfig);
    res.json({ success: true, message: `Coupon ${code} removed.`, config: saved });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   ERROR HANDLER & SERVER LISTEN
   ========================================================================== */
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`\n🚀 Rudraksha Packers Enterprise API running at http://localhost:${port}`);
  console.log(`📦 Supabase Status: ${db.isSupabaseActive() ? 'Connected 🟢' : 'Offline JSON fallback 🟡'}`);
  console.log(`📱 OTP Mode: ${process.env.OTP_MODE || 'dev'}\n`);
});
