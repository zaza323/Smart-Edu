/**
 * منح (أو سحب) صلاحية الأدمن لحساب مستخدم.
 *
 * الصلاحية تُخزَّن كـ Custom Claim داخل توكن المصادقة نفسه، لأن قواعد Firestore
 * تقرأها مباشرة عبر `request.auth.token.admin` دون قراءة إضافية من قاعدة البيانات.
 *
 * يُشغَّل من جذر المشروع على جهاز مسجَّل في Firebase CLI (firebase login) بحساب المالك:
 *   node scripts/set-admin.cjs admin@example.com               # منح الصلاحية
 *   node scripts/set-admin.cjs admin@example.com --revoke      # سحب الصلاحية
 *   node scripts/set-admin.cjs admin@example.com --password 'NewPass'  # منح + تعيين كلمة مرور
 *
 * الحساب يجب أن يكون موجوداً (سجّل من الموقع أولاً).
 * بعد التنفيذ يسجّل المستخدم خروجاً ثم دخولاً حتى يأخذ التوكن الصلاحية الجديدة.
 */
const { adminAuth, adminFirestore } = require('./lib/admin.cjs');

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  const pwIndex = process.argv.indexOf('--password');
  const password = pwIndex > -1 ? process.argv[pwIndex + 1] : null;
  if (pwIndex > -1 && (!password || password.length < 6)) {
    console.error('كلمة المرور بعد --password يجب أن تكون 6 أحرف على الأقل.');
    process.exit(1);
  }
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
  if (password) await auth.updateUser(user.uid, { password });

  // مزامنة الدور في مستند المستخدم (يستبعد الأدمن من قائمة الطلاب ولوحة الأبطال)
  await adminFirestore()
    .doc(`users/${user.uid}`)
    .set({ role: revoke ? 'student' : 'admin', email: user.email }, { merge: true });

  console.log(
    revoke
      ? `✅ تم سحب صلاحية الأدمن من ${user.email}`
      : `✅ تم منح صلاحية الأدمن لـ ${user.email}`
  );
  if (password) console.log('✅ تم تعيين كلمة المرور الجديدة');
  console.log('⚠ على المستخدم تسجيل الخروج ثم الدخول مجدداً لتظهر له لوحة الإدارة.');
}

main().catch((err) => {
  console.error('فشل التنفيذ:', err.message);
  process.exit(1);
});
