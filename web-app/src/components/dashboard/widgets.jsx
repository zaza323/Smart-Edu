/** حلقة تقدّم دائرية (SVG) — النسبة من 0 إلى 100، والمحتوى يتوسّطها. */
export function ProgressRing({ value = 0, className = 'w-14 h-14', stroke = 3, tone = 'stroke-emerald-400', children }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth={stroke} className="stroke-zinc-800" />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
          className={`${tone} transition-[stroke-dasharray] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">{children}</div>
    </div>
  );
}

/** مفتاح تشغيل/إيقاف بدور switch حقيقي (لوحة المفاتيح وقارئ الشاشة). */
export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        checked ? 'bg-brandFill' : 'bg-zinc-700'
      }`}
    >
      {/* في الواجهة العربية «تشغيل» يدفع المقبض نحو اليسار */}
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          checked ? 'right-[1.375rem]' : 'right-0.5'
        }`}
      />
    </button>
  );
}
