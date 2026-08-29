# Rudraksha Packers & Movers - Enterprise MVP Suite

India's premier Packers & Movers web application featuring:
- **Interactive Moving Cost Calculator**: Multi-step wizard with dynamic inventory, floor labor, and discount calculations.
- **OpenStreetMap & Leaflet.js Route Distance Engine**: Automatic road distance calculation using OSRM and reverse geocoding via Nominatim.
- **Browser Geolocation**: "Use My Location" GPS picker.
- **OTP Verification Flow**: Modular OTP (Dev Mode `123456` + SMS/Email Gateway ready).
- **Driver & Fleet Management**: Assign vehicles, track status, and dispatch crews.
- **Telegram Bot Instant Alerts**: Direct owner notifications on new bookings and driver assignments.
- **Live Customer Tracking Portal**: Visual progress stepper (`Received` ➔ `Reviewing` ➔ `Confirmed` ➔ `Driver Assigned` ➔ `In Transit` ➔ `Delivered`).
- **GST-Compliant Tax Quotation & Invoice**: Printable / Save-as-PDF invoice with UPI QR Code.
- **Supabase Integration & Local Fallback**: Zero configuration needed for local dev, seamless PostgreSQL cloud sync with Supabase.

---

## 📁 Project Structure

```
├── Backend/
│   ├── .env.example             # Environment variable template (Supabase, Telegram, OTP)
│   ├── supabase_schema.sql      # Supabase 1-Click Database Setup Script
│   ├── server.js                # Express Enterprise REST API
│   ├── services/
│   │   ├── supabase.js          # Database access layer (Supabase + Local JSON fallback)
│   │   ├── telegram.js          # Real-time Telegram Bot Notification service
│   │   └── otp.js               # Modular OTP verification service
│   ├── data/                    # Local storage fallback (bookings, drivers, feedback)
│   └── test_api.js              # Automated backend test suite
│
└── Frontend/
    ├── index.html               # Customer Booking Portal, Leaflet Map, Tracking & Invoices
    ├── app.js                   # Client-side Route Engine, OTP & Booking Checkout
    ├── admin.html               # Admin Dashboard, Fleet Manager & Rate Manager
    ├── admin.js                 # Admin API controller & Real-time Sync
    ├── style.css                # Master CSS with Dynamic Theming & Glassmorphism
    └── logo.png / favicon.png   # Brand Assets
```

---

## 🚀 Quick Start Guide

### 1. Start the Backend API

```powershell
cd Backend
npm install
npm start
```
The API will run at `http://localhost:3000`.

### 2. Open Frontend

Open `Frontend/index.html` in your browser (or use Live Server / double click).
- Customer Portal: `Frontend/index.html`
- Admin Dashboard: `Frontend/admin.html`

---

## ⚙️ Connecting Free Supabase Database (Optional)

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project.
3. Open the **SQL Editor** in Supabase dashboard and paste the contents of `Backend/supabase_schema.sql`, then click **Run**.
4. Copy your **Project URL** and **Service Role / Anon Key** into `Backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-key
   ```
5. Restart backend (`npm start`). The API will now automatically persist all data directly into Supabase PostgreSQL!

---

## 🔔 Setting Up Free Telegram Owner Alerts (Optional)

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` to create your bot and copy the **Bot Token**.
3. Search for `@userinfobot` on Telegram to get your numeric **Chat ID**.
4. Add them to `Backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```
5. Every time a customer books or a driver is assigned, you'll receive an instant formatted alert on your phone!
