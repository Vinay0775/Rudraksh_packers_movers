/**
 * Telegram Instant Notification Service for Business Owner
 * 100% Free & Real-time alerting via Telegram Bot API
 */

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!botToken || !chatId) {
    console.log('ℹ️ [Telegram Alert Skipped] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured.');
    return { success: false, reason: 'Credentials not configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description);
      return { success: false, error: data.description };
    }

    console.log('🚀 [Telegram Notification Sent] to Owner chat');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to dispatch Telegram notification:', err.message);
    return { success: false, error: err.message };
  }
}

function formatNewBookingAlert(booking) {
  const pickup = booking.pickup_address || booking.pickup || 'N/A';
  const drop = booking.drop_address || booking.drop || 'N/A';
  const total = booking.total_amount || booking.estimatedTotal || '₹0';
  const phone = booking.customer_phone || booking.phone || 'N/A';
  const name = booking.customer_name || booking.name || 'Customer';
  const date = booking.shifting_date || booking.date || 'N/A';
  const dist = booking.distance_km || booking.distanceKm || 'N/A';

  return `📦 *NEW BOOKING RECEIVED!*\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `🆔 *ID:* \`${booking.id}\`\n` +
         `👤 *Customer:* ${name}\n` +
         `📞 *Phone:* +91 ${phone}\n` +
         `🚚 *Vehicle:* ${booking.selected_vehicle || 'Tata Ace / Mini Truck'}\n` +
         `📅 *Date:* ${date}\n` +
         `🛣️ *Distance:* ${dist} KM\n` +
         `📍 *Pickup:* ${pickup}\n` +
         `🏁 *Drop:* ${drop}\n` +
         `💰 *Total Amount:* ${typeof total === 'number' ? `₹${total.toLocaleString('en-IN')}` : total}\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `⚡ _Action Required: Open Admin Panel to confirm & assign driver._`;
}

function formatStatusUpdateAlert(booking, oldStatus, newStatus) {
  return `🔔 *BOOKING STATUS UPDATED*\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `🆔 *ID:* \`${booking.id}\`\n` +
         `👤 *Customer:* ${booking.customer_name || booking.name}\n` +
         `🔄 *Status:* ${oldStatus} ➔ *${newStatus.toUpperCase()}*\n` +
         (booking.assigned_driver_name ? `🚚 *Driver:* ${booking.assigned_driver_name} (${booking.assigned_vehicle_no})\n` : '') +
         `━━━━━━━━━━━━━━━━━━━━`;
}

module.exports = {
  sendTelegramMessage,
  formatNewBookingAlert,
  formatStatusUpdateAlert
};
