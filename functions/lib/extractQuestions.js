/**
 * ============================================================================
 *  استخراج الأسئلة من مستند Word — التنفيذ الوحيد المعتمد.
 *
 *  يتعامل مع ما ظهر فعلياً في ملفات المعلّمين:
 *   - أي درجة حمراء لتمييز الإجابة الصحيحة (C00000 و FF0000 وغيرهما).
 *   - سطر درس مرقّم «الدرس (3): العنوان» أو بلا رقم «الدرس: العنوان».
 *   - الأرقام العربية-الهندية (١٢٣) في ترقيم الأسئلة والدروس.
 *   - نص السؤال المقطّع على عدة runs (سلوك Word الطبيعي).
 * ============================================================================
 */

const crypto = require('crypto');
const { readDocx } = require('./docx');

const LETTERS = ['أ', 'ب', 'ج', 'د'];

/**
 * ألوان تمييز الإجابة الصحيحة.
 * الـ PRD وثّق `C00000` (أحمر داكن) من عيّنة أولى، لكن ملفات حقيقية أخرى تستخدم
 * `FF0000` (أحمر نقي) — وهما مجرد خيارين متجاورين في لوحة ألوان Word. لذلك
 * نقبل أي لون «أحمر الغلبة» بدل قائمة ثابتة تنكسر مع كل ملف من معلّم مختلف.
 */
const EXPLICIT_ANSWER_COLORS = new Set(['C00000', 'FF0000']);

function isCorrectAnswerColor(hex) {
  if (!hex) return false;
  const value = String(hex).toUpperCase();
  if (EXPLICIT_ANSWER_COLORS.has(value)) return true;
  if (!/^[0-9A-F]{6}$/.test(value)) return false;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  // أحمر واضح الغلبة: قناة حمراء قوية وأضعافُ الخضراء والزرقاء
  return r >= 128 && r >= g * 2 && r >= b * 2;
}

const OPTION_PATTERN = /^([أبجد])\s*[)\-.]\s*(.*)$/;
const QUESTION_PATTERN = /^(\d+)\s*[-.]\s*(.*)$/;
// «الدرس (3): العنوان» أو «الدرس 3 - العنوان»
const LESSON_NUMBERED_PATTERN = /^الدرس\s*\(?\s*(\d+)\s*\)?\s*[:：\-–—]?\s*(.*)$/;
// «الدرس: العنوان» بلا رقم — شائع في ملفات المعلّمين
const LESSON_TITLED_PATTERN = /^الدرس\s*[:：\-–—]\s*(.+)$/;
const COHORT_PATTERN = /جيل\s*[:：]?\s*(\d{4})/;
const SUBJECT_PATTERN = /مبحث\s*[:：]?\s*([^—\-–|]+)/;
const GRADE_PATTERN = /الصف\s*[:：]?\s*([^—\-–|]+)/;
const SEMESTER_PATTERN = /(الفصل\s+(?:الأول|الثاني|الصيفي))/;

/** تحويل الأرقام العربية-الهندية والفارسية إلى لاتينية — بطول نص محفوظ (1:1). */
function toAsciiDigits(text) {
  return String(text).replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

function normalize(text) {
  return String(text || '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** نفس بصمة المعرّف في أدوات الاستيراد الأخرى — تشمل الخيارات لا نص السؤال وحده. */
function makeQuestionId(subjectId, lessonNumber, questionText, optionsText) {
  const signature = [
    subjectId,
    lessonNumber,
    normalize(questionText),
    (optionsText || []).map(normalize).join('~'),
  ].join('|');
  return crypto.createHash('sha1').update(signature, 'utf8').digest('hex').slice(0, 24);
}

/**
 * يطابق نمطاً على نسخة بأرقام لاتينية، ويعيد المجموعات مقصوصة من النص الأصلي.
 * التحويل يحافظ على الطول حرفاً بحرف، فمواضع الاقتصاص تبقى صحيحة.
 */
function matchPreservingText(pattern, text) {
  const probe = toAsciiDigits(text);
  const m = probe.match(pattern);
  if (!m) return null;
  const prefixLength = m[0].length - m[m.length - 1].length;
  return { number: m[1], rest: text.slice(prefixLength).trim() };
}

function parseHeader(paragraphs, maxLines = 6) {
  const info = { subject: '', grade: '', semester: '', cohortYear: null };
  for (const p of paragraphs.slice(0, maxLines)) {
    const text = (p.text || '').trim();
    if (!text) continue;
    if (!info.subject) {
      const m = text.match(SUBJECT_PATTERN);
      if (m) info.subject = m[1].trim();
    }
    if (!info.grade) {
      const m = text.match(GRADE_PATTERN);
      if (m) info.grade = m[1].trim();
    }
    if (!info.semester) {
      const m = text.match(SEMESTER_PATTERN);
      if (m) info.semester = m[1].trim();
    }
    if (info.cohortYear === null) {
      const m = toAsciiDigits(text).match(COHORT_PATTERN);
      if (m) info.cohortYear = Number(m[1]);
    }
  }
  return info;
}

/** جدول «الإجابات الصحيحة» الاختياري: { رقم السؤال: رمز الإجابة } */
function parseAnswerKey(tables) {
  const key = {};
  for (const rows of tables) {
    for (const cells of rows) {
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const num = toAsciiDigits(cells[i]).trim();
        const ans = cells[i + 1].trim();
        if (/^\d+$/.test(num) && LETTERS.includes(ans)) key[Number(num)] = ans;
      }
    }
  }
  return key;
}

/**
 * @returns {{questions: object[], warnings: string[]}}
 */
async function extractQuestions(buffer, meta) {
  const { paragraphs, tables } = await readDocx(buffer);
  const header = parseHeader(paragraphs);

  const subjectId = meta.subjectId;
  const subject = meta.subject || header.subject;
  const grade = meta.grade || header.grade;
  const semester = meta.semester || header.semester;
  const cohortYear = meta.cohortYear || header.cohortYear;

  // القيم المُدخلة يدوياً من واجهة الرفع تُستخدم كقيمة ابتدائية، ويُحدّثها رأس
  // الملف إن احتوى سطر «الدرس (رقم): العنوان».
  let lessonNumber = meta.lessonNumber ?? null;
  let lessonTitle = meta.lessonTitle || '';

  const collected = [];
  const warnings = [];
  const fileLabel = meta.fileName || 'الملف';
  let current = null;

  for (const paragraph of paragraphs) {
    const text = (paragraph.text || '').trim();
    if (!text) continue;

    // سطر الدرس يُحدّث السياق ولا يُعامَل كسؤال
    if (text.length < 200 && text.startsWith('الدرس')) {
      const numbered = matchPreservingText(LESSON_NUMBERED_PATTERN, text);
      if (numbered) {
        lessonNumber = Number(numbered.number);
        const title = numbered.rest.replace(/^[\s:：،\-–—]+/, '').trim();
        if (title) lessonTitle = title;
        continue;
      }
      // بلا رقم: نلتقط العنوان فقط، ويُحسم الرقم لاحقاً من دروس المادة الموجودة
      const titled = text.match(LESSON_TITLED_PATTERN);
      if (titled) {
        const title = titled[1].trim();
        if (title) lessonTitle = title;
        continue;
      }
    }

    const optionMatch = text.match(OPTION_PATTERN);
    const questionMatch = optionMatch ? null : matchPreservingText(QUESTION_PATTERN, text);

    if (questionMatch) {
      current = {
        questionNumber: Number(questionMatch.number),
        questionText: questionMatch.rest,
        options: [],
        lessonNumber,
        lesson: lessonTitle,
      };
      collected.push(current);
    } else if (optionMatch && current && current.options.length < 4) {
      const isCorrect = paragraph.runs.some((r) => isCorrectAnswerColor(r.color) && r.text.trim());
      current.options.push({ letter: optionMatch[1], text: optionMatch[2].trim(), isCorrect });
    }
  }

  const answerKey = parseAnswerKey(tables);

  const questions = [];
  for (const q of collected) {
    const correct = q.options.filter((o) => o.isCorrect);

    if (q.options.length !== 4) {
      warnings.push(
        `[${fileLabel}] السؤال ${q.questionNumber}: عدد الخيارات ${q.options.length} (متوقع 4) — تم تخطّيه`
      );
      continue;
    }
    if (correct.length !== 1) {
      warnings.push(
        `[${fileLabel}] السؤال ${q.questionNumber}: عدد الإجابات الملوّنة ${correct.length} (متوقع 1) — تم تخطّيه`
      );
      continue;
    }

    const correctIndex = q.options.indexOf(correct[0]);
    const expected = answerKey[q.questionNumber];
    if (expected && expected !== correct[0].letter) {
      warnings.push(
        `[${fileLabel}] السؤال ${q.questionNumber}: تعارض! اللون يشير لـ «${correct[0].letter}» ` +
          `وجدول الإجابات يقول «${expected}» — تم تخطّيه للمراجعة اليدوية`
      );
      continue;
    }
    // رقم الدرس قد يكون null هنا (ملفات تكتب «الدرس: العنوان» بلا رقم).
    // يحسمه المستدعي عبر resolveLessonNumber ثم يُعاد توليد المعرّف — راجع importTrigger.
    const optionsText = q.options.map((o) => o.text);
    questions.push({
      docId: makeQuestionId(subjectId, q.lessonNumber, q.questionText, optionsText),
      subjectId,
      subject,
      grade,
      semester,
      lesson: q.lesson || '',
      lessonNumber: q.lessonNumber,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      optionsText,
      correctAnswerIndex: correctIndex,
      explanation: '',
      difficulty: 'medium',
      sourceCohortYear: cohortYear ?? null,
      random: Math.random(),
    });
  }

  return { questions, warnings, header, lessonNumber, lessonTitle };
}

module.exports = { extractQuestions, makeQuestionId, normalize, toAsciiDigits };
