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
import { ArrowRight, Copy, ImageUp, Package, ShieldCheck, UploadCloud } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Alert, Spinner, StatusBadge, formatDate } from '../../components/ui';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * صفحة الاشتراك — لمادة واحدة (`/app/subscribe/:subjectId`) أو لباقة
 * (`/app/subscribe/bundle/:bundleId`). في الباقة يُرسَل طلب دفع واحد، وعند قبوله
 * تُفعَّل كل موادها معاً من Cloud Function.
 */
export default function SubscribePage() {
  const { subjectId, bundleId } = useParams();
  const isBundle = Boolean(bundleId);
  const targetId = bundleId || subjectId;
  const noun = isBundle ? 'الباقة' : 'المادة';
  const { user, subscriptionOf } = useAuth();
  const fileInput = useRef(null);

  // المادة أو الباقة المعروضة: { name, price, details, items? (مواد الباقة), fullPrice? }
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

  // الباقة «مفعّلة» حين تكون كل موادها مفعّلة
  const sub = isBundle
    ? {
        status:
          subject?.items?.length && subject.items.every((s) => subscriptionOf(s.id).status === 'active')
            ? 'active'
            : 'none',
      }
    : subscriptionOf(subjectId);

  useEffect(() => {
    (async () => {
      try {
        const [targetSnap, paySnap] = await Promise.all([
          getDoc(doc(db, isBundle ? 'bundles' : 'subjects', targetId)),
          getDoc(doc(db, 'settings', 'payment')),
        ]);
        setPayInfo(paySnap.exists() ? paySnap.data() : null);

        if (!targetSnap.exists()) {
          setSubject(null);
        } else if (isBundle) {
          const bundle = targetSnap.data();
          const itemSnaps = await Promise.all(
            (bundle.subjectIds || []).map((id) => getDoc(doc(db, 'subjects', id)))
          );
          const items = itemSnaps.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }));
          setSubject({
            id: targetSnap.id,
            name: bundle.name,
            price: bundle.price,
            details: bundle.description || '',
            items,
            fullPrice: items.reduce((sum, s) => sum + (Number(s.price) || 0), 0),
          });
        } else {
          const data = targetSnap.data();
          setSubject({
            id: targetSnap.id,
            ...data,
            details: [data.grade, data.semester].filter(Boolean).join(' — '),
          });
        }
      } catch {
        setError(`تعذّر تحميل بيانات ${noun}.`);
      } finally {
        setLoading(false);
      }
    })();
  }, [isBundle, targetId, noun]);

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
            .filter((r) => (isBundle ? r.bundleId === bundleId : r.subjectId === subjectId && !r.bundleId))
        ),
      () => setRequests([])
    );
  }, [user, isBundle, bundleId, subjectId]);

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
        // في الباقة يحمل subjectId معرّف الباقة (القواعد تشترط وجوده نصّاً)،
        // والمواد التي تُفعَّل تُقرأ من مستند الباقة عند القبول لا من هنا
        subjectId: targetId,
        ...(isBundle ? { bundleId } : {}),
        subject: subject?.name || targetId,
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
    return <Alert type="error">هذه {noun} غير موجودة.</Alert>;
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
            <h1 className="text-2xl font-extrabold text-accent flex items-center gap-2">
              {isBundle && <Package className="w-6 h-6 shrink-0" />}
              {subject.name}
            </h1>
            {subject.details && <p className="text-zinc-500 text-sm mt-1">{subject.details}</p>}
          </div>
          <StatusBadge status={sub.status} />
        </div>

        {isBundle && subject.items.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {subject.items.map((s) => (
              <li key={s.id} className="bg-surface2 rounded-lg px-3 py-1.5">
                {s.name}
                {s.semester && <span className="text-zinc-500"> — {s.semester}</span>}
              </li>
            ))}
          </ul>
        )}

        {subject.price != null && (
          <p className="mt-4 text-lg">
            قيمة الاشتراك:{' '}
            <span className="font-extrabold text-zinc-50 text-2xl">{subject.price}</span>{' '}
            <span className="text-zinc-400">دينار أردني</span>
            {isBundle && subject.fullPrice > Number(subject.price) && (
              <span className="text-zinc-500 text-sm mr-2">
                بدل <s>{subject.fullPrice}</s> عند الاشتراك بكل مادة منفردة
              </span>
            )}
          </p>
        )}
      </div>

      {sub.status === 'active' && (
        <Alert type="success">
          اشتراكك في هذه {noun} مفعّل.{' '}
          <Link to={isBundle ? '/app' : `/app/exam-setup/${subjectId}`} className="underline font-bold">
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
              لديك طلب قيد المراجعة لهذه {noun}. يمكنك رفع إثبات جديد فقط إذا طُلب منك ذلك.
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
          <h2 className="font-bold text-lg mb-4">طلباتك لهذه {noun}</h2>
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
