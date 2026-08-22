/**
 * اختبار «لوحة الأبطال» — معايير القبول في مستند الميزة.
 * ينشئ 3 طلاب تجريبيين بنتائج مختلفة، يتحقق من التراكم والترتيب والخصوصية،
 * ثم يحذفهم مع كل بياناتهم.
 */
const admin = require('firebase-admin');

const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const URL = 'https://europe-west1-smart-edu-pro-d012b.cloudfunctions.net';
const FS = 'https://firestore.googleapis.com/v1/projects/smart-edu-pro-d012b/databases/(default)/documents';
const SUBJECT = 'islamic-11-s1';

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };

const callFn = (name, data, token) =>
  fetch(`${URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  }).then((r) => r.json());

async function makeStudent(name, grade) {
  const email = `e2e-lb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@smartedu-test.local`;
  const password = 'TestPass!' + Math.random().toString(36).slice(2, 10);
  const u = await admin.auth().createUser({ email, password });
  await db.doc(`users/${u.uid}`).set({
    fullName: name, phone: '0790000000', email, grade, role: 'student',
    subscriptions: { [SUBJECT]: { status: 'active', subjectName: 'التربية الإسلامية', expiresAt: null } },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const auth = await (await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }) }
  )).json();
  return { uid: u.uid, token: auth.idToken, name };
}

/** يخوض اختباراً ويجيب بشكل صحيح على `correctCount` سؤالاً بالضبط. */
async function takeExam(student, total, correctCount) {
  const started = await callFn('startExam', { subjectId: SUBJECT, count: total }, student.token);
  const exam = started.result;
  if (!exam) throw new Error('startExam failed: ' + JSON.stringify(started).slice(0, 200));

  const answers = [];
  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    const truth = (await db.doc(`questions/${q.id}`).get()).data().correctAnswerIndex;
    answers.push({ questionId: q.id, selectedIndex: i < correctCount ? truth : (truth + 1) % 4 });
  }
  const res = await callFn('submitExam', { attemptId: exam.attemptId, answers }, student.token);
  return res.result;
}

async function main() {
  const students = [];
  try {
    console.log('\n[0] إنشاء 3 طلاب تجريبيين...');
    const a = await makeStudent('أحمد التجريبي', 'الثاني عشر (التوجيهي)');
    const b = await makeStudent('بشار التجريبي', 'الحادي عشر');
    const c = await makeStudent('كريم التجريبي', 'الحادي عشر');
    students.push(a, b, c);
    pass('تم إنشاء الحسابات وتفعيل اشتراكاتها');

    // ---------- 1) التراكم عبر عدة اختبارات ----------
    console.log('\n[1] معيار: النقاط تتراكم داخل دالة التصحيح نفسها');
    const r1 = await takeExam(a, 10, 9);
    const r2 = await takeExam(a, 10, 6); // مجموع أحمد = 15
    await takeExam(b, 10, 4);            // بشار = 4
    await takeExam(c, 10, 7);            // كريم = 7

    const lbA = (await db.doc(`leaderboard/${a.uid}`).get()).data();
    const expected = r1.score + r2.score;
    if (lbA?.subjectScores?.[SUBJECT] === expected) {
      pass(`تراكم صحيح: ${r1.score} + ${r2.score} = ${expected} إجابة صحيحة`);
    } else {
      fail(`تراكم خاطئ: المخزّن ${JSON.stringify(lbA?.subjectScores)} والمتوقع ${expected}`);
    }

    // ---------- 2) الاسم والصف يُخزَّنان للعرض ----------
    console.log('\n[2] معيار: يظهر الاسم الحقيقي والصف');
    if (lbA.fullName === 'أحمد التجريبي' && lbA.grade === 'الثاني عشر (التوجيهي)') {
      pass(`الاسم والصف محفوظان: «${lbA.fullName}» — ${lbA.grade}`);
    } else fail('الاسم أو الصف غير محفوظ: ' + JSON.stringify(lbA));

    // ---------- 3) لا بريد ولا هاتف في مجموعة العرض ----------
    console.log('\n[3] معيار الخصوصية: لا بيانات تواصل في لوحة الأبطال');
    const keys = Object.keys(lbA);
    const leaky = keys.filter((k) => ['email', 'phone', 'subscriptions', 'role'].includes(k));
    if (leaky.length === 0) pass('الحقول المخزّنة: ' + keys.join(', '));
    else fail('تسريب بيانات حساسة: ' + leaky.join(', '));

    // ---------- 4) الترتيب التنازلي ----------
    console.log('\n[4] معيار: الترتيب تنازلي حسب عدد الإجابات الصحيحة');
    const snap = await db.collection('leaderboard')
      .orderBy(new admin.firestore.FieldPath('subjectScores', SUBJECT), 'desc').limit(50).get();
    const board = snap.docs.map((d) => ({ uid: d.id, name: d.data().fullName, score: d.data().subjectScores[SUBJECT] }));
    const mine = board.filter((r) => students.some((s) => s.uid === r.uid));
    console.log('    الترتيب بين التجريبيين: ' + mine.map((m, i) => `${m.name}=${m.score}`).join(' > '));
    const sorted = mine.every((r, i) => i === 0 || mine[i - 1].score >= r.score);
    const order = mine[0]?.uid === a.uid && mine[1]?.uid === c.uid && mine[2]?.uid === b.uid;
    if (sorted && order) pass('الترتيب صحيح: أحمد (الأعلى) ثم كريم ثم بشار');
    else fail('ترتيب غير متوقع: ' + JSON.stringify(mine));

    // ---------- 5) الطالب يقرأ اللوحة، ولا يقرأ users الآخرين ----------
    console.log('\n[5] معيار الأمان: الطالب يقرأ اللوحة فقط لا مستندات الطلاب');
    const lbRead = await fetch(`${FS}/leaderboard?pageSize=5`, { headers: { Authorization: `Bearer ${b.token}` } });
    if (lbRead.ok) pass('قراءة مجموعة leaderboard مسموحة للطالب (HTTP 200)');
    else fail('الطالب لا يستطيع قراءة اللوحة — HTTP ' + lbRead.status);

    const usersRead = await fetch(`${FS}/users?pageSize=5`, { headers: { Authorization: `Bearer ${b.token}` } });
    if (usersRead.status === 403) pass('قراءة مجموعة users ما زالت مرفوضة (403) — البريد والهاتف محميان');
    else fail('خطر! الطالب قرأ مستندات users — HTTP ' + usersRead.status);

    // ---------- 6) الطالب لا يزوّر نقاطه ----------
    console.log('\n[6] معيار: الطالب لا يستطيع تعديل نقاطه');
    const forge = await fetch(
      `${FS}/leaderboard/${b.uid}?updateMask.fieldPaths=subjectScores`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { subjectScores: { mapValue: { fields: { [SUBJECT]: { integerValue: '9999' } } } } } }) }
    );
    if (forge.status === 403) pass('رُفض تعديل النقاط من العميل (403)');
    else fail('خطر! الطالب عدّل نقاطه — HTTP ' + forge.status);

    // ---------- 7) الطالب يزامن اسمه وصفه فقط ----------
    console.log('\n[7] معيار: الطالب يزامن اسمه وصفه من صفحة حسابي');
    const rename = await fetch(
      `${FS}/leaderboard/${b.uid}?updateMask.fieldPaths=fullName&updateMask.fieldPaths=grade`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { fullName: { stringValue: 'بشار المعدَّل' }, grade: { stringValue: 'الحادي عشر' } } }) }
    );
    if (rename.ok) pass('تعديل الاسم والصف مسموح (HTTP 200)');
    else fail('تعذّر على الطالب تعديل اسمه — HTTP ' + rename.status);

    // ---------- 8) حساب المركز بعدّاد رخيص ----------
    console.log('\n[8] معيار: حساب المركز بلا قراءة كل المستندات');
    const myScore = 4; // بشار
    const ahead = await db.collection('leaderboard')
      .where(new admin.firestore.FieldPath('subjectScores', SUBJECT), '>', myScore).count().get();
    pass(`مركز بشار = ${ahead.data().count + 1} (محسوب بعدّاد aggregation لا بقراءة المستندات)`);

  } finally {
    console.log('\n[تنظيف]');
    for (const s of students) {
      const at = await db.collection('attempts').where('uid', '==', s.uid).get();
      for (const d of at.docs) await d.ref.delete();
      await db.doc(`leaderboard/${s.uid}`).delete().catch(() => {});
      await db.doc(`users/${s.uid}`).delete().catch(() => {});
      await admin.auth().deleteUser(s.uid).catch(() => {});
    }
    const left = await db.collection('leaderboard').get();
    console.log(`  ✅ حُذف ${students.length} حساب — المتبقي في leaderboard: ${left.size}`);
  }
}

main().catch((e) => { console.error('فشل:', e); process.exitCode = 1; });
