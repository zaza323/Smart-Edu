import { useEffect, useRef, useState } from 'react';

const HEIGHT = 240;
const PAD = { top: 18, right: 44, bottom: 30, left: 40 };
const Y_TICKS = [0, 25, 50, 75, 100];

// الألوان أصناف Tailwind لا سمات SVG: سمات العرض (fill="...") لا تحلّ var() في CSS
const CHART = 'rgb(var(--c-chart))'; // لمفتاح التلميح (عنصر HTML)

const fmtDate = (ms) => new Date(ms).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });

/**
 * نتيجة كل اختبار عبر الزمن — سلسلة واحدة (لا مفتاح ألوان؛ العنوان يسمّيها).
 * خط 2px + مساحة شفافة 10%، ونقاط بحلقة بلون السطح. التحويم يلتقط أقرب اختبار
 * بخط عمودي، والأسهم في لوحة المفاتيح تتنقّل بين الاختبارات.
 * محور الزمن من اليسار لليمين حتى داخل الواجهة العربية (dir="ltr").
 */
export default function ScoreChart({ series }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const n = series.length;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (pct) => PAD.top + innerH - (pct / 100) * innerH;

  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pct)}`).join(' ');
  const area = n > 1 ? `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';

  // تسميات المحور السيني: الأول والأخير (والأوسط إن اتّسعت المساحة)
  const xLabels = [...new Set(n > 2 && innerW > 420 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1])];

  const nearest = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    if (n === 1) return 0;
    const i = Math.round(((px - PAD.left) / innerW) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };

  const onKey = (e) => {
    if (e.key === 'ArrowRight') setActive((i) => Math.min(n - 1, (i ?? n - 1) + 1));
    else if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? n - 1) - 1));
    else return;
    e.preventDefault();
  };

  const point = active === null ? null : series[active];
  const last = series[n - 1];

  return (
    <div ref={wrapRef} dir="ltr" className="relative select-none">
      <svg width={width} height={HEIGHT} role="img" aria-label="نتيجة كل اختبار عبر الزمن" className="block">
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} strokeWidth="1" className="stroke-zinc-800" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" className="fill-zinc-500 tabular-nums">
              {t}%
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="11"
            className="fill-zinc-500"
          >
            {fmtDate(series[i].at)}
          </text>
        ))}

        {area && <path d={area} className="fill-chart/10" />}
        {n > 1 && (
          <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-chart" />
        )}

        {point && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} strokeWidth="1" className="stroke-zinc-500" />
        )}

        {series.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.pct)}
            r={i === active ? 6 : 4}
            strokeWidth="2"
            className="fill-chart stroke-surface"
          />
        ))}

        {/* تسمية مباشرة لآخر نتيجة فقط — الباقي في التلميح والجدول */}
        <text x={x(n - 1) + 10} y={y(last.pct)} dy="0.32em" fontSize="12" fontWeight="700" className="fill-zinc-100">
          {last.pct}%
        </text>

        {/* طبقة الالتقاط: الهدف هو اللوحة كلها، لا الخط الرفيع */}
        <rect
          x={PAD.left - 12}
          y={PAD.top}
          width={innerW + 24}
          height={innerH}
          fill="transparent"
          tabIndex={0}
          aria-label="تنقّل بين الاختبارات بالأسهم"
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="outline-none focus-visible:stroke-brand"
        />
      </svg>

      {point && (
        <div
          dir="rtl"
          className="pointer-events-none absolute z-10 rounded-xl border border-zinc-700 bg-surface px-3 py-2 text-xs shadow-xl"
          style={{
            top: Math.max(0, y(point.pct) - 74),
            left: Math.min(Math.max(0, x(active) - 80), width - 170),
            width: 160,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: CHART }} />
            <strong className="text-base text-zinc-50 tabular-nums">{point.pct}%</strong>
            <span className="text-zinc-400 tabular-nums">
              {point.score}/{point.total} صحيحة
            </span>
          </div>
          <div className="mt-1 text-zinc-400 truncate">{point.label}</div>
          <div className="text-zinc-500">{fmtDate(point.at)}</div>
        </div>
      )}
    </div>
  );
}
