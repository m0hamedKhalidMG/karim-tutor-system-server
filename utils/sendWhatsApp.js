const BOT_SERVER_URL = process.env.BOT_SERVER_URL || 'http://localhost:5001';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'karim_bot_secret';

async function sendWhatsApp(phone, messageText) {
  try {
    const response = await fetch(`${BOT_SERVER_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_API_SECRET
      },
      body: JSON.stringify({ phone, message: messageText })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        error: data.message || `Bot server error: ${response.status}` 
      };
    }

    return { 
      success: true, 
      messageId: data.data?.messageId || 'sent' 
    };
  } catch (err) {
    return { 
      success: false, 
      error: err.message || 'Failed to connect to WhatsApp bot server. Is it running?' 
    };
  }
}

module.exports = { sendWhatsApp };
