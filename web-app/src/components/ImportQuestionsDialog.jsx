import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { CheckCircle2, FileUp, Upload, X, XCircle } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { Alert, Spinner } from './ui';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_SIZE = 20 * 1024 * 1024;

export default function ImportQuestionsDialog({ subject, onClose }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [lessonNumber, setLessonNumber] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // متابعة لحظية لسجل الاستيراد — لا حاجة لأي تحديث يدوي للصفحة
  useEffect(() => {
    if (!jobId) return undefined;
    return onSnapshot(
      doc(db, 'importJobs', jobId),
      (snap) => snap.exists() && setJob({ id: snap.id, ...snap.data() }),
      (err) => setError(err.message)
    );
  }, [jobId]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    setError('');
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setError('يُقبل ملف Word بصيغة .docx فقط (وليس .doc القديمة).');
      return;
    }
    if (f.size > MAX_SIZE) {
      setError('حجم الملف كبير — الحد الأقصى 20 ميغابايت.');
      return;
    }
    setFile(f);
  }

  async function startImport() {
    if (!file) return setError('اختر ملف Word أولاً.');
    setBusy(true);
    setError('');
    try {
      const id = `${subject.id}_${Date.now()}`;

      // ننشئ سجل الاستيراد أولاً لتبدأ الواجهة بمتابعته فوراً
      await setDoc(doc(db, 'importJobs', id), {
        subjectId: subject.id,
        subjectName: subject.name || '',
        fileName: file.name,
        status: 'uploading',
        importedCount: 0,
        duplicateCount: 0,
        warnings: [],
        startedAt: serverTimestamp(),
      });
      setJobId(id);

      const path = `imports/${subject.id}/${id}.docx`;
      const task = uploadBytesResumable(ref(storage, path), file, {
        contentType: DOCX_TYPE,
        customMetadata: {
          jobId: id,
          subjectId: subject.id,
          lessonNumber: lessonNumber === '' ? '' : String(Number(lessonNumber)),
          lessonTitle: lessonTitle.trim(),
          originalName: file.name,
        },
      });

      task.on(
        'state_changed',
        (s) => setUploadPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        (err) => {
          setError(err.message);
          setBusy(false);
        },
        () => setUploadPct(100)
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const status = job?.status;
  const done = status === 'done';
  const failed = status === 'failed';
  const running = jobId && !done && !failed;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="card my-8 w-full max-w-lg space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">استيراد أسئلة من ملف Word</h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              المادة: <span className="font-bold text-accent">{subject.name}</span>
            </p>
          </div>
          <button onClick={() => onClose(done)} className="btn btn-ghost btn-sm">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {!jobId && (
          <>
            <input
              ref={fileInput}
              id="docx"
              type="file"
              accept=".docx"
              onChange={pickFile}
              className="hidden"
            />
            <label
              htmlFor="docx"
              className="block cursor-pointer rounded-2xl border-2 border-dashed border-zinc-700 p-6 text-center transition hover:border-accent"
            >
              {file ? (
                <div className="text-zinc-200">
                  <FileUp className="mx-auto mb-3 h-9 w-9 text-accent" />
                  <p className="font-bold break-all">{file.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {(file.size / 1024 / 1024).toFixed(2)} ميغابايت — اضغط للتغيير
                  </p>
                </div>
              ) : (
                <div className="text-zinc-500">
                  <Upload className="mx-auto mb-3 h-9 w-9" />
                  <p className="font-semibold text-zinc-300">اضغط لاختيار ملف .docx</p>
                  <p className="mt-1 text-xs">
                    الإجابة الصحيحة تُكتشف تلقائياً من لون الخط الأحمر
                  </p>
                </div>
              )}
            </label>

            <details className="rounded-xl bg-surface2 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
                تحديد الدرس يدوياً (اختياري)
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                يُستخرج رقم الدرس وعنوانه تلقائياً من رأس الملف. املأ هذين الحقلين فقط إن فشل
                الاستخراج التلقائي أو كان رأس الملف مختلفاً.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min="1"
                  className="field"
                  placeholder="رقم الدرس"
                  value={lessonNumber}
                  onChange={(e) => setLessonNumber(e.target.value)}
                />
                <input
                  className="field"
                  placeholder="عنوان الدرس"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                />
              </div>
            </details>

            <button onClick={startImport} disabled={busy || !file} className="btn-primary w-full">
              {busy ? <Spinner className="h-5 w-5 on-accent" /> : <Upload className="h-5 w-5" />}
              رفع وبدء الاستيراد
            </button>
          </>
        )}

        {/* التقدّم والنتيجة */}
        {jobId && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
                <span>
                  {uploadPct < 100
                    ? 'جارٍ رفع الملف...'
                    : running
                      ? 'جارٍ استخراج الأسئلة على الخادم...'
                      : 'اكتمل'}
                </span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    failed ? 'bg-red-500' : 'bg-accent'
                  } ${running && uploadPct === 100 ? 'animate-pulseSoft' : ''}`}
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>

            {running && (
              <p className="text-center text-sm text-zinc-400">
                <Spinner className="mx-auto mb-2 h-5 w-5" />
                لا تغلق النافذة — النتيجة ستظهر هنا تلقائياً.
              </p>
            )}

            {done && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
                  <p className="text-sm text-emerald-200">
                    <span className="text-lg font-extrabold">{job.importedCount}</span> سؤال
                    مستورد
                    {job.duplicateCount > 0 && ` · ${job.duplicateCount} مكرر تم تجاهله`}
                    {` · ${(job.warnings || []).length} تحذير`}
                    {(job.warnings || []).length === 0 && ' ✅'}
                  </p>
                </div>

                {(job.warnings || []).length > 0 && (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-surface2 p-3">
                    <p className="mb-2 text-xs font-bold text-amber-300">
                      تحذيرات تحتاج مراجعة يدوية:
                    </p>
                    {job.warnings.map((w, i) => (
                      <p key={i} className="text-xs leading-relaxed text-zinc-400">
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {failed && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <XCircle className="h-6 w-6 shrink-0 text-red-300" />
                <p className="text-sm leading-relaxed text-red-200">
                  فشل الاستيراد: {job.error || 'خطأ غير معروف'}
                </p>
              </div>
            )}

            {(done || failed) && (
              <button onClick={() => onClose(done)} className="btn-primary w-full">
                إغلاق
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
