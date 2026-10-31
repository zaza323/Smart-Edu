/**
 * منح (أو سحب) صلاحية الأدمن لحساب مستخدم.
 *
 * الصلاحية تُخزَّن كـ Custom Claim داخل توكن المصادقة نفسه، لأن قواعد Firestore
 * تقرأها مباشرة عبر `request.auth.token.admin` دون قراءة إضافية من قاعدة البيانات.
 *
 * يُشغَّل من جذر المشروع على جهاز مسجَّل في Firebase CLI (firebase login) بحساب المالك:
 *   node scripts/set-admin.cjs admin@example.com               # منح الصلاحية
 *   node scripts/set-admin.cjs admin@example.com --revoke      # سحب الصلاحية
 *
 * الحساب يجب أن يكون موجوداً (سجّل من الموقع أولاً).
 * بعد التنفيذ يسجّل المستخدم خروجاً ثم دخولاً حتى يأخذ التوكن الصلاحية الجديدة.
 */
const { adminAuth, adminFirestore } = require('./lib/admin.cjs');

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  if (!email || email.startsWith('--')) {
    console.error('الاستخدام: node scripts/set-admin.cjs <email> [--revoke]');
    process.exit(1);
  }

  const auth = adminAuth();
  const user = await auth.getUserByEmail(email.trim()).catch((err) => {
    if (err.code === 'auth/user-not-found') throw new Error(`لا يوجد حساب بالبريد ${email} — سجّل من الموقع أولاً.`);
    throw err;
  });
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: !revoke });

  // مزامنة الدور في مستند المستخدم (يستبعد الأدمن من قائمة الطلاب ولوحة الأبطال)
  await adminFirestore()
    .doc(`users/${user.uid}`)
    .set({ role: revoke ? 'student' : 'admin', email: user.email }, { merge: true });

  console.log(
    revoke
      ? `✅ تم سحب صلاحية الأدمن من ${user.email}`
      : `✅ تم منح صلاحية الأدمن لـ ${user.email}`
  );
  console.log('⚠ على المستخدم تسجيل الخروج ثم الدخول مجدداً لتظهر له لوحة الإدارة.');
}

main().catch((err) => {
  console.error('فشل التنفيذ:', err.message);
  process.exit(1);
});
