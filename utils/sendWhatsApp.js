const BOT_SERVER_URL = process.env.BOT_SERVER_URL || 'http://localhost:5001';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'karim_bot_secret';

async function sendWhatsApp(phone, messageText) {
  try {
    console.log(`[WhatsApp] Sending to ${phone}: ${messageText.slice(0, 50)}...`);
    const response = await fetch(`${BOT_SERVER_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_API_SECRET
      },
      body: JSON.stringify({ phone, message: messageText })
    });

    const data = await response.json();
    console.log(`[WhatsApp] Bot response:`, JSON.stringify(data));
    
    if (!response.ok) {
      return { 
        success: false, 
        error: data.message || `Bot server error: ${response.status}` 
      };
    }

    // IMPORTANT: check the bot's internal success flag, not just HTTP status
    const botResult = data.data || {};
    if (botResult.success === false) {
      return {
        success: false,
        error: botResult.error || data.message || 'Bot failed to send message'
      };
    }

    return { 
      success: true, 
      messageId: botResult.messageId || 'sent' 
    };
  } catch (err) {
    console.error(`[WhatsApp] Error:`, err.message);
    return { 
      success: false, 
      error: err.message || 'Failed to connect to WhatsApp bot server. Is it running?' 
    };
  }
}

module.exports = { sendWhatsApp };
