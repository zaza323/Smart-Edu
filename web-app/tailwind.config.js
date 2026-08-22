/** @type {import('tailwindcss').Config} */
import palette from 'tailwindcss/colors';

/**
 * كل لون يشير إلى متغيّر CSS يحمل قنوات RGB («24 24 27») لا قيمة hex.
 * صيغة `rgb(var(--x) / <alpha-value>)` تحافظ على معدِّلات الشفافية المستخدمة في
 * كل الكود (`bg-accent/10`، `border-accent/25` ...) — وهو شرط أساسي، إذ لولاها
 * لانكسرت عشرات الأصناف القائمة.
 */
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- توكنات الهوية (تتبدّل بين الوضعين) ----
        base: withVar('--c-base'),
        surface: withVar('--c-surface'),
        surface2: withVar('--c-surface2'),
        surfaceCard: withVar('--c-surface-card'),
        accent: withVar('--c-accent'),
        accentHover: withVar('--c-accent-hover'),
        // أزرق الشعار — اللون الأساسي الثاني في الهوية
        brand: withVar('--c-brand'),
        brandInk: withVar('--c-brand-ink'),
        warn: withVar('--c-warn'),
        critical: withVar('--c-critical'),
        ink: withVar('--c-ink'),
        inkMuted: withVar('--c-ink-muted'),

        /**
         * تدرّج zinc مُعاد توجيهه لمتغيّرات أيضاً.
         * الكود القائم يستخدمه في ~215 موضعاً (نصوص ثانوية، حدود، خلفيات).
         * في الوضع الفاتح تُقلَب قيم السلّم (zinc-800 يصير فاتحاً، zinc-400 يصير
         * رمادياً متوسطاً داكناً) — فتتوافق كل الشاشات القائمة تلقائياً دون
         * تعديل أي مكوّن على حدة.
         */
        /**
         * الدرجات الفاتحة من الألوان الدلالية (200/300/400) مصمَّمة لخلفيات
         * داكنة؛ على خلفية فاتحة تختفي. تُعاد توجيهها لمتغيّرات تُقلَب في الوضع
         * الفاتح، تماماً كما فُعل بسلّم zinc. الدرجات 500+ تُستخدم مع شفافية
         * كخلفيات/حدود فتعمل في الوضعين، لذلك تبقى كما هي.
         */
        sky: { ...palette.sky, 200: withVar('--c-sky-200'), 300: withVar('--c-sky-300') },
        emerald: {
          ...palette.emerald,
          200: withVar('--c-emerald-200'),
          300: withVar('--c-emerald-300'),
        },
        amber: { ...palette.amber, 200: withVar('--c-amber-200'), 300: withVar('--c-amber-300') },
        red: {
          ...palette.red,
          200: withVar('--c-red-200'),
          300: withVar('--c-red-300'),
          400: withVar('--c-red-400'),
        },
        orange: { ...palette.orange, 300: withVar('--c-orange-300') },

        zinc: {
          50: withVar('--c-zinc-50'),
          100: withVar('--c-zinc-100'),
          200: withVar('--c-zinc-200'),
          300: withVar('--c-zinc-300'),
          400: withVar('--c-zinc-400'),
          500: withVar('--c-zinc-500'),
          600: withVar('--c-zinc-600'),
          700: withVar('--c-zinc-700'),
          800: withVar('--c-zinc-800'),
          900: withVar('--c-zinc-900'),
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        // نبض خفيف وبطيء لحلقة المؤقّت بالحالة الحرجة
        ringPulse: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.04)', opacity: '0.88' },
        },
      },
      animation: {
        fadeIn: 'fadeIn .35s ease-out both',
        pulseSoft: 'pulseSoft 1.4s ease-in-out infinite',
        ringPulse: 'ringPulse 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
