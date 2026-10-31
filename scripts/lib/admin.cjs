/**
 * تهيئة firebase-admin لأوامر الصيانة المحلية (scripts/*.cjs) بتسجيل دخول Firebase CLI
 * المحفوظ على الجهاز — بلا مفتاح خدمة. يُشغَّل على جهاز نفّذ «firebase login» بحساب مالك المشروع.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const fnRequire = require('module').createRequire(path.join(__dirname, '../../functions/package.json'));
const { getApps, initializeApp } = fnRequire('firebase-admin/app');
const { getAuth } = fnRequire('firebase-admin/auth');
const firestore = fnRequire('firebase-admin/firestore');

const PROJECT_ID = 'smart-edu-pro-d012b';

/**
 * يمرّر تسجيل دخول Firebase CLI كـ «Application Default Credentials» عبر ملف مؤقت —
 * Firestore في firebase-admin لا يقبل غير هذا النوع أو مفتاح خدمة.
 */
function useCliLogin() {
  const file = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  const token = fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).tokens?.refresh_token;
  if (!token) throw new Error('لم أجد تسجيل دخول Firebase CLI — شغّل firebase login أولاً.');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'smartedu-')), 'adc.json');
  // معرّف عميل Firebase CLI العام (نفسه المضمَّن في firebase-tools)
  fs.writeFileSync(
    tmp,
    JSON.stringify({
      type: 'authorized_user',
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: token,
      quota_project_id: PROJECT_ID,
    }),
    { mode: 0o600 }
  );
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
  process.on('exit', () => fs.rmSync(path.dirname(tmp), { recursive: true, force: true }));
}

function ensureApp() {
  if (getApps().length) return;
  if (!process.env.FIRESTORE_EMULATOR_HOST) useCliLogin();
  initializeApp({ projectId: PROJECT_ID });
}

/** Firestore جاهز للاستخدام (أو المحاكي إن ضُبط FIRESTORE_EMULATOR_HOST). */
function adminFirestore() {
  ensureApp();
  return firestore.getFirestore();
}

function adminAuth() {
  ensureApp();
  return getAuth();
}

module.exports = { adminFirestore, adminAuth, FieldValue: firestore.FieldValue, Timestamp: firestore.Timestamp };
