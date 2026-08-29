# Rudraksh Packers & Movers API

## Setup

```powershell
npm.cmd install
npm.cmd start
```

The API runs at `http://localhost:3000` by default.

## Endpoints

- `GET /api/health`
- `GET /api/bookings`
- `POST /api/bookings`
- `PATCH /api/bookings/:id/status`

Bookings are stored temporarily in `data/bookings.json`. This is suitable for local development only; production should use a hosted database and authenticated admin routes.
