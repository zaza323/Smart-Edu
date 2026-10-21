import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SectionHeading } from './common';

const FAQS = [
  {
    q: 'كيف يتم تفعيل الاشتراك بعد الدفع؟',
    a: 'بعد إنشاء حسابك، اختر المادة من داخل حسابك لتظهر لك بيانات التحويل والمبلغ. حوّل المبلغ، ثم ارفع صورة إثبات التحويل من صفحة المادة، وبعد أن تراجعه الإدارة وتوافق عليه يُفعَّل اشتراكك.',
  },
  {
    q: 'كم يستغرق تفعيل الاشتراك؟',
    a: 'تُراجَع إثباتات الدفع يدوياً من الإدارة، ويُفعَّل اشتراكك فور الموافقة. ويمكنك متابعة حالة طلبك من صفحة المادة داخل حسابك.',
  },
  {
    q: 'ما طرق الدفع المتاحة؟',
    a: 'التحويل إلى حساب بنكي أو محفظة إلكترونية. تظهر بيانات التحويل كاملة في صفحة الاشتراك بعد اختيار المادة.',
  },
  {
    q: 'هل أستطيع اختبار نفسي في درس واحد فقط؟',
    a: 'نعم. عند بدء أي اختبار تختار درساً محدّداً أو المادة كاملة، وتحدّد عدد الأسئلة، ويُحسب وقت الاختبار تلقائياً حسب عددها.',
  },
  {
    q: 'هل يعمل بنك الأسئلة على الهاتف؟',
    a: 'نعم، الموقع مصمّم ليعمل على الهاتف والتابلت والكمبيوتر مباشرة من المتصفح، دون الحاجة لتحميل أي تطبيق.',
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="scroll-mt-20 py-24 sm:py-32 bg-lp-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="إجابات واضحة" title="الأسئلة الشائعة" className="mb-16" />

        <div className="space-y-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="lp-card overflow-hidden">
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="lp-focus w-full p-5 sm:p-6 rounded-2xl flex items-center justify-between gap-4 text-right font-bold text-[1rem] sm:text-lg hover:text-lp-primaryInk transition-colors"
                  >
                    {item.q}
                    <Plus
                      className={`w-6 h-6 shrink-0 text-lp-primaryInk transition-transform duration-200 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                    />
                  </button>
                </h3>
                {isOpen && (
                  <div
                    id={`faq-a-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className="px-5 sm:px-6 pb-6 pt-4 border-t border-lp-line text-sm sm:text-[1rem] text-lp-muted leading-relaxed animate-fadeIn"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
