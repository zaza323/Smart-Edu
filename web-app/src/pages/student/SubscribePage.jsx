import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ArrowRight, Copy, ImageUp, ShieldCheck, UploadCloud } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Alert, Spinner, StatusBadge, formatDate } from '../../components/ui';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export default function SubscribePage() {
  const { subjectId } = useParams();
  const { user, subscriptionOf } = useAuth();
  const fileInput = useRef(null);

  const [subject, setSubject] = useState(null);
  const [payInfo, setPayInfo] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  const sub = subscriptionOf(subjectId);

  useEffect(() => {
    (async () => {
      try {
        const [subjSnap, paySnap] = await Promise.all([
          getDoc(doc(db, 'subjects', subjectId)),
          getDoc(doc(db, 'settings', 'payment')),
        ]);
        setSubject(subjSnap.exists() ? { id: subjSnap.id, ...subjSnap.data() } : null);
        setPayInfo(paySnap.exists() ? paySnap.data() : null);
      } catch {
        setError('تعذّر تحميل بيانات المادة.');
      } finally {
        setLoading(false);
      }
    })();
  }, [subjectId]);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(
      collection(db, 'paymentRequests'),
      where('uid', '==', user.uid),
      orderBy('submittedAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) =>
        setRequests(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => r.subjectId === subjectId)
        ),
      () => setRequests([])
    );
  }, [user, subjectId]);

  const hasPending = useMemo(() => requests.some((r) => r.status === 'pending'), [requests]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    setError('');
    setSuccess('');
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError('يُسمح برفع الصور فقط (JPG / PNG / WEBP).');
      return;
    }
    if (f.size > MAX_SIZE) {
      setError('حجم الصورة كبير — الحد الأقصى 5 ميغابايت.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!file) {
      setError('اختر صورة إثبات الدفع أولاً.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const safeName = file.name.replace(/[^\w.\-]/g, '_');
      const path = `paymentProofs/${user.uid}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'paymentRequests'), {
        uid: user.uid,
        subjectId,
        subject: subject?.name || subjectId,
        amount: subject?.price ?? null,
        proofImageUrl: url,
        proofPath: path,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      setFile(null);
      setPreview('');
      if (fileInput.current) fileInput.current.value = '';
      setSuccess('تم إرسال طلبك بنجاح! ستتم مراجعته من قِبل الإدارة وتفعيل اشتراكك.');
    } catch (err) {
      setError(err.message || 'تعذّر رفع الصورة، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  function copyText(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!subject) {
    return <Alert type="error">هذه المادة غير موجودة.</Alert>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/app" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-accent">
        <ArrowRight className="w-4 h-4" />
        رجوع للمواد
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-accent">{subject.name}</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {[subject.grade, subject.semester].filter(Boolean).join(' — ')}
            </p>
          </div>
          <StatusBadge status={sub.status} />
        </div>
        {subject.price != null && (
          <p className="mt-4 text-lg">
            قيمة الاشتراك:{' '}
            <span className="font-extrabold text-zinc-50 text-2xl">{subject.price}</span>{' '}
            <span className="text-zinc-400">دينار أردني</span>
          </p>
        )}
      </div>

      {sub.status === 'active' && (
        <Alert type="success">
          اشتراكك في هذه المادة مفعّل.{' '}
          <Link to={`/app/exam-setup/${subjectId}`} className="underline font-bold">
            ابدأ اختباراً الآن
          </Link>
        </Alert>
      )}

      {/* بيانات التحويل */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          بيانات التحويل
        </h2>

        {payInfo ? (
          <div className="space-y-3">
            {[
              ['اسم صاحب الحساب', payInfo.accountName],
              ['البنك', payInfo.bankName],
              ['رقم الحساب / IBAN', payInfo.iban],
              ['المحفظة الإلكترونية', payInfo.wallet],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 bg-surface2 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p dir="ltr" className="font-bold truncate text-right">
                      {value}
                    </p>
                  </div>
                  <button
                    onClick={() => copyText(value, label)}
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                    {copied === label ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>
              ))}
            {payInfo.note && <p className="text-sm text-zinc-400 leading-relaxed">{payInfo.note}</p>}
          </div>
        ) : (
          <Alert type="warning">
            لم تُضَف بيانات التحويل بعد. تواصل مع الإدارة للحصول عليها قبل رفع الإثبات.
          </Alert>
        )}
      </div>

      {/* رفع الإثبات */}
      {sub.status !== 'active' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-accent" />
            رفع إثبات الدفع
          </h2>

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>
          {hasPending && (
            <Alert type="info">
              لديك طلب قيد المراجعة لهذه المادة. يمكنك رفع إثبات جديد فقط إذا طُلب منك ذلك.
            </Alert>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={pickFile}
            className="hidden"
            id="proof"
          />
          <label
            htmlFor="proof"
            className="block border-2 border-dashed border-zinc-700 rounded-2xl p-6 text-center cursor-pointer hover:border-accent transition"
          >
            {preview ? (
              <img
                src={preview}
                alt="معاينة الإثبات"
                className="max-h-64 mx-auto rounded-xl object-contain"
              />
            ) : (
              <div className="text-zinc-500">
                <ImageUp className="w-9 h-9 mx-auto mb-3" />
                <p className="font-semibold text-zinc-300">اضغط لاختيار صورة إثبات التحويل</p>
                <p className="text-xs mt-1">JPG أو PNG — بحد أقصى 5 ميغابايت</p>
              </div>
            )}
          </label>

          <button onClick={handleUpload} disabled={busy || !file} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5 on-accent" /> : <UploadCloud className="w-5 h-5" />}
            إرسال الطلب للمراجعة
          </button>
        </div>
      )}

      {/* سجل الطلبات */}
      {requests.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-lg mb-4">طلباتك لهذه المادة</h2>
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-surface2 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-400">{formatDate(r.submittedAt)}</p>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === 'rejected' && r.rejectionReason && (
                  <p className="text-sm text-red-300 mt-2">سبب الرفض: {r.rejectionReason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
