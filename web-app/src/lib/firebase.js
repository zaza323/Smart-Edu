import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// مفاتيح Firebase عامة بطبيعتها في تطبيقات الويب (قسم 9/4 من الـ PRD).
// الحماية الحقيقية تأتي من Security Rules و Cloud Functions، لا من إخفاء المفاتيح.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY || 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || 'smart-edu-pro-d012b.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID || 'smart-edu-pro-d012b',
  storageBucket:
    import.meta.env.VITE_FB_STORAGE_BUCKET || 'smart-edu-pro-d012b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || '790341255920',
  appId: import.meta.env.VITE_FB_APP_ID || '1:790341255920:web:48695dbef84d2df891b835',
  measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID || 'G-8YJLLSC70J',
};

const REGION = import.meta.env.VITE_FB_FUNCTIONS_REGION || 'europe-west1';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, REGION);

/** استدعاء Cloud Function مع تحويل الأخطاء إلى رسائل عربية مفهومة. */
export async function callFn(name, payload = {}) {
  try {
    const fn = httpsCallable(functions, name);
    const res = await fn(payload);
    return res.data;
  } catch (err) {
    const e = new Error(err.message || 'حدث خطأ غير متوقع، حاول مرة أخرى.');
    e.code = err.code;
    e.details = err.details;
    throw e;
  }
}

/** رسائل أخطاء Firebase Auth بالعربية. */
export function authErrorMessage(code) {
  const map = {
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/user-disabled': 'تم تعطيل هذا الحساب. تواصل مع الإدارة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/email-already-in-use': 'هذا البريد الإلكتروني مُسجَّل مسبقاً.',
    'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل.',
    'auth/too-many-requests': 'محاولات كثيرة متتالية. انتظر قليلاً ثم أعد المحاولة.',
    'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت.',
    'auth/requires-recent-login': 'لأمانك، سجّل خروجاً ثم دخولاً وأعد المحاولة.',
  };
  return map[code] || 'حدث خطأ، يرجى المحاولة مرة أخرى.';
}
