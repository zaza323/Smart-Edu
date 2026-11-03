/**
 * تجميع دروس المادة في وحدات لاختيار نطاق الاختبار.
 *
 * مصدران، بهذا الترتيب:
 *  1) `subject.units` — تقسيم صريح يكتبه الأدمن: [{ number, title, lessons: [1,2,3] }]
 *  2) استنتاج من عناوين الدروس حين تذكر الوحدة («الوحدة الأولى: آل عمران»)
 *
 * إن لم ينجح أيّ منهما تُعاد مصفوفة فارغة، فتعرض الواجهة اختيار الدروس مباشرة
 * بدل خطوة الوحدات — لا تُخفى أي مادة ولا يُفقد أي درس.
 */

const ORDINAL_WORDS = [
  'الأولى',
  'الثانية',
  'الثالثة',
  'الرابعة',
  'الخامسة',
  'السادسة',
  'السابعة',
  'الثامنة',
  'التاسعة',
  'العاشرة',
];

const toLatinDigits = (value) =>
  String(value || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

/** رقم الوحدة من عنوان درس، أو null إن لم يذكره العنوان. */
function parseUnitNumber(title) {
  const match = toLatinDigits(title).match(/الوحدة\s+([^\s:،.\-—]+)/);
  if (!match) return null;
  const token = match[1].trim();
  const digits = Number(token);
  if (Number.isFinite(digits) && digits > 0) return digits;
  const index = ORDINAL_WORDS.indexOf(token);
  return index === -1 ? null : index + 1;
}

const sortedLessons = (subject) =>
  (subject?.lessons || []).slice().sort((a, b) => Number(a.number) - Number(b.number));

// مطابق لـ FREE_PREVIEW_MAX_QUESTIONS في Cloud Functions — الخادم يقصّ العدد على كل حال
export const FREE_PREVIEW_COUNT = 10;

/** أول درس في المادة — هو وحده المتاح في المعاينة المجانية. */
export function firstLesson(subject) {
  return sortedLessons(subject)[0] || null;
}

/** عدد أسئلة وحدة = مجموع أسئلة دروسها. */
export const unitQuestionCount = (unit) =>
  (unit?.lessons || []).reduce((sum, l) => sum + (Number(l.count) || 0), 0);

/** وحدات المادة جاهزة للعرض: [{ id, title, lessons: [...] }] — فارغة إن تعذّر التقسيم. */
export function subjectUnits(subject) {
  const lessons = sortedLessons(subject);
  if (lessons.length === 0) return [];

  if (Array.isArray(subject?.units) && subject.units.length > 0) {
    return subject.units
      .map((unit, i) => {
        const number = Number(unit.number) || i + 1;
        const wanted = (unit.lessons || []).map(Number).filter(Number.isFinite);
        return {
          id: String(number),
          title: unit.title || `الوحدة ${number}`,
          lessons: lessons.filter((l) => wanted.includes(Number(l.number))),
        };
      })
      .filter((unit) => unit.lessons.length > 0);
  }

  // الاستنتاج يُقبل فقط إذا ذكرت كل الدروس وحدتها — وإلا لضاعت دروس من الاختيار
  const groups = new Map();
  for (const lesson of lessons) {
    const number = parseUnitNumber(lesson.title);
    if (!number) return [];
    if (!groups.has(number)) groups.set(number, []);
    groups.get(number).push(lesson);
  }
  if (groups.size < 2) return [];

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, items]) => ({ id: String(number), title: `الوحدة ${number}`, lessons: items }));
}
