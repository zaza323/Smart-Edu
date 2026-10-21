import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Check, CreditCard, ExternalLink, X } from 'lucide-react';
import { callFn, db } from '../../lib/firebase';
import { Alert, EmptyState, Spinner, StatusBadge, formatDate } from '../../components/ui';

const TABS = [
  ['pending', 'معلّقة'],
  ['approved', 'مقبولة'],
  ['rejected', 'مرفوضة'],
];

export default function PaymentsPage() {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [zoom, setZoom] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'paymentRequests'),
      where('status', '==', tab),
      orderBy('submittedAt', 'desc'),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, [tab]);

  // جلب بيانات الطلاب المرتبطة بالطلبات المعروضة
  const uids = useMemo(() => [...new Set(requests.map((r) => r.uid))], [requests]);
  useEffect(() => {
    (async () => {
      const missing = uids.filter((u) => !students[u]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            return [uid, snap.exists() ? snap.data() : null];
          } catch {
            return [uid, null];
          }
        })
      );
      setStudents((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids]);

  async function approve(id) {
    setBusyId(id);
    setError('');
    try {
      await callFn('approvePayment', { requestId: id });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function reject() {
    setBusyId(rejecting);
    setError('');
    try {
      await callFn('rejectPayment', { requestId: rejecting, reason });
      setRejecting(null);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">طلبات الدفع</h1>
        <p className="text-zinc-400 mt-1">راجع إثبات التحويل ثم فعّل اشتراك الطالب بنقرة واحدة.</p>
      </div>

      <div className="flex gap-1 bg-surface2 rounded-xl p-1 w-fit">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === key ? 'bg-accent on-accent' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Alert type="error">{error}</Alert>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState icon={CreditCard} title="لا توجد طلبات في هذا التصنيف" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {requests.map((r) => {
            const student = students[r.uid];
            return (
              <div key={r.id} className="card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{student?.fullName || '...'}</p>
                    <p className="text-sm text-zinc-500 truncate" dir="ltr">
                      {student?.phone || ''} · {student?.email || ''}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="bg-surface2 rounded-xl px-4 py-3 text-sm space-y-1">
                  <p>
                    <span className="text-zinc-500">{r.bundleId ? 'الباقة: ' : 'المادة: '}</span>
                    <span className="font-bold text-accent">{r.subject}</span>
                    {r.bundleId && (
                      <span className="text-xs text-zinc-500"> (القبول يفعّل كل مواد الباقة)</span>
                    )}
                  </p>
                  <p>
                    <span className="text-zinc-500">المبلغ: </span>
                    <span className="font-bold">{r.amount ?? '—'} د.أ</span>
                  </p>
                  <p className="text-zinc-500 text-xs">{formatDate(r.submittedAt)}</p>
                </div>

                {r.proofImageUrl && (
                  <button onClick={() => setZoom(r.proofImageUrl)} className="block w-full">
                    <img
                      src={r.proofImageUrl}
                      alt="إثبات الدفع"
                      className="w-full h-44 object-cover rounded-xl border border-zinc-700 hover:border-accent transition"
                    />
                  </button>
                )}

                {r.status === 'rejected' && r.rejectionReason && (
                  <p className="text-sm text-red-300">سبب الرفض: {r.rejectionReason}</p>
                )}

                {r.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => approve(r.id)}
                      disabled={busyId === r.id}
                      className="btn-primary flex-1"
                    >
                      {busyId === r.id ? (
                        <Spinner className="w-5 h-5 on-accent" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      قبول وتفعيل
                    </button>
                    <button
                      onClick={() => setRejecting(r.id)}
                      disabled={busyId === r.id}
                      className="btn-danger"
                    >
                      <X className="w-5 h-5" />
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* تكبير صورة الإثبات */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4"
          onClick={() => setZoom('')}
        >
          <div className="max-w-3xl w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={zoom} alt="إثبات الدفع" className="w-full rounded-xl object-contain max-h-[75vh]" />
            <div className="flex gap-3 justify-center">
              <a href={zoom} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <ExternalLink className="w-4 h-4" />
                فتح بحجم كامل
              </a>
              <button onClick={() => setZoom('')} className="btn-primary btn-sm">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الرفض */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">رفض الطلب</h3>
            <div>
              <label className="label" htmlFor="reason">
                سبب الرفض (يظهر للطالب)
              </label>
              <textarea
                id="reason"
                rows={3}
                className="field resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: صورة الإثبات غير واضحة، يرجى رفع صورة أوضح."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejecting(null);
                  setReason('');
                }}
                className="btn btn-ghost flex-1"
              >
                إلغاء
              </button>
              <button onClick={reject} disabled={!!busyId} className="btn-danger flex-1">
                {busyId ? <Spinner className="w-5 h-5" /> : <X className="w-5 h-5" />}
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
