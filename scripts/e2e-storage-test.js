/**
 * اختبار قواعد Firebase Storage بعد الدمج.
 * يتحقق من أمرين معاً: (أ) أن دوسيات المعلمين ما زالت تُقرأ كما كانت،
 * (ب) أن الثغرة القديمة (كتابة أي مسجَّل على أي ملف) أُغلقت فعلاً.
 * ينشئ حسابين تجريبيين ويحذفهما مع كل ما رفعاه في النهاية.
 */
const admin = require('firebase-admin');

const BUCKET = 'smart-edu-pro-d012b.firebasestorage.app';
const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const FBS = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  storageBucket: BUCKET,
});

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };

// أصغر ملف PNG صالح (1×1 بكسل)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function signIn(email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const b = await r.json();
  if (!b.idToken) throw new Error('signIn failed: ' + JSON.stringify(b));
  return b.idToken;
}

const download = (path, token) =>
  fetch(`${FBS}/${encodeURIComponent(path)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

const upload = (path, token, body, contentType) =>
  fetch(`${FBS}?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body,
  });

async function main() {
  const users = [];
  const uploaded = [];
  try {
    const stamp = Date.now();
    const mk = async (n) => {
      const email = `e2e-storage-${n}-${stamp}@smartedu-test.local`;
      const password = 'TestPass!' + Math.random().toString(36).slice(2, 10);
      const u = await admin.auth().createUser({ email, password });
      users.push(u.uid);
      return { uid: u.uid, token: await signIn(email, password) };
    };

    const a = await mk('a');
    const b = await mk('b');
    console.log('\n[0] أُنشئ حسابا طالب تجريبيان وسُجّل دخولهما');

    // ---------- 1) لم ينكسر شيء: قراءة دوسيات المعلمين ----------
    console.log('\n[1] تحقق: دوسيات المعلمين ما زالت تُقرأ (dashboard.html)');
    const [files] = await admin.storage().bucket().getFiles();
    const legacy = files.map((f) => f.name).filter((n) => !n.includes('/') && n.endsWith('.pdf'));
    let ok = 0;
    for (const name of legacy) {
      const res = await download(name, a.token);
      if (res.ok) ok++;
      else fail(`تعذّرت قراءة «${name}» — HTTP ${res.status}`);
    }
    if (ok === legacy.length && ok > 0) pass(`كل الدوسيات الـ${ok} قابلة للقراءة بحساب مسجَّل`);

    // ---------- 2) الثغرة القديمة أُغلقت ----------
    console.log('\n[2] تحقق: الطالب لم يعد يستطيع الكتابة/الاستبدال في جذر الحاوية');
    const overwrite = await upload(legacy[0], a.token, PNG, 'image/png');
    if (overwrite.status === 403) pass(`رُفض استبدال دوسية معلم «${legacy[0]}» (403)`);
    else fail(`خطر! الطالب استبدل دوسية — HTTP ${overwrite.status}`);

    const newRoot = await upload(`hack-${stamp}.pdf`, a.token, PNG, 'application/pdf');
    if (newRoot.status === 403) pass('رُفض رفع ملف جديد في الجذر (403)');
    else { fail(`خطر! الطالب رفع ملفاً في الجذر — HTTP ${newRoot.status}`); uploaded.push(`hack-${stamp}.pdf`); }

    // ---------- 3) رفع إثبات الدفع يعمل ----------
    console.log('\n[3] تحقق: رفع إثبات الدفع يعمل للطالب في مجلده');
    const own = `paymentProofs/${a.uid}/${stamp}_proof.png`;
    const up = await upload(own, a.token, PNG, 'image/png');
    if (up.ok) { pass('رفع صورة الإثبات نجح'); uploaded.push(own); }
    else fail(`فشل رفع الإثبات — HTTP ${up.status}: ${(await up.text()).slice(0, 150)}`);

    // ---------- 4) نوع الملف مقيّد بالصور ----------
    console.log('\n[4] تحقق: الملفات غير الصور مرفوضة');
    const bad = `paymentProofs/${a.uid}/${stamp}_evil.html`;
    const badRes = await upload(bad, a.token, Buffer.from('<script>x</script>'), 'text/html');
    if (badRes.status === 403) pass('رُفض رفع ملف غير صورة (403)');
    else { fail(`خطر! رُفع ملف نوعه text/html — HTTP ${badRes.status}`); uploaded.push(bad); }

    // ---------- 5) خصوصية إثباتات الدفع ----------
    console.log('\n[5] تحقق: الطالب لا يقرأ إثبات دفع طالب آخر');
    const peek = await download(own, b.token);
    if (peek.status === 403) pass('رُفضت قراءة إثبات طالب آخر (403)');
    else fail(`تسريب! طالب قرأ إثبات دفع غيره — HTTP ${peek.status}`);

    // ---------- 6) لا رفع في مجلد طالب آخر ----------
    console.log('\n[6] تحقق: الطالب لا يرفع داخل مجلد طالب آخر');
    const intoOther = `paymentProofs/${a.uid}/${stamp}_fromB.png`;
    const otherRes = await upload(intoOther, b.token, PNG, 'image/png');
    if (otherRes.status === 403) pass('رُفض الرفع في مجلد طالب آخر (403)');
    else { fail(`خطر! رفع في مجلد غيره — HTTP ${otherRes.status}`); uploaded.push(intoOther); }

  } finally {
    console.log('\n[تنظيف] حذف الحسابات والملفات التجريبية...');
    for (const p of uploaded) await admin.storage().bucket().file(p).delete().catch(() => {});
    for (const uid of users) await admin.auth().deleteUser(uid).catch(() => {});
    const [after] = await admin.storage().bucket().getFiles();
    console.log(`  ✅ حُذف ${users.length} حساب و${uploaded.length} ملف — المتبقي في الحاوية: ${after.length} ملف`);
  }
}

main().catch((e) => { console.error('فشل الاختبار:', e); process.exitCode = 1; });
