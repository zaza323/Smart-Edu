/**
 * تفعيل كل المواد المتاحة لحسابات طلاب الهاتف (التي أنشأتها الإدارة) دفعة واحدة.
 *
 * يُشغَّل على جهاز مسجَّل دخوله في Firebase CLI (firebase login) بحساب مالك المشروع:
 *   node scripts/activate-students.cjs 0791234567 0781234567 ...
 *
 * يستخدم تسجيل دخول Firebase CLI المحفوظ على الجهاز، فلا يحتاج مفتاح خدمة.
 * أمر مستقل عن Cloud Functions، وفي مجلد منفصل حتى لا يُرفع معها.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const fnRequire = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp } = fnRequire('firebase-admin/app');
const { getFirestore, Timestamp } = fnRequire('firebase-admin/firestore');

const PROJECT_ID = 'smart-edu-pro-d012b';
const PHONE_EMAIL_DOMAIN = 'phone.smart-edu-bank.netlify.app'; // مطابق لـ web-app/src/lib/phoneLogin.js

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

function normalizePhone(input) {
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('00962')) d = d.slice(5);
  else if (d.startsWith('962')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = `0${d}`;
  return /^07[789]\d{7}$/.test(d) ? d : null;
}

async function main() {
  const phones = process.argv.slice(2);
  if (!phones.length) {
    console.log('الاستخدام: node scripts/activate-students.cjs 0791234567 0781234567 ...');
    process.exit(1);
  }

  useCliLogin();
  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();

  const subjects = (await db.collection('subjects').get()).docs.filter((d) => d.data().active !== false);
  console.log(`المواد المتاحة: ${subjects.map((d) => d.data().name || d.id).join('، ')}\n`);

  let done = 0;
  for (const raw of phones) {
    const phone = normalizePhone(raw);
    if (!phone) {
      console.log(`✗ ${raw}: رقم غير صالح`);
      continue;
    }
    const snap = await db.collection('users').where('email', '==', `${phone}@${PHONE_EMAIL_DOMAIN}`).limit(1).get();
    if (snap.empty) {
      console.log(`✗ ${phone}: لا يوجد حساب بهذا الرقم`);
      continue;
    }
    const user = snap.docs[0];
    const update = {};
    for (const s of subjects) {
      update[`subscriptions.${s.id}`] = {
        status: 'active',
        activatedAt: Timestamp.now(),
        activatedBy: 'admin-script',
        expiresAt: null,
      };
    }
    await user.ref.update(update);
    done += 1;
    console.log(`✓ ${phone}  ${user.data().fullName}`);
  }
  console.log(`\nتم تفعيل المواد لـ ${done} من ${phones.length}.`);
}

main().catch((err) => {
  console.error('فشل:', err.message);
  process.exit(1);
});
