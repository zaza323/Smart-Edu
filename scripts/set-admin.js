/**
 * منح (أو سحب) صلاحية الأدمن لحساب مستخدم.
 *
 * الصلاحية تُخزَّن كـ Custom Claim داخل توكن المصادقة نفسه، لأن قواعد Firestore
 * تقرأها مباشرة عبر `request.auth.token.admin` دون قراءة إضافية من قاعدة البيانات.
 *
 * الاستخدام:
 *   node set-admin.js admin@example.com               # منح الصلاحية
 *   node set-admin.js admin@example.com --revoke      # سحب الصلاحية
 *
 * المتطلبات:
 *   npm install
 *   مفتاح حساب خدمة باسم serviceAccountKey.json داخل هذا المجلد
 *   (Firebase Console → Project Settings → Service accounts → Generate new private key)
 *
 * ملاحظة: بعد التنفيذ يجب على المستخدم تسجيل الخروج والدخول مجدداً (أو انتظار
 * ساعة) حتى يُحدَّث التوكن ويظهر له قسم الإدارة.
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');

  if (!email) {
    console.error('الاستخدام: node set-admin.js <email> [--revoke]');
    process.exit(1);
  }

  if (!fs.existsSync(KEY_PATH)) {
    console.error(`لم يُعثر على مفتاح حساب الخدمة: ${KEY_PATH}`);
    console.error('نزّله من: Firebase Console → Project Settings → Service accounts');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, revoke ? { admin: false } : { admin: true });

  // مزامنة الحقل في مستند المستخدم أيضاً (للعرض في الواجهة والاستعلامات)
  await admin
    .firestore()
    .doc(`users/${user.uid}`)
    .set({ role: revoke ? 'student' : 'admin', email: user.email }, { merge: true });

  console.log(
    revoke
      ? `✅ تم سحب صلاحية الأدمن من ${email} (uid: ${user.uid})`
      : `✅ تم منح صلاحية الأدمن لـ ${email} (uid: ${user.uid})`
  );
  console.log('⚠ اطلب من المستخدم تسجيل الخروج ثم الدخول مجدداً ليأخذ التوكن الصلاحية الجديدة.');
}

main().catch((err) => {
  console.error('فشل التنفيذ:', err.message);
  process.exit(1);
});
