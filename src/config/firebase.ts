import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Firebase Configuration
// Use environment variables or actual configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase Configuration
const validateFirebaseConfig = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => {
    const value = firebaseConfig[key as keyof typeof firebaseConfig];
    return !value ||
      value === `your-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}` ||
      value === "123456789" ||
      value === "1:123456789:web:abcdef123456";
  });

  if (missingKeys.length > 0) {
    console.warn('Firebase config incomplete, please check environment variables:', missingKeys);
    console.warn('Photo upload functionality will not work properly');
    return false;
  }

  // Validate Storage Bucket correctness
  if (firebaseConfig.storageBucket && !firebaseConfig.storageBucket.includes('lien-gallery')) {
    console.warn('Storage Bucket config might be incorrect:', firebaseConfig.storageBucket);
  }

  return true;
};

// Initialize Firebase
let app: any = null;
let storage: any = null;
let db: any = null;
let analytics: any = null;
let auth: any = null;

try {
  // Validate config
  const isConfigValid = validateFirebaseConfig();

  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    db = getFirestore(app);
    auth = getAuth(app);

    // Initialize Analytics (Browser environment only)
    if (typeof window !== 'undefined') {
      try {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics initialized successfully');
      } catch (analyticsError) {
        console.warn('Firebase Analytics initialization failed (might not be needed):', analyticsError);
      }

      // Listen for auth state changes
      onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('Firebase Anonymous Auth Success:', user.uid);
        } else {
          console.log('Firebase Anonymous Auth Not Logged In');
        }
      });
    }

    console.log('Firebase initialized successfully');
    console.log('Storage Bucket:', firebaseConfig.storageBucket);
    console.log('Project ID:', firebaseConfig.projectId);
  } else {
    console.warn('Firebase config invalid, some features may not work');
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  console.error('Please check Firebase config and network connection');
  // Export null even if initialization fails, to allow app to continue running
}

// Export Firebase instances (might be null)
export { storage, db, analytics, auth };
export default app;
