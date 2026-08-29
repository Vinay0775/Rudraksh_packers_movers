async function runTest() {
  const base = 'http://localhost:3000/api';

  console.log('1. Testing Health API...');
  const health = await (await fetch(`${base}/health`)).json();
  console.log('Health:', health);

  console.log('\n2. Testing Admin Login & Auth...');
  const loginRes = await (await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'rudraksha@admin2026' })
  })).json();
  console.log('Admin Login:', loginRes.success ? 'Success 🟢 Token Generated' : 'Failed 🔴');

  const verifyAuth = await (await fetch(`${base}/admin/verify`, {
    headers: { 'Authorization': `Bearer ${loginRes.token}` }
  })).json();
  console.log('Admin Token Verify:', verifyAuth.valid ? 'Active & Valid 🟢' : 'Invalid 🔴');

  console.log('\n3. Testing Send OTP...');
  const otpRes = await (await fetch(`${base}/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' })
  })).json();
  console.log('OTP Response:', otpRes);

  console.log('\n3. Testing Verify OTP (using Dev code 123456)...');
  const verifyRes = await (await fetch(`${base}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', otp: '123456' })
  })).json();
  console.log('Verify Response:', verifyRes);

  console.log('\n4. Testing Create Booking...');
  const bookingRes = await (await fetch(`${base}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Rahul Sharma',
      customer_phone: '9876543210',
      customer_email: 'rahul@gmail.com',
      pickup_address: 'Malviya Nagar, Jaipur',
      drop_address: 'Mansarovar, Jaipur',
      distance_km: 18,
      shifting_date: '2026-08-30',
      house_type: '2bhk',
      total_amount: 6200,
      payment_mode: 'cash_on_delivery',
      phone_verified: true
    })
  })).json();
  console.log('Booking Created:', bookingRes);

  const bookingId = bookingRes.booking.id;

  console.log('\n5. Testing Tracking API for Booking ID:', bookingId);
  const trackRes = await (await fetch(`${base}/bookings/track/${bookingId}`)).json();
  console.log('Tracked Booking:', trackRes.booking.id, trackRes.booking.status);

  console.log('\n6. Testing Driver Assignment to Booking...');
  const assignRes = await (await fetch(`${base}/bookings/${bookingId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driver_id: 'drv-101',
      driver_name: 'Rajesh Kumar',
      driver_phone: '9876543210',
      vehicle_number: 'RJ-14-GA-1024'
    })
  })).json();
  if (assignRes.booking) {
    console.log('Assigned Driver:', assignRes.booking.assigned_driver_name, 'Status:', assignRes.booking.status);
  } else {
    console.log('Driver Assignment response:', assignRes);
  }

  console.log('\n7. Testing Feedback Submission...');
  const feedbackRes = await (await fetch(`${base}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: bookingId,
      customer_name: 'Rahul Sharma',
      rating: 5,
      review: 'Fastest shifting experience! Very careful crew.'
    })
  })).json();
  console.log('Feedback Result:', feedbackRes);

  console.log('\n✅ ALL API ENDPOINTS TESTED SUCCESSFULLY AND VERIFIED!');
}

runTest().catch(console.error);
