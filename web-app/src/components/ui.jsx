import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, XCircle } from 'lucide-react';

export function Spinner({ className = 'w-6 h-6' }) {
  return <Loader2 className={`${className} animate-spin text-accent`} />;
}

export function FullPageLoader({ text = 'جارٍ التحميل...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base">
      <Spinner className="w-10 h-10" />
      <p className="text-zinc-400">{text}</p>
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  if (!children) return null;
  const styles = {
    info: 'bg-brand/12 border-brand/40 text-brandInk',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
    error: 'bg-red-500/10 border-red-500/30 text-red-200',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  };
  const icons = {
    info: <Info className="w-5 h-5 shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    error: <XCircle className="w-5 h-5 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 shrink-0" />,
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles[type]}`}
    >
      {icons[type]}
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** شارة حالة الاشتراك أو طلب الدفع */
export function StatusBadge({ status }) {
  const map = {
    active: { text: 'مفعّل', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
    approved: { text: 'مقبول', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
    pending: { text: 'قيد المراجعة', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
    rejected: { text: 'مرفوض', cls: 'bg-red-500/15 text-red-300 border border-red-500/30' },
    expired: { text: 'منتهٍ', cls: 'bg-zinc-500/15 text-zinc-300 border border-zinc-600/40' },
    none: { text: 'غير مشترك', cls: 'bg-zinc-500/15 text-zinc-400 border border-zinc-700' },
    in_progress: { text: 'جارٍ', cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/30' },
    submitted: { text: 'مُسلَّم', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
    abandoned: { text: 'غير مكتمل', cls: 'bg-zinc-500/15 text-zinc-400 border border-zinc-700' },
  };
  const item = map[status] || map.none;
  return <span className={`badge ${item.cls}`}>{item.text}</span>;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'accent' }) {
  const tones = {
    accent: 'text-accent bg-accent/10',
    emerald: 'text-emerald-300 bg-emerald-500/10',
    amber: 'text-amber-300 bg-amber-500/10',
    sky: 'text-brandInk bg-brand/15',
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl grid place-items-center ${tones[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-zinc-400 text-sm">{label}</p>
        <p className="text-2xl font-extrabold text-zinc-50 truncate">{value}</p>
        {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 grid place-items-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-zinc-500" />
      </div>
      <h3 className="text-lg font-bold text-zinc-200">{title}</h3>
      {description && <p className="text-zinc-500 mt-2 text-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** تحويل ثوانٍ إلى صيغة mm:ss أو hh:mm:ss */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** تنسيق Timestamp من Firestore بالعربية */
export function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('ar-JO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(date);
}

export { Clock };
