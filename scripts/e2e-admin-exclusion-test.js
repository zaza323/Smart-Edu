/**
 * يتحقق أن حسابات الإدارة مستثناة من لوحة الأبطال، وأن الطالب يظهر عليها.
 */
const admin = require('firebase-admin');

const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const URL = 'https://europe-west1-smart-edu-pro-d012b.cloudfunctions.net';
const SUBJECT = 'islamic-11-s1';

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const call = (name, data, token) =>
  fetch(`${URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  }).then((r) => r.json());

async function signIn(email, password, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const b = await (await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }) }
      )).json();
      if (b.idToken) return b.idToken;
      throw new Error(JSON.stringify(b.error || b).slice(0, 120));
    } catch (e) {
      if (i === tries) throw e;
      console.log(`    (محاولة تسجيل دخول ${i} فشلت، إعادة...)`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function main() {
  const made = [];
  try {
    const mk = async (name, role) => {
      const email = `e2e-role-${Date.now()}${Math.random().toString(36).slice(2, 6)}@smartedu-test.local`;
      const password = 'TestPass!' + Math.random().toString(36).slice(2, 10);
      const u = await admin.auth().createUser({ email, password });
      made.push(u.uid);
      if (role === 'admin') await admin.auth().setCustomUserClaims(u.uid, { admin: true });
      await db.doc(`users/${u.uid}`).set({
        fullName: name, phone: '0790000000', email, grade: 'الحادي عشر', role,
        subscriptions: { [SUBJECT]: { status: 'active', subjectName: 'التربية الإسلامية', expiresAt: null } },
      });
      return { uid: u.uid, token: await signIn(email, password), name, role };
    };

    console.log('\n[0] إنشاء حساب إدارة وحساب طالب...');
    const adminUser = await mk('أدمن تجريبي', 'admin');
    const student = await mk('طالب تجريبي', 'student');
    console.log('  ✅ جاهزان');

    console.log('\n[1] كلاهما يخوض اختباراً ويجيب إجابات صحيحة كاملة');
    for (const p of [adminUser, student]) {
      const started = await call('startExam', { subjectId: SUBJECT, count: 5 }, p.token);
      const exam = started.result;
      if (!exam) { console.log(`  ❌ ${p.name}: فشل بدء الاختبار — ${JSON.stringify(started).slice(0, 160)}`); process.exitCode = 1; continue; }

      const answers = [];
      for (const q of exam.questions) {
        const truth = (await db.doc(`questions/${q.id}`).get()).data().correctAnswerIndex;
        answers.push({ questionId: q.id, selectedIndex: truth });
      }
      const res = await call('submitExam', { attemptId: exam.attemptId, answers }, p.token);
      const onBoard = (await db.doc(`leaderboard/${p.uid}`).get()).exists;
      const shouldBeOnBoard = p.role === 'student';

      if (onBoard === shouldBeOnBoard) {
        console.log(`  ✅ ${p.name} (${p.role}): درجة ${res.result.score}/5 — ${onBoard ? 'ظهر على اللوحة' : 'لم يظهر على اللوحة'} كما هو متوقع`);
      } else {
        console.log(`  ❌ ${p.name} (${p.role}): ${onBoard ? 'ظهر' : 'لم يظهر'} والمتوقع ${shouldBeOnBoard ? 'أن يظهر' : 'ألا يظهر'}`);
        process.exitCode = 1;
      }
    }
  } finally {
    console.log('\n[تنظيف]');
    for (const uid of made) {
      const at = await db.collection('attempts').where('uid', '==', uid).get();
      for (const d of at.docs) await d.ref.delete();
      await db.doc(`leaderboard/${uid}`).delete().catch(() => {});
      await db.doc(`users/${uid}`).delete().catch(() => {});
      await admin.auth().deleteUser(uid).catch(() => {});
    }
    const left = await db.collection('leaderboard').get();
    console.log(`  ✅ حُذف ${made.length} حساب — المتبقي في leaderboard: ${left.size}`);
  }
}

main().catch((e) => { console.error('فشل:', e.message); process.exitCode = 1; });
