/**
 * اختبار شامل (End-to-End) لمعايير القبول في القسم 14 من الـ PRD.
 * ينشئ حساب طالب تجريبي، يتحقق من الحماية والتصحيح الخادمي، ثم يحذف كل أثر له.
 */
const admin = require('firebase-admin');
const path = require('path');

const SCRIPTS = 'F:/website/smart-edu-website/question-bank/scripts';
admin.initializeApp({ credential: admin.credential.cert(require(path.join(SCRIPTS, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const API_KEY = 'AIzaSyBlgUDQgKK6yxPoltILYds4VMZYjSDCyFI';
const REGION_URL = 'https://europe-west1-smart-edu-pro-d012b.cloudfunctions.net';
const EMAIL = 'e2e-test-student@smartedu-test.local';
const PASSWORD = 'TestPass!' + Math.random().toString(36).slice(2, 10);
const SUBJECT = 'islamic-11-s1';

const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); process.exitCode = 1; };

async function callFn(name, data, idToken) {
  const res = await fetch(`${REGION_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  return { status: res.status, body: await res.json() };
}

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error('signIn failed: ' + JSON.stringify(body));
  return body.idToken;
}

async function main() {
  let uid;
  try {
    // ---------- تجهيز ----------
    console.log('\n[0] إنشاء حساب طالب تجريبي...');
    const user = await admin.auth().createUser({ email: EMAIL, password: PASSWORD });
    uid = user.uid;
    await db.doc(`users/${uid}`).set({
      fullName: 'طالب اختبار آلي', phone: '0790000000', email: EMAIL,
      role: 'student', subscriptions: {}, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    let token = await signIn();
    pass('تم إنشاء الحساب وتسجيل الدخول');

    // ---------- 1) Paywall: طالب غير مفعّل ----------
    console.log('\n[1] معيار: طالب غير مفعّل لا يصل لأي سؤال');
    const denied = await callFn('startExam', { subjectId: SUBJECT, count: 10 }, token);
    if (denied.body?.error?.status === 'PERMISSION_DENIED') pass('startExam رفض الطالب غير المشترك: ' + denied.body.error.message);
    else fail('لم يُرفض! الرد: ' + JSON.stringify(denied.body).slice(0, 300));

    // ---------- 2) قراءة مباشرة لمجموعة questions من العميل ----------
    console.log('\n[2] معيار: منع القراءة المباشرة لمجموعة questions');
    const direct = await fetch(
      `https://firestore.googleapis.com/v1/projects/smart-edu-pro-d012b/databases/(default)/documents/questions?pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const directBody = await direct.json();
    if (direct.status === 403 || directBody.error) pass('Firestore رفض القراءة المباشرة (HTTP ' + direct.status + ')');
    else fail('تسريب! العميل قرأ questions مباشرة: ' + JSON.stringify(directBody).slice(0, 200));

    // ---------- 3) تفعيل الاشتراك ثم بدء اختبار ----------
    console.log('\n[3] بعد تفعيل الاشتراك: بدء اختبار');
    await db.doc(`users/${uid}`).update({
      [`subscriptions.${SUBJECT}`]: { status: 'active', subjectName: 'التربية الإسلامية', activatedAt: admin.firestore.Timestamp.now(), expiresAt: null },
    });
    const started = await callFn('startExam', { subjectId: SUBJECT, count: 10 }, token);
    const exam = started.body?.result;
    if (!exam?.attemptId) return fail('فشل بدء الاختبار: ' + JSON.stringify(started.body).slice(0, 300));
    pass(`تم بدء الاختبار — ${exam.questions.length} سؤال، المدة ${exam.durationSeconds / 60} دقيقة`);

    // ---------- 4) عدم تسريب الإجابة الصحيحة ----------
    console.log('\n[4] معيار: الإجابة الصحيحة لا تصل للمتصفح أثناء الاختبار');
    const raw = JSON.stringify(exam.questions);
    const leaked = exam.questions.some((q) => 'correctAnswerIndex' in q || 'explanation' in q);
    if (!leaked && !raw.includes('correctAnswer')) pass('لا يوجد أي أثر لـ correctAnswerIndex في حمولة الشبكة');
    else fail('تسريب! الإجابة الصحيحة موجودة في رد startExam');

    // ---------- 5) التصحيح الخادمي ----------
    console.log('\n[5] معيار: الدرجة محسوبة من الخادم');
    const truth = new Map();
    for (const q of exam.questions) {
      const doc = await db.doc(`questions/${q.id}`).get();
      truth.set(q.id, doc.data().correctAnswerIndex);
    }
    // نجيب أول 6 صح والباقي خطأ عمداً
    const answers = exam.questions.map((q, i) => ({
      questionId: q.id,
      selectedIndex: i < 6 ? truth.get(q.id) : (truth.get(q.id) + 1) % 4,
    }));
    const submitted = await callFn('submitExam', { attemptId: exam.attemptId, answers }, token);
    const result = submitted.body?.result;
    if (result?.score === 6 && result.totalQuestions === exam.questions.length) {
      pass(`التصحيح صحيح: ${result.score}/${result.totalQuestions} = ${result.percentage}% (متوقع 6)`);
    } else fail('نتيجة غير متوقعة: ' + JSON.stringify(submitted.body).slice(0, 300));

    if (result?.review?.[0]?.correctAnswerIndex !== undefined) pass('المراجعة تُعيد الإجابات الصحيحة بعد التسليم فقط');
    else fail('المراجعة لا تحتوي الإجابات الصحيحة');

    // ---------- 6) منع إعادة تسليم نفس المحاولة ----------
    console.log('\n[6] معيار: منع إعادة فتح/تسليم اختبار مُسلَّم');
    const again = await callFn('submitExam', { attemptId: exam.attemptId, answers }, token);
    if (again.body?.error?.status === 'FAILED_PRECONDITION') pass('رُفض التسليم المكرر: ' + again.body.error.message);
    else fail('سمح بالتسليم المكرر!');

    // ---------- 7) منع الكتابة المباشرة على attempts (تزوير الدرجة) ----------
    console.log('\n[7] معيار: الطالب لا يستطيع تزوير درجته');
    const forge = await fetch(
      `https://firestore.googleapis.com/v1/projects/smart-edu-pro-d012b/databases/(default)/documents/attempts/${exam.attemptId}?updateMask.fieldPaths=score`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { score: { integerValue: '999' } } }),
      }
    );
    if (forge.status === 403) pass('Firestore رفض تعديل الدرجة من العميل (HTTP 403)');
    else fail('خطر! العميل عدّل درجته — HTTP ' + forge.status);

    // ---------- 8) منع تفعيل الاشتراك ذاتياً ----------
    console.log('\n[8] معيار: الطالب لا يستطيع تفعيل اشتراكه بنفسه');
    const selfActivate = await fetch(
      `https://firestore.googleapis.com/v1/projects/smart-edu-pro-d012b/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=role`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
      }
    );
    if (selfActivate.status === 403) pass('Firestore رفض ترقية الطالب لنفسه إلى admin (HTTP 403)');
    else fail('خطر! الطالب رقّى نفسه — HTTP ' + selfActivate.status);

    // ---------- 9) منع استدعاء دوال الأدمن ----------
    console.log('\n[9] معيار: دوال الإدارة محمية');
    const adminCall = await callFn('adminOverview', {}, token);
    if (adminCall.body?.error?.status === 'PERMISSION_DENIED') pass('adminOverview رفض الطالب العادي');
    else fail('خطر! الطالب استدعى دالة إدارية: ' + JSON.stringify(adminCall.body).slice(0, 200));

  } finally {
    // ---------- تنظيف ----------
    console.log('\n[تنظيف] حذف الحساب التجريبي وكل بياناته...');
    if (uid) {
      const attempts = await db.collection('attempts').where('uid', '==', uid).get();
      for (const d of attempts.docs) await d.ref.delete();
      await db.doc(`leaderboard/${uid}`).delete().catch(() => {});
      await db.doc(`users/${uid}`).delete().catch(() => {});
      await admin.auth().deleteUser(uid).catch(() => {});
      console.log(`  ✅ حُذف الحساب و ${attempts.size} محاولة`);
    }
  }
}

main().catch((e) => { console.error('فشل الاختبار:', e); process.exitCode = 1; });
