
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
if (!admin.apps.length) {
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({ credential });
    console.log('Firebase Admin Service Initialized');
  } catch (error) {
    console.error('Firebase Init Error:', error.message);
  }
}

export const db = admin.firestore();
export { admin };

