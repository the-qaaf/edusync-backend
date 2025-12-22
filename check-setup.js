import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
// We try to use the WABA ID from the user's previous message if not in env,
// but it's safer to ask or try the Phone ID endpoint which sometimes redirects or hints.
// Actually, for Cloud API, we subscribe the WABA.
// Let's assume the user has WABA_ID in env or we use the known one.
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1307706931044592';
const API_VERSION = 'v24.0';

async function checkSubscription() {
  console.log('🔍 Checking Webhook Subscription...');

  if (!TOKEN) {
    console.error('❌ Error: WHATSAPP_ACCESS_TOKEN is missing in .env');
    return;
  }

  try {
    // 1. Check Subscribed Apps
    const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/subscribed_apps`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    const subscriptions = response.data.data || [];
    console.log('📋 Current Subscriptions:', JSON.stringify(subscriptions, null, 2));

    const isSubscribed = subscriptions.length > 0;

    if (isSubscribed) {
      console.log('✅ Your App is ALREADY SUBSCRIBED to this WhatsApp Business Account.');
    } else {
      console.log('⚠️  App is NOT subscribed. Attempting to subscribe now...');
      await subscribeApp();
    }

  } catch (error) {
    console.error('❌ Failed to check subscription:', error.response?.data || error.message);
    if (error.response?.status === 400 || error.response?.status === 404) {
      console.log('💡 Tip: Ensure WHATSAPP_BUSINESS_ACCOUNT_ID is correct. Using:', WABA_ID);
    }
  }
}

async function subscribeApp() {
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/subscribed_apps`;
    const response = await axios.post(url, {}, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (response.data.success) {
      console.log('🚀 SUCCESS: App subscribed to WABA! You should receive messages now.');
    } else {
      console.log('❓ Subscribe response:', response.data);
    }
  } catch (error) {
    console.error('❌ Failed to verify subscription:', error.response?.data || error.message);
  }
}

checkSubscription();
