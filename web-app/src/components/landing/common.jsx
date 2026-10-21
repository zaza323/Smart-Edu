import { useEffect, useState } from 'react';

/** عنوان قسم موحّد: سطر تمهيدي صغير + عنوان كبير + وصف اختياري. */
export function SectionHeading({ eyebrow, title, text, className = '' }) {
  return (
    <div className={`text-center max-w-3xl mx-auto ${className}`}>
      {eyebrow && <span className="lp-eyebrow">{eyebrow}</span>}
      <h2 className="text-3xl sm:text-5xl font-black leading-tight">{title}</h2>
      {text && <p className="mt-4 text-[1rem] sm:text-lg text-lp-muted leading-relaxed">{text}</p>}
    </div>
  );
}

/**
 * صيغة العدد بالعربية حسب قواعد التمييز:
 * 1 → مفرد، 2 → مثنى، 3–10 → جمع، 11 فأكثر → مفرد منصوب.
 */
export function arCount(n, { one, two, few, many }) {
  if (n === 1) return one;
  if (n === 2) return two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** هل فعّل الطالب «تقليل الحركة» في جهازه؟ تتوقّف الحركات التلقائية عندها. */
export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** يصبح true أول مرة يظهر فيها العنصر على الشاشة (ولا يعود false). */
export function useInView(ref, { threshold = 0.3 } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, inView]);

  return inView;
}
