import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Lock, Package, X } from 'lucide-react';
import { Spinner } from '../ui';
import { bundleFullPrice, bundleSubjects } from '../../lib/bundles';
import { SectionHeading, arCount, usePrefersReducedMotion } from './common';

/** المواد والأسعار — تُقرأ مباشرة من Firestore، فأي مادة تُضاف من لوحة الإدارة تظهر هنا تلقائياً. */
export default function SubjectsSection({ subjects, bundles = [], loading, user }) {
  // ما يُعرض في نافذة الاشتراك: { kind, name, details, price, fullPrice?, path }
  const [sheetItem, setSheetItem] = useState(null);

  const bundleCards = bundles
    .map((b) => ({ ...b, items: bundleSubjects(b, subjects), fullPrice: bundleFullPrice(b, subjects) }))
    .filter((b) => b.items.length > 1);

  const openSubject = (s) =>
    setSheetItem({
      kind: 'subject',
      name: s.name,
      details: [s.grade, s.semester].filter(Boolean).join(' — '),
      price: s.price,
      path: `/app/subscribe/${s.id}`,
    });
  const openBundle = (b) =>
    setSheetItem({
      kind: 'bundle',
      name: b.name,
      details: b.items.map((s) => s.name).join(' + '),
      price: b.price,
      fullPrice: b.fullPrice,
      path: `/app/subscribe/bundle/${b.id}`,
    });

  return (
    <section id="subjects" className="scroll-mt-20 py-24 sm:py-36 relative bg-lp-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="المواد المتاحة الآن"
          title="اختر مادتك وابدأ التدريب"
          text="اشترك في المادة التي تحتاجها، وتدرّب على كل دروسها بأسئلة مصنّفة ومؤقّت يحاكي الامتحان."
          className="mb-16"
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-8 h-8" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-center text-lp-muted">سيتم إضافة المواد قريباً — تابعنا لمعرفة موعد الإطلاق.</p>
        ) : (
          <>
            {bundleCards.map((b) => (
              <BundleCard key={b.id} bundle={b} onSubscribe={() => openBundle(b)} />
            ))}
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 mx-auto ${
                subjects.length >= 3 ? 'lg:grid-cols-3 max-w-7xl' : 'max-w-4xl'
              }`}
            >
              {subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} onSubscribe={() => openSubject(subject)} />
              ))}
            </div>
          </>
        )}

        <p className="mt-12 flex items-center justify-center gap-2 text-center text-xs sm:text-sm text-lp-muted">
          <Lock className="w-4 h-4 shrink-0" />
          يُفعَّل الاشتراك يدوياً بعد أن تراجع الإدارة إثبات التحويل.
        </p>
      </div>

      {sheetItem && <PurchaseSheet item={sheetItem} user={user} onClose={() => setSheetItem(null)} />}
    </section>
  );
}

function SubjectCard({ subject, onSubscribe }) {
  const ref = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const questionCount = Number(subject.questionCount) || 0;
  const lessonCount = subject.lessons?.length || 0;

  // ميلان ثلاثي الأبعاد خفيف مع المؤشّر — على أجهزة الفأرة فقط
  const onMove = (e) => {
    if (reducedMotion || !window.matchMedia('(pointer: fine)').matches) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  const bullets = [
    questionCount > 0 &&
      `${arCount(questionCount, { one: 'سؤال واحد', two: 'سؤالان', few: 'أسئلة', many: 'سؤالاً' })}${
        lessonCount > 0
          ? ` موزّعة على ${arCount(lessonCount, { one: 'درس واحد', two: 'درسين', few: 'دروس', many: 'درساً' })}`
          : ''
      }`,
    'اختبارات بمؤقّت تحاكي امتحان الوزارة',
    'نتيجة فورية ومراجعة تفصيلية لكل سؤال',
  ].filter(Boolean);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="lp-tilt group relative flex flex-col justify-between rounded-3xl p-8 bg-lp-card border border-lp-line hover:border-lp-glow/60 shadow-lg shadow-lp-shadow/5"
    >
      <div>
        <div className="w-12 h-12 mb-6 rounded-2xl grid place-items-center bg-lp-glow/15 border border-lp-glow/30 text-lp-primaryInk">
          <BookOpen className="w-6 h-6" />
        </div>

        {(subject.grade || subject.semester) && (
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs font-bold text-lp-muted">
            {subject.grade && <span>{subject.grade}</span>}
            {subject.grade && subject.semester && <span>•</span>}
            {subject.semester && <span className="text-lp-primaryInk">{subject.semester}</span>}
          </div>
        )}

        <h3 className="text-2xl sm:text-3xl font-extrabold group-hover:text-lp-primaryInk transition-colors">
          {subject.name}
        </h3>

        {subject.description && (
          <p className="mt-4 text-sm sm:text-[1rem] text-lp-muted leading-relaxed">{subject.description}</p>
        )}

        <ul className="mt-6 space-y-2.5 text-xs sm:text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-lp-primaryInk" strokeWidth={3} />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-6 border-t border-lp-line flex items-center justify-between gap-4">
        <div>
          <span className="block text-xs text-lp-muted">رسوم الاشتراك</span>
          <span className="flex items-baseline gap-1">
            <span className="text-4xl font-black tabular-nums">{subject.price ?? '—'}</span>
            <span className="text-[1rem] font-bold text-lp-primaryInk">دينار</span>
          </span>
        </div>
        <button type="button" onClick={onSubscribe} className="lp-btn-primary px-6 py-3 min-h-[48px] text-sm">
          اشترك الآن
        </button>
      </div>
    </div>
  );
}

/** بطاقة الباقة: عريضة فوق بطاقات المواد، بسعرها والسعر المشطوب ومقدار التوفير. */
function BundleCard({ bundle, onSubscribe }) {
  const saving = bundle.fullPrice - Number(bundle.price);
  return (
    <div className="relative max-w-4xl mx-auto mb-10 rounded-3xl p-[1.5px] bg-gradient-to-l from-lp-glow via-lp-soft/70 to-lp-glow/40 shadow-xl shadow-lp-glow/15">
      <div className="rounded-[calc(1.5rem-1.5px)] bg-lp-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6">
        {saving > 0 && (
          <span className="absolute -top-3 right-8 px-3 py-1 rounded-full bg-lp-primary text-lp-onPrimary text-xs font-extrabold shadow-md">
            وفّر {arCount(saving, { one: 'ديناراً واحداً', two: 'دينارين', few: 'دنانير', many: 'ديناراً' })}
          </span>
        )}
        <div className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center bg-lp-glow/15 border border-lp-glow/30 text-lp-primaryInk">
          <Package className="w-7 h-7" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="lp-eyebrow !mb-1">باقة</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold">{bundle.name}</h3>
          {bundle.description && (
            <p className="mt-2 text-sm text-lp-muted leading-relaxed">{bundle.description}</p>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {bundle.items.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-lp-primaryInk" strokeWidth={3} />
                {s.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex md:flex-col items-center md:items-end justify-between gap-4 shrink-0">
          <div className="md:text-left">
            <span className="flex items-baseline gap-1">
              <span className="text-4xl font-black tabular-nums">{bundle.price}</span>
              <span className="text-[1rem] font-bold text-lp-primaryInk">دينار</span>
            </span>
            {saving > 0 && (
              <span className="block text-xs text-lp-muted">
                بدل <s className="tabular-nums">{bundle.fullPrice}</s> دينار
              </span>
            )}
          </div>
          <button type="button" onClick={onSubscribe} className="lp-btn-primary px-6 py-3 min-h-[48px] text-sm">
            اشترك بالباقة
          </button>
        </div>
      </div>
    </div>
  );
}

const SHEET_STEPS = [
  'أنشئ حسابك المجاني أو سجّل دخولك.',
  'حوّل المبلغ الموضّح أعلاه إلى بيانات التحويل الظاهرة في صفحة الاشتراك.',
  'ارفع صورة إثبات التحويل من داخل حسابك.',
];

/** نافذة تأكيد الاشتراك: ملخّص المادة والسعر والخطوات، ثم انتقال لصفحة الدفع أو التسجيل. */
function PurchaseSheet({ item, user, onClose }) {
  const closeRef = useRef(null);
  const subscribePath = item.path;
  const isBundle = item.kind === 'bundle';

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-sheet-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-lp-card border border-lp-line p-6 sm:p-8 text-right shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-lp-line">
          <h3 id="lp-sheet-title" className="flex items-center gap-2 text-lg font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-lp-glow" />
            تفاصيل الاشتراك
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="lp-focus w-8 h-8 rounded-full grid place-items-center bg-lp-raised hover:bg-lp-line"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-lp-raised/60 border border-lp-line flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="block text-xs text-lp-muted">{isBundle ? 'الباقة المختارة' : 'المادة المختارة'}</span>
            <h4 className="mt-0.5 font-extrabold">{item.name}</h4>
            {item.details && <span className="block text-xs text-lp-muted mt-0.5">{item.details}</span>}
          </div>
          <div className="shrink-0 text-left">
            <span className="block text-xs text-lp-muted">المبلغ</span>
            <span className="text-2xl font-black text-lp-primaryInk tabular-nums">{item.price ?? '—'}</span>{' '}
            <span className="text-xs text-lp-primaryInk">دينار</span>
            {isBundle && item.fullPrice > Number(item.price) && (
              <span className="block text-[11px] text-lp-muted">
                بدل <s>{item.fullPrice}</s>
              </span>
            )}
          </div>
        </div>

        <ol className="mb-6 space-y-3 text-xs sm:text-sm text-lp-muted">
          {SHEET_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="lp-pill !w-5 !h-5 !p-0 justify-center shrink-0">{i + 1}</span>
              {step}
            </li>
          ))}
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 shrink-0 rounded-full grid place-items-center bg-emerald-500/20 text-emerald-300">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {isBundle
              ? 'بعد موافقة الإدارة تُفتح لك كل مواد الباقة معاً.'
              : 'بعد موافقة الإدارة تُفتح لك أسئلة المادة كاملة.'}
          </li>
        </ol>

        {user ? (
          <Link to={subscribePath} className="lp-btn-primary w-full py-4 min-h-[50px] text-[1rem]">
            المتابعة إلى صفحة الاشتراك
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <>
            <Link to="/register" className="lp-btn-primary w-full py-4 min-h-[50px] text-[1rem]">
              أنشئ حسابك للمتابعة
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <p className="mt-3 text-center text-xs text-lp-muted">
              لديك حساب؟{' '}
              <Link
                to="/login"
                state={{ from: subscribePath }}
                className="font-bold text-lp-primaryInk underline underline-offset-4"
              >
                سجّل دخولك
              </Link>{' '}
              وستنتقل مباشرة إلى صفحة الاشتراك.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
