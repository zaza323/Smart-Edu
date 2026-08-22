/**
 * ============================================================================
 *  مشغّل استيراد ملفات Word المرفوعة من لوحة الأدمن.
 * ----------------------------------------------------------------------------
 *  ينطلق تلقائياً عند رفع ملف إلى `imports/{subjectId}/{jobId}.docx`، ويستخرج
 *  الأسئلة ويكتبها في Firestore، ويحدّث سجل `importJobs/{jobId}` لحظياً لتتابعه
 *  الواجهة بلا أي تحديث يدوي.
 *
 *  ملاحظة على المنطقة: حاوية Storage للمشروع في US-CENTRAL1، ومشغّلات Storage
 *  (Eventarc) يجب أن تكون في منطقة الحاوية نفسها — لذلك هذه الدالة وحدها في
 *  us-central1 بينما بقية الدوال في europe-west1.
 * ============================================================================
 */

const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const logger = require('firebase-functions/logger');

const { extractQuestions, makeQuestionId } = require('./lib/extractQuestions');

const BATCH_LIMIT = 400;

exports.processQuestionImport = onObjectFinalized(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retry: false,
  },
  async (event) => {
    const filePath = event.data.name || '';
    if (!filePath.startsWith('imports/')) return;

    const db = getFirestore();
    const meta = event.data.metadata || {};
    const jobId = meta.jobId || filePath.split('/').pop().replace(/\.docx$/i, '');
    const jobRef = db.doc(`importJobs/${jobId}`);

    const fail = async (message) => {
      logger.error('processQuestionImport failed', { jobId, filePath, message });
      await jobRef.set(
        { status: 'failed', error: String(message).slice(0, 500), completedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    };

    try {
      if (!/\.docx$/i.test(filePath)) return fail('يُقبل ملف .docx فقط.');

      await jobRef.set({ status: 'processing' }, { merge: true });

      const subjectId = meta.subjectId || filePath.split('/')[1];
      const subjectSnap = await db.doc(`subjects/${subjectId}`).get();
      if (!subjectSnap.exists) return fail(`المادة «${subjectId}» غير موجودة.`);
      const subject = subjectSnap.data();

      // ---- تنزيل الملف واستخراج الأسئلة ----
      const [buffer] = await getStorage().bucket(event.data.bucket).file(filePath).download();

      const { questions, warnings, header, lessonTitle } = await extractQuestions(buffer, {
        subjectId,
        subject: subject.name || '',
        grade: subject.grade || '',
        semester: subject.semester || '',
        lessonNumber: meta.lessonNumber ? Number(meta.lessonNumber) : null,
        lessonTitle: meta.lessonTitle || '',
        fileName: meta.originalName || filePath.split('/').pop(),
      });

      // ---- تنبيه إن كان الملف يخصّ مادة غير المادة المستهدفة ----
      // خطأ شائع ومكلف: رفع ملف مادة إلى بطاقة مادة أخرى. لا نمنع العملية (قد
      // يكون رأس الملف مكتوباً بصيغة مختلفة) لكن نُظهر تحذيراً صريحاً في التقرير.
      const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
      const fileSubject = norm(header.subject);
      const targetSubject = norm(subject.name);
      if (
        fileSubject &&
        targetSubject &&
        !fileSubject.includes(targetSubject) &&
        !targetSubject.includes(fileSubject)
      ) {
        warnings.unshift(
          `⚠ تنبيه: رأس الملف يقول «${fileSubject}» بينما تستورد إلى مادة «${targetSubject}» — ` +
            `تأكد أنك اخترت المادة الصحيحة قبل الاعتماد على النتيجة.`
        );
      }

      // ---- حسم رقم الدرس حين لا يذكره الملف («الدرس: العنوان» بلا رقم) ----
      // القاعدة: عنوان موجود مسبقاً ⇐ نفس رقمه (فيبقى إعادة الاستيراد بلا تكرار)،
      // وإلا ⇐ الرقم التالي لأكبر درس في المادة.
      const existingLessons = subject.lessons || [];
      const resolveLessonNumber = () => {
        const match = existingLessons.find((l) => norm(l.title) === norm(lessonTitle));
        if (match) return Number(match.number);
        const max = existingLessons.reduce((m, l) => Math.max(m, Number(l.number) || 0), 0);
        return max + 1;
      };

      const missingLesson = questions.filter(
        (q) => q.lessonNumber === null || q.lessonNumber === undefined
      );
      if (missingLesson.length > 0) {
        if (!lessonTitle) {
          return fail(
            'تعذّر تحديد الدرس: الملف لا يذكر رقم الدرس ولا عنوانه. حدّدهما يدوياً من شاشة الرفع.'
          );
        }
        const resolved = resolveLessonNumber();
        for (const q of missingLesson) {
          q.lessonNumber = resolved;
          q.lesson = lessonTitle;
          // المعرّف يعتمد على رقم الدرس، فيُعاد توليده بعد حسمه
          q.docId = makeQuestionId(subjectId, resolved, q.questionText, q.optionsText);
        }
        warnings.push(
          `الملف لا يذكر رقم الدرس — أُسنِد إليه الرقم ${resolved} بعنوان «${lessonTitle}».`
        );
      }

      if (questions.length === 0) {
        await jobRef.set(
          {
            status: 'done',
            importedCount: 0,
            duplicateCount: 0,
            warnings: warnings.slice(0, 60),
            completedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      // ---- منع التكرار: نفس بصمة المعرّف المستخدمة في كل أدوات الاستيراد ----
      const unique = new Map();
      let inFileDuplicates = 0;
      for (const q of questions) {
        if (unique.has(q.docId)) inFileDuplicates += 1;
        else unique.set(q.docId, q);
      }

      const ids = [...unique.keys()];
      const existing = new Set();
      for (let i = 0; i < ids.length; i += 300) {
        const refs = ids.slice(i, i + 300).map((id) => db.doc(`questions/${id}`));
        const snaps = await db.getAll(...refs);
        snaps.forEach((s) => s.exists && existing.add(s.id));
      }

      const toWrite = [...unique.values()].filter((q) => !existing.has(q.docId));

      // ---- الكتابة على دفعات ----
      for (let i = 0; i < toWrite.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const q of toWrite.slice(i, i + BATCH_LIMIT)) {
          const { docId, ...payload } = q;
          batch.set(
            db.doc(`questions/${docId}`),
            { ...payload, createdAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
        await batch.commit();
      }

      // ---- إعادة حساب عدد الأسئلة وقائمة الدروس من Firestore نفسه ----
      const all = await db.collection('questions').where('subjectId', '==', subjectId).get();
      const lessons = new Map();
      all.forEach((snap) => {
        const q = snap.data();
        if (q.lessonNumber === null || q.lessonNumber === undefined) return;
        const entry = lessons.get(q.lessonNumber) || {
          number: q.lessonNumber,
          title: q.lesson || '',
          count: 0,
        };
        entry.count += 1;
        if (!entry.title) entry.title = q.lesson || '';
        lessons.set(q.lessonNumber, entry);
      });

      await db.doc(`subjects/${subjectId}`).set(
        {
          questionCount: all.size,
          lessons: [...lessons.values()].sort((a, b) => a.number - b.number),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await jobRef.set(
        {
          status: 'done',
          importedCount: toWrite.length,
          duplicateCount: existing.size + inFileDuplicates,
          extractedCount: questions.length,
          subjectQuestionCount: all.size,
          warnings: warnings.slice(0, 60),
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info('processQuestionImport done', {
        jobId,
        subjectId,
        imported: toWrite.length,
        duplicates: existing.size + inFileDuplicates,
        warnings: warnings.length,
      });
    } catch (err) {
      await fail(err.message || err);
    }
  }
);
