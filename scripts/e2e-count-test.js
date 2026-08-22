/**
 * اختبار خيارات عدد الأسئلة في startExam (بعد إضافة «الكل» و«عدد آخر»).
 * ينشئ طالباً تجريبياً مفعّلاً، يجرّب كل الحالات، ثم يحذفه مع محاولاته.
 */
const admin = require('firebase-admin');

const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const URL = 'https://europe-west1-smart-edu-pro-d012b.cloudfunctions.net';
const SUBJECT = 'islamic-11-s1';

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };

async function callFn(name, data, token) {
  const r = await fetch(`${URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  return r.json();
}

async function main() {
  let uid;
  const email = `e2e-count-${Date.now()}@smartedu-test.local`;
  const password = 'TestPass!' + Math.random().toString(36).slice(2, 10);
  try {
    const u = await admin.auth().createUser({ email, password });
    uid = u.uid;
    await db.doc(`users/${uid}`).set({
      fullName: 'طالب اختبار العدد', phone: '0790000000', email, role: 'student',
      subscriptions: { [SUBJECT]: { status: 'active', subjectName: 'التربية الإسلامية', expiresAt: null } },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const auth = await (await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }) }
    )).json();
    const token = auth.idToken;

    const total = (await db.doc(`subjects/${SUBJECT}`).get()).data().questionCount;
    console.log(`\nإجمالي أسئلة المادة: ${total}\n`);

    const cases = [
      { label: '«الكل» (شامل)', data: { subjectId: SUBJECT, count: 'all' }, expect: total },
      { label: 'عدد مخصص 37', data: { subjectId: SUBJECT, count: 37 }, expect: 37 },
      { label: 'عدد أكبر من المتاح (999)', data: { subjectId: SUBJECT, count: 999 }, expect: total },
      { label: 'عدد جاهز 10', data: { subjectId: SUBJECT, count: 10 }, expect: 10 },
      { label: '«الكل» لدرس واحد', data: { subjectId: SUBJECT, lessonNumber: 1, count: 'all' }, expect: total },
    ];

    for (const c of cases) {
      const res = await callFn('startExam', c.data, token);
      const r = res.result;
      if (!r) { fail(`${c.label}: فشل — ${JSON.stringify(res).slice(0, 160)}`); continue; }
      const n = r.questions.length;
      const unique = new Set(r.questions.map((q) => q.id)).size;
      const okCount = n === c.expect;
      const okUnique = unique === n;
      const okTime = r.durationSeconds === n * 60;
      if (okCount && okUnique && okTime) {
        pass(`${c.label}: ${n} سؤال، كلها فريدة، المدة ${r.durationSeconds / 60} دقيقة`);
      } else {
        fail(`${c.label}: عدد=${n} (متوقع ${c.expect}) فريدة=${unique} مدة=${r.durationSeconds}s`);
      }
      // إغلاق المحاولة حتى لا تمنع بدء التالية
      await db.doc(`attempts/${r.attemptId}`).update({ status: 'abandoned' });
    }
  } finally {
    console.log('\n[تنظيف]');
    if (uid) {
      const at = await db.collection('attempts').where('uid', '==', uid).get();
      for (const d of at.docs) await d.ref.delete();
      await db.doc(`users/${uid}`).delete().catch(() => {});
      await admin.auth().deleteUser(uid).catch(() => {});
      console.log(`  ✅ حُذف الحساب و${at.size} محاولة`);
    }
  }
}

main().catch((e) => { console.error('فشل:', e); process.exitCode = 1; });
