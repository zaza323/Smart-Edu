import { useEffect, useRef, useState } from 'react';
import { useInView, usePrefersReducedMotion } from './common';

const COLS = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };

/**
 * شريط أرقام حقيقية محسوبة من مستندات المواد (`questionCount` و`lessons`)
 * — لا أرقام تقديرية. أي رقم يساوي صفراً يُخفى، وإن لم يبقَ شيء يُخفى الشريط كله.
 */
export default function StatsBand({ subjects }) {
  const ref = useRef(null);
  const inView = useInView(ref);

  const totalQuestions = subjects.reduce((sum, s) => sum + (Number(s.questionCount) || 0), 0);
  const totalLessons = subjects.reduce((sum, s) => sum + (s.lessons?.length || 0), 0);

  const stats = [
    { value: totalQuestions, label: 'سؤال في البنك', sub: 'مصنّفة حسب دروس المنهاج', accent: true },
    { value: totalLessons, label: 'درس مغطّى', sub: 'اختبر نفسك في كل درس على حدة' },
    { value: subjects.length, label: 'مادة متاحة الآن', sub: 'لطلاب التوجيهي', accent: true },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  stats.push({ text: '24/7', label: 'متاح على مدار الساعة', sub: 'من الهاتف أو الكمبيوتر', green: true });

  return (
    <section ref={ref} className="py-16 sm:py-20 border-y border-lp-line bg-lp-alt">
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 gap-8 text-center ${COLS[stats.length]}`}>
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-1">
            <div
              dir="ltr"
              className={`text-3xl sm:text-5xl font-black tabular-nums ${
                stat.green ? 'text-emerald-300' : stat.accent ? 'text-lp-primaryInk' : 'text-lp-ink'
              }`}
            >
              {stat.text ?? <CountUp target={stat.value} start={inView} />}
            </div>
            <p className="text-sm font-bold">{stat.label}</p>
            <span className="block text-[11px] text-lp-muted">{stat.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CountUp({ target, start, duration = 1200 }) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return undefined;
    if (reducedMotion) {
      setValue(target);
      return undefined;
    }
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, duration, reducedMotion]);

  return value.toLocaleString('en-US');
}
