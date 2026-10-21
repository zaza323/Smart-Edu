import { Check, Upload } from 'lucide-react';
import { SectionHeading } from './common';

const STEPS = [
  {
    label: 'الخطوة الأولى',
    title: 'أنشئ حسابك المجاني',
    text: 'أدخل اسمك ورقم هاتفك وبريدك الإلكتروني وصفّك الدراسي، لتحصل على لوحتك الخاصة وسجل محاولاتك.',
    note: 'يستغرق أقل من دقيقة.',
    extra: (
      <div className="mt-4 p-3 rounded-xl bg-lp-raised/60 border border-lp-line text-xs text-lp-muted flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        الاسم · الهاتف · البريد · الصف
      </div>
    ),
  },
  {
    label: 'الخطوة الثانية',
    title: 'اختر المادة واطّلع على بيانات التحويل',
    text: 'من داخل حسابك اختر مادتك، فتظهر لك بيانات التحويل (حساب بنكي أو محفظة إلكترونية) والمبلغ المطلوب.',
    note: 'السعر واضح قبل أي دفع.',
  },
  {
    label: 'الخطوة الثالثة',
    title: 'حوّل المبلغ وارفع صورة الإثبات',
    text: 'حوّل المبلغ من تطبيق بنكك أو محفظتك، ثم صوّر إثبات التحويل وارفعه من صفحة المادة داخل حسابك.',
    note: 'يصل طلبك للإدارة للمراجعة.',
    extra: (
      <div className="mt-4 flex items-center gap-2 text-xs text-lp-primaryInk">
        <Upload className="w-4 h-4" />
        رفع الصورة مباشرة من الهاتف
      </div>
    ),
  },
  {
    label: 'الخطوة الرابعة',
    title: 'موافقة الإدارة وتفعيل الاشتراك',
    text: 'بعد مراجعة الإثبات يُفعَّل اشتراكك، وتُفتح لك كل دروس المادة واختباراتها.',
    note: 'وتبدأ التدريب مباشرة.',
    done: true,
  },
];

/** خط زمني عمودي متناوب على الشاشات الكبيرة، ومكدّس على الهاتف. */
export default function StepsSection() {
  return (
    <section id="steps" className="scroll-mt-20 py-24 sm:py-32 border-t border-lp-line bg-lp-alt relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="بسيطة وسريعة"
          title="كيف تحصل على اشتراكك؟"
          text="أربع خطوات سهلة تبدأ من هاتفك وتنتهي بفتح كل أسئلة المادة."
          className="mb-20"
        />

        <div className="relative">
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-12 bottom-12 right-1/2 translate-x-1/2 w-0.5 opacity-40 bg-gradient-to-b from-lp-glow via-lp-soft/60 to-emerald-400"
          />

          <ol className="space-y-12 sm:space-y-16">
            {STEPS.map((step, i) => {
              const cardFirst = i % 2 === 0; // بطاقة يميناً في الخطوات الفردية، يساراً في الزوجية
              return (
                <li key={step.title} className="flex flex-col md:flex-row items-center gap-8">
                  <div className={`w-full md:w-1/2 order-2 ${cardFirst ? 'md:order-1' : 'md:order-3'}`}>
                    <div
                      className={`p-6 rounded-2xl border ${
                        step.done ? 'bg-emerald-500/[0.07] border-emerald-500/30' : 'lp-card'
                      }`}
                    >
                      <span
                        className={`inline-block mb-2 px-3 py-1 rounded-full text-xs font-bold ${
                          step.done
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : i === 0
                              ? 'lp-pill'
                              : 'bg-lp-raised text-lp-ink'
                        }`}
                      >
                        {step.label}
                      </span>
                      <h3 className={`text-xl font-bold ${step.done ? 'text-emerald-300' : ''}`}>{step.title}</h3>
                      <p className="mt-2 text-sm text-lp-muted leading-relaxed">{step.text}</p>
                      {step.extra}
                    </div>
                  </div>

                  <StepBubble index={i} done={step.done} />

                  <div
                    className={`hidden md:block w-1/2 text-sm text-lp-muted ${
                      cardFirst ? 'order-3 pr-6' : 'order-1 text-left pl-6'
                    }`}
                  >
                    {step.note}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepBubble({ index, done }) {
  const base = 'w-14 h-14 shrink-0 z-10 order-1 md:order-2 rounded-full grid place-items-center font-extrabold text-xl';
  if (done) {
    return (
      <span className={`${base} bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 border-4 border-lp-alt`}>
        <Check className="w-6 h-6" strokeWidth={3} />
      </span>
    );
  }
  if (index === 0) {
    return (
      <span className={`${base} bg-lp-primary text-lp-onPrimary shadow-lg shadow-lp-glow/20 border-4 border-lp-alt`}>
        1
      </span>
    );
  }
  return <span className={`${base} bg-lp-raised border-2 border-lp-glow`}>{index + 1}</span>;
}
