/**
 * يتحقق أن حدود الإيقاف المؤقّت مفروضة على الخادم لا في المتصفح:
 * ادّعاء إيقاف طويل أو مرات كثيرة يجب أن يُقَصّ إلى السقف (5 دقائق / مرتان).
 */
const admin = require('firebase-admin');

const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const URL = 'https://europe-west1-smart-edu-pro-d012b.cloudfunctions.net';
const SUBJECT = 'islamic-11-s1';
const MAX_PAUSES = 2;
const MAX_PAUSE_SECONDS = 300;

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };

const call = (name, data, token) =>
  fetch(`${URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  }).then((r) => r.json());

async function makeStudent() {
  const email = `e2e-pause-${Date.now()}@smartedu-test.local`;
  const password = 'TestPass!' + Math.random().toString(36).slice(2, 10);
  const u = await admin.auth().createUser({ email, password });
  await db.doc(`users/${u.uid}`).set({
    fullName: 'طالب اختبار الإيقاف', phone: '0790000000', email, grade: 'الحادي عشر', role: 'student',
    subscriptions: { [SUBJECT]: { status: 'active', subjectName: 'التربية الإسلامية', expiresAt: null } },
  });
  const auth = await (await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }) }
  )).json();
  return { uid: u.uid, token: auth.idToken };
}

async function runExam(student, extra) {
  const started = await call('startExam', { subjectId: SUBJECT, count: 5 }, student.token);
  const exam = started.result;
  const answers = [];
  for (const q of exam.questions) {
    const truth = (await db.doc(`questions/${q.id}`).get()).data().correctAnswerIndex;
    answers.push({ questionId: q.id, selectedIndex: truth });
  }
  const res = await call('submitExam', { attemptId: exam.attemptId, answers, ...extra }, student.token);
  const doc = (await db.doc(`attempts/${exam.attemptId}`).get()).data();
  return { result: res.result, doc, attemptId: exam.attemptId };
}

async function main() {
  let student;
  try {
    student = await makeStudent();
    console.log('\n[1] قيم إيقاف معقولة تُقبل كما هي');
    let r = await runExam(student, { pausedSeconds: 90, pauseCount: 1 });
    r.doc.pausedSeconds === 90 && r.doc.pauseCount === 1
      ? pass(`سُجّل: ${r.doc.pauseCount} إيقاف · ${r.doc.pausedSeconds}ث`)
      : fail(`قيم غير متوقعة: ${r.doc.pauseCount} / ${r.doc.pausedSeconds}`);

    console.log('\n[2] ادّعاء إيقاف ساعة كاملة و99 مرة → يجب القصّ للسقف');
    r = await runExam(student, { pausedSeconds: 3600, pauseCount: 99 });
    r.doc.pausedSeconds === MAX_PAUSE_SECONDS
      ? pass(`المدة قُصَّت إلى ${r.doc.pausedSeconds}ث (السقف 300)`)
      : fail(`لم تُقَصّ: ${r.doc.pausedSeconds}ث`);
    r.doc.pauseCount === MAX_PAUSES
      ? pass(`العدد قُصَّ إلى ${r.doc.pauseCount} (السقف 2)`)
      : fail(`لم يُقَصّ: ${r.doc.pauseCount}`);

    console.log('\n[3] قيم سالبة أو غير رقمية تُعامَل كصفر');
    r = await runExam(student, { pausedSeconds: -500, pauseCount: 'كثير' });
    r.doc.pausedSeconds === 0 && r.doc.pauseCount === 0
      ? pass('القيم الفاسدة صارت صفراً')
      : fail(`قيم فاسدة مرّت: ${r.doc.pausedSeconds} / ${r.doc.pauseCount}`);

    console.log('\n[4] الوقت المحتسب = الزمن الفعلي ناقص الإيقاف المسموح');
    r = await runExam(student, { pausedSeconds: 3600, pauseCount: 2 });
    r.doc.timeTakenSeconds >= 0 && r.doc.timeTakenSeconds < 60
      ? pass(`الوقت المحتسب ${r.doc.timeTakenSeconds}ث — لم يصبح سالباً رغم ادّعاء ساعة`)
      : fail(`وقت غير منطقي: ${r.doc.timeTakenSeconds}`);

    console.log('\n[5] التصحيح لم يتأثر بالإيقاف');
    r.doc.score === 5 && r.doc.totalQuestions === 5
      ? pass(`الدرجة ${r.doc.score}/5 صحيحة`)
      : fail(`درجة خاطئة: ${r.doc.score}/${r.doc.totalQuestions}`);
  } finally {
    console.log('\n[تنظيف]');
    if (student) {
      const at = await db.collection('attempts').where('uid', '==', student.uid).get();
      for (const d of at.docs) await d.ref.delete();
      await db.doc(`leaderboard/${student.uid}`).delete().catch(() => {});
      await db.doc(`users/${student.uid}`).delete().catch(() => {});
      await admin.auth().deleteUser(student.uid).catch(() => {});
      console.log(`  ✅ حُذف الحساب و${at.size} محاولة`);
    }
  }
}

main().catch((e) => { console.error('فشل:', e.message); process.exitCode = 1; });
