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

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rudraksha@admin2026';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'rudraksha_enterprise_secret_2026';

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
    if (hmac !== expectedHmac) return false;
    const payload = JSON.parse(payloadStr);
    // Token valid for 7 days
    if (Date.now() - payload.time > 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'rudraksha-packers-api',
    supabaseActive: db.isSupabaseActive(),
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

    const isUserValid = !username || username.trim().toLowerCase() === ADMIN_USER.toLowerCase();
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
app.get('/api/bookings', async (req, res, next) => {
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

    if (!name || !phone || !pickup || !drop || !date) {
      return res.status(400).json({ error: 'Please provide name, phone, pickup, drop and shifting date.' });
    }

    const bookingId = body.id || `RB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Normalize amount
    let totalAmt = 0;
    if (body.total_amount) totalAmt = Number(body.total_amount);
    else if (body.estimatedTotal) totalAmt = Number(String(body.estimatedTotal).replace(/[^\d.]/g, '')) || 0;

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
app.patch('/api/bookings/:id/status', async (req, res, next) => {
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

// 5. Assign Driver & Vehicle
app.post('/api/bookings/:id/assign', async (req, res, next) => {
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

/* ==========================================================================
   DRIVERS & FLEET ENDPOINTS
   ========================================================================== */
app.get('/api/drivers', async (req, res, next) => {
  try {
    const drivers = await db.getDrivers();
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

app.post('/api/drivers', async (req, res, next) => {
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
    if (!rating) {
      return res.status(400).json({ error: 'Rating (1-5) is required.' });
    }
    const saved = await db.addFeedback({ booking_id, customer_name, rating: Number(rating), review });
    res.status(201).json({ feedback: saved });
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
