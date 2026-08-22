/**
 * اختبار محلّل ملفات Word — يبني ملف .docx اصطناعياً مطابقاً للنمط الموثّق في
 * القسم 5.3 من الـ PRD (بما فيه حالات الخطأ)، ثم يتحقق من نتيجة الاستخراج.
 *
 * التشغيل:  node tests/extract.test.js
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { extractQuestions } = require('../lib/extractQuestions');

const RED = 'C00000';
let failures = 0;
const pass = (m) => console.log('  ✅ ' + m);
const fail = (m) => { console.log('  ❌ ' + m); failures += 1; };
const check = (cond, ok, bad) => (cond ? pass(ok) : fail(bad));

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** run عادي أو ملوّن. */
const run = (text, color) =>
  `<w:r>${color ? `<w:rPr><w:color w:val="${color}"/><w:b/></w:rPr>` : ''}` +
  `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

/** فقرة من عدة runs (لمحاكاة تقطيع Word للنص). */
const para = (runs) => `<w:p>${runs.join('')}</w:p>`;
const p = (text, color) => para([run(text, color)]);

/** خيار: الحرف والقوس بلا لون، ونص الخيار ملوّن إن كان صحيحاً. */
const option = (letter, text, isCorrect) =>
  para([run(`${letter}) `, isCorrect ? RED : null), run(text, isCorrect ? RED : null)]);

const cell = (text) => `<w:tc><w:p>${run(text)}</w:p></w:tc>`;
const tableRow = (cells) => `<w:tr>${cells.map(cell).join('')}</w:tr>`;

async function buildDocx(bodyXml) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  const body = [
    // ---- الرأس ----
    p('بنك الأسئلة الوزاري'),
    p('مبحث التربية الإسلامية — الصف الحادي عشر - الفصل الأول – جيل 2010'),
    p('الدرس (3): سورة آل عمران، الآيات الكريمة (١٠٢-١٠٥)'),
    p('تعليمات: اختر الإجابة الصحيحة فيما يأتي.'),

    // ---- سؤال 1: سليم، الإجابة الصحيحة «ب» ----
    p('1- حرص سيّدنا رسول الله ﷺ بعد هجرته على:'),
    option('أ', 'إقامة مجتمع تجاري', false),
    option('ب', 'إقامة مجتمع قويّ متماسك', true),
    option('ج', 'إقامة حلف عسكري', false),
    option('د', 'إقامة نظام قضائي', false),

    // ---- سؤال 2: نصه مقطّع على عدة runs (سلوك Word الطبيعي) ----
    para([run('2- '), run('آخى الرسول ﷺ '), run('بعد الهجرة بين:')]),
    option('أ', 'الأوس والخزرج', false),
    option('ب', 'المهاجرين والنصارى', false),
    option('ج', 'المهاجرين والأنصار', true),
    option('د', 'قريش والأنصار', false),

    // ---- سؤال 3: رقمه بأرقام عربية-هندية ----
    p('٣- أنشأ الرسول ﷺ سوقاً جديداً بعيداً عن:'),
    option('أ', 'الغِشّ والاحتكار والرِّبا', true),
    option('ب', 'الغِشّ والسرقة', false),
    option('ج', 'الاحتكار والرشوة', false),
    option('د', 'الرِّبا والغيبة', false),

    // ---- سؤال 4: 3 خيارات فقط → تحذير ----
    p('4- سؤال ناقص الخيارات:'),
    option('أ', 'خيار أول', false),
    option('ب', 'خيار ثانٍ', true),
    option('ج', 'خيار ثالث', false),

    // ---- سؤال 5: إجابتان ملوّنتان → تحذير ----
    p('5- سؤال بإجابتين ملوّنتين:'),
    option('أ', 'خيار أول', true),
    option('ب', 'خيار ثانٍ', true),
    option('ج', 'خيار ثالث', false),
    option('د', 'خيار رابع', false),

    // ---- سؤال 6: بلا أي تلوين → تحذير ----
    p('6- سؤال بلا إجابة ملوّنة:'),
    option('أ', 'خيار أول', false),
    option('ب', 'خيار ثانٍ', false),
    option('ج', 'خيار ثالث', false),
    option('د', 'خيار رابع', false),

    // ---- سؤال 7: يتعارض مع جدول الإجابات → تحذير ----
    p('7- سؤال يتعارض مع جدول التحقق:'),
    option('أ', 'خيار أول', true),
    option('ب', 'خيار ثانٍ', false),
    option('ج', 'خيار ثالث', false),
    option('د', 'خيار رابع', false),

    // ---- جدول الإجابات الصحيحة ----
    `<w:tbl>${tableRow(['1', 'ب', '2', 'ج'])}${tableRow(['3', 'أ', '7', 'د'])}</w:tbl>`,
  ].join('');

  const buffer = await buildDocx(body);
  fs.writeFileSync(path.join(__dirname, 'sample.docx'), buffer);

  const { questions, warnings, header } = await extractQuestions(buffer, {
    subjectId: 'islamic-11-s1',
    fileName: 'sample.docx',
  });

  console.log('\n[1] قراءة رأس الملف');
  check(header.subject.includes('التربية الإسلامية'), `المادة: ${header.subject}`, `المادة خاطئة: ${header.subject}`);
  check(header.grade.includes('الحادي عشر'), `الصف: ${header.grade}`, `الصف خاطئ: ${header.grade}`);
  check(header.semester === 'الفصل الأول', `الفصل: ${header.semester}`, `الفصل خاطئ: ${header.semester}`);
  check(header.cohortYear === 2010, `الجيل: ${header.cohortYear}`, `الجيل خاطئ: ${header.cohortYear}`);

  console.log('\n[2] استخراج الدرس من رأس الملف');
  const q1 = questions.find((q) => q.questionNumber === 1);
  check(q1?.lessonNumber === 3, 'رقم الدرس = 3 (من سطر «الدرس (3)»)', `رقم الدرس خاطئ: ${q1?.lessonNumber}`);
  check(
    (q1?.lesson || '').includes('آل عمران'),
    `عنوان الدرس: ${q1?.lesson}`,
    `عنوان الدرس خاطئ: ${q1?.lesson}`
  );

  console.log('\n[3] الأسئلة السليمة فقط تُستخرج');
  check(questions.length === 3, `3 أسئلة سليمة من أصل 7 (كما هو متوقع)`, `عدد خاطئ: ${questions.length}`);

  console.log('\n[4] كشف الإجابة الصحيحة من اللون');
  check(q1?.correctAnswerIndex === 1, 'السؤال 1 → «ب» (الفهرس 1)', `خاطئ: ${q1?.correctAnswerIndex}`);
  const q2 = questions.find((q) => q.questionNumber === 2);
  check(q2?.correctAnswerIndex === 2, 'السؤال 2 → «ج» (الفهرس 2)', `خاطئ: ${q2?.correctAnswerIndex}`);

  console.log('\n[5] تجميع النص المقطّع على عدة runs');
  check(
    q2?.questionText === 'آخى الرسول ﷺ بعد الهجرة بين:',
    `نص مجمّع صحيح: «${q2?.questionText}»`,
    `نص خاطئ: «${q2?.questionText}»`
  );

  console.log('\n[6] دعم الأرقام العربية-الهندية');
  const q3 = questions.find((q) => q.questionNumber === 3);
  check(!!q3, 'السؤال «٣-» استُخرج برقم 3', 'فشل استخراج السؤال ذي الرقم العربي-الهندي');
  check(q3?.correctAnswerIndex === 0, 'السؤال 3 → «أ» (الفهرس 0)', `خاطئ: ${q3?.correctAnswerIndex}`);

  console.log('\n[7] التحذيرات ورفض الأسئلة المشبوهة');
  const has = (n, word) => warnings.some((w) => w.includes(`السؤال ${n}`) && w.includes(word));
  check(has(4, 'عدد الخيارات'), 'السؤال 4 (3 خيارات) → تحذير وتخطٍّ', 'لم يُرصد نقص الخيارات');
  check(has(5, 'الإجابات الملوّنة'), 'السؤال 5 (إجابتان) → تحذير وتخطٍّ', 'لم تُرصد الإجابات المزدوجة');
  check(has(6, 'الإجابات الملوّنة'), 'السؤال 6 (بلا لون) → تحذير وتخطٍّ', 'لم يُرصد غياب اللون');
  check(has(7, 'تعارض'), 'السؤال 7 → تعارض مع جدول الإجابات', 'لم يُرصد التعارض مع الجدول');
  check(warnings.length === 4, `عدد التحذيرات = 4`, `عدد التحذيرات غير متوقع: ${warnings.length}`);

  console.log('\n[8] تطابق بصمة المعرّف مع أدوات الاستيراد الأخرى');
  const crypto = require('crypto');
  const norm = (t) => String(t || '').replace(/[ً-ْٰـ]/g, '').replace(/\s+/g, ' ').trim();
  const expectedId = crypto
    .createHash('sha1')
    .update(
      ['islamic-11-s1', 3, norm(q1.questionText), q1.optionsText.map(norm).join('~')].join('|'),
      'utf8'
    )
    .digest('hex')
    .slice(0, 24);
  check(q1.docId === expectedId, `المعرّف مطابق: ${q1.docId}`, `المعرّف مختلف: ${q1.docId} ≠ ${expectedId}`);

  // ==========================================================================
  //  اختبار انحدار: الحالتان اللتان كسرتا أول ملف حقيقي
  //  (1) اللون FF0000 بدل C00000   (2) «الدرس: العنوان» بلا رقم
  // ==========================================================================
  console.log('\n[9] ملف واقعي: لون FF0000 وسطر درس بلا رقم');
  const realistic = [
    p('بنك أسئلة وزاري'),
    p('مبحث التربية الإسلامية – الصف الحادي عشر – الفصل الأول – جيل 2010'),
    p('الدرس: التعاون والتكافل في الإسلام'),
    p('اختر رمز الإجابة الصحيحة لكل فقرة مما يأتي:'),
    p('1. يُقصد بالتعاون في الإسلام أن يقوم أفراد المجتمع بـ:'),
    // بصيغة النقطة «أ.» لا القوس، واللون الأحمر النقي
    para([run('أ. تحقيق مصالحهم الشخصية فقط')]),
    para([run('ب. مساعدة بعضهم بعضًا في الخير', 'FF0000')]),
    para([run('ج. الاعتماد على الأغنياء')]),
    para([run('د. ترك المسؤوليات للحاكم')]),
  ].join('');

  const realBuffer = await buildDocx(realistic);
  const real = await extractQuestions(realBuffer, { subjectId: 's1', fileName: 'real.docx' });

  check(real.questions.length === 1, 'استُخرج السؤال رغم اللون FF0000', 'فشل كشف اللون FF0000');
  check(
    real.questions[0]?.correctAnswerIndex === 1,
    'الإجابة الصحيحة «ب» (الفهرس 1)',
    `فهرس خاطئ: ${real.questions[0]?.correctAnswerIndex}`
  );
  check(
    real.lessonTitle === 'التعاون والتكافل في الإسلام',
    `عنوان الدرس التُقط بلا رقم: «${real.lessonTitle}»`,
    `عنوان خاطئ: «${real.lessonTitle}»`
  );
  check(
    real.questions[0]?.lessonNumber === null,
    'رقم الدرس يبقى null ليحسمه المشغّل من دروس المادة',
    `رقم غير متوقع: ${real.questions[0]?.lessonNumber}`
  );
  check(real.warnings.length === 0, 'بلا تحذيرات', `تحذيرات غير متوقعة: ${real.warnings.length}`);

  console.log('\n[10] الألوان غير الحمراء لا تُعتبر إجابة صحيحة');
  const blue = [
    p('الدرس (1): اختبار الألوان'),
    p('1. سؤال بخيار أزرق:'),
    para([run('أ. خيار أزرق', '0070C0')]),
    para([run('ب. خيار عادي')]),
    para([run('ج. خيار عادي')]),
    para([run('د. خيار عادي')]),
  ].join('');
  const blueResult = await extractQuestions(await buildDocx(blue), { subjectId: 's1' });
  check(
    blueResult.questions.length === 0 && blueResult.warnings.length === 1,
    'الأزرق مُتجاهَل → تحذير «0 إجابات ملوّنة» بدل قبول خاطئ',
    `سلوك غير متوقع: ${blueResult.questions.length} سؤال، ${blueResult.warnings.length} تحذير`
  );

  console.log('\n' + '='.repeat(56));
  if (failures === 0) console.log('✅ كل الفحوص نجحت.');
  else {
    console.log(`❌ فشل ${failures} فحصاً.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('فشل الاختبار:', e);
  process.exitCode = 1;
});
