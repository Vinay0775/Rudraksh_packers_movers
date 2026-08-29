/**
 * Modular OTP Verification Service
 * Supports: Dev Mock (123456 / Terminal log), Email OTP, and Pluggable SMS Gateways
 */

const otpStore = new Map(); // phone -> { otp, expiresAt, attempts }

const OTP_MODE = process.env.OTP_MODE || 'dev';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return { success: false, error: 'Invalid phone number.' };
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  otpStore.set(cleanPhone, {
    otp,
    expiresAt,
    attempts: 0
  });

  console.log(`\n========================================`);
  console.log(`📱 [OTP SERVICE] Generated for +91 ${cleanPhone}`);
  console.log(`🔑 Verification Code: ${otp} (Valid for 5 mins)`);
  if (OTP_MODE === 'dev') {
    console.log(`💡 Dev mode is active: You can also use '123456' to verify`);
  }
  console.log(`========================================\n`);

  // In production, integrate MSG91, 2Factor, Twilio, or Firebase here
  return {
    success: true,
    message: OTP_MODE === 'dev' 
      ? `[DEV MODE] OTP sent: ${otp} (or use 123456)` 
      : 'OTP sent to your mobile number.',
    devOtp: OTP_MODE === 'dev' ? otp : undefined,
    expiresInSeconds: 300
  };
}

function verifyOTP(phone, userOtp) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  const enteredOtp = String(userOtp).trim();

  // Allow 123456 in dev mode
  if (OTP_MODE === 'dev' && enteredOtp === '123456') {
    otpStore.delete(cleanPhone);
    return { success: true, message: 'OTP verified successfully (Dev Mode).' };
  }

  const record = otpStore.get(cleanPhone);
  if (!record) {
    return { success: false, error: 'No OTP requested for this phone number or OTP expired.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return { success: false, error: 'OTP has expired. Please request a new one.' };
  }

  if (record.attempts >= 5) {
    otpStore.delete(cleanPhone);
    return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  if (record.otp !== enteredOtp) {
    record.attempts += 1;
    return { success: false, error: 'Invalid OTP entered. Please try again.' };
  }

  // Success
  otpStore.delete(cleanPhone);
  return { success: true, message: 'OTP verified successfully.' };
}

module.exports = {
  sendOTP,
  verifyOTP
};
