import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { fetchSubjects } from '../../lib/subjects';
import { makeQuestionId } from '../../lib/questionId';
import { syncSubjectCounts } from '../../lib/subjectCounts';
import { Alert, EmptyState, Spinner } from '../../components/ui';

const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];
const PAGE_SIZE = 25;

const blankQuestion = () => ({
  isNew: true,
  questionText: '',
  optionsText: ['', '', '', ''],
  correctAnswerIndex: 0,
  lessonNumber: '',
  explanation: '',
});

export default function QuestionsPage() {
  const { subjectId: routeSubjectId } = useParams();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(routeSubjectId || '');
  const [lessonNumber, setLessonNumber] = useState('all');

  // ترقيم الصفحات: نحتفظ بصفحات محمّلة مسبقاً للرجوع للخلف بلا إعادة قراءة
  const [pages, setPages] = useState([]); // [{docs:[], lastDoc}]
  const [pageIndex, setPageIndex] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const [search, setSearch] = useState('');
  const [allCache, setAllCache] = useState(null); // كل أسئلة المادة (للبحث الشامل)
  const [searching, setSearching] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const searchTimer = useRef(null);

  // ---------------- تحميل المواد ----------------
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSubjects();
        setSubjects(list);
        if (!routeSubjectId && list[0]) setSubjectId(list[0].id);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [routeSubjectId]);

  useEffect(() => {
    if (routeSubjectId) setSubjectId(routeSubjectId);
  }, [routeSubjectId]);

  const currentSubject = subjects.find((s) => s.id === subjectId);
  const lessons = useMemo(
    () => (currentSubject?.lessons || []).slice().sort((a, b) => a.number - b.number),
    [currentSubject]
  );

  // ---------------- بناء الاستعلام ----------------
  const buildQuery = useCallback(
    (cursor) => {
      const parts = [collection(db, 'questions'), where('subjectId', '==', subjectId)];
      if (lessonNumber !== 'all') {
        parts.push(where('lessonNumber', '==', Number(lessonNumber)), orderBy('questionNumber'));
      } else {
        parts.push(orderBy('lessonNumber'), orderBy('questionNumber'));
      }
      if (cursor) parts.push(startAfter(cursor));
      parts.push(limit(PAGE_SIZE));
      return query(...parts);
    },
    [subjectId, lessonNumber]
  );

  const loadFirstPage = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    setError('');
    setPages([]);
    setPageIndex(0);
    setReachedEnd(false);
    try {
      const snap = await getDocs(buildQuery(null));
      setPages([
        {
          docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          lastDoc: snap.docs[snap.docs.length - 1] || null,
        },
      ]);
      if (snap.docs.length < PAGE_SIZE) setReachedEnd(true);
    } catch (err) {
      setError(`${err.message} — قد يلزم إنشاء فهرس مركّب من الرابط في Console.`);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, subjectId]);

  useEffect(() => {
    setAllCache(null);
    setSearch('');
    loadFirstPage();
  }, [loadFirstPage]);

  async function nextPage() {
    if (pageIndex + 1 < pages.length) {
      setPageIndex(pageIndex + 1);
      return;
    }
    const cursor = pages[pageIndex]?.lastDoc;
    if (!cursor || reachedEnd) return;
    setLoading(true);
    try {
      const snap = await getDocs(buildQuery(cursor));
      if (snap.empty) {
        setReachedEnd(true);
      } else {
        setPages((prev) => [
          ...prev,
          {
            docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            lastDoc: snap.docs[snap.docs.length - 1] || null,
          },
        ]);
        setPageIndex((i) => i + 1);
        if (snap.docs.length < PAGE_SIZE) setReachedEnd(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- البحث الشامل ----------------
  // البحث النصي لا يدعمه Firestore أصلاً، فنحمّل أسئلة المادة مرة واحدة ونحتفظ
  // بها في الذاكرة لبقية الجلسة، بدل قراءتها مع كل حرف يُكتب.
  const runSearch = useCallback(
    async (term) => {
      if (!term.trim() || allCache) return;
      setSearching(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'questions'), where('subjectId', '==', subjectId))
        );
        setAllCache(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(err.message);
      } finally {
        setSearching(false);
      }
    },
    [allCache, subjectId]
  );

  function onSearchChange(value) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(value), 400);
  }

  const isSearching = search.trim().length > 0;
  const visible = useMemo(() => {
    if (!isSearching) return pages[pageIndex]?.docs || [];
    const term = search.trim();
    const source = allCache || pages.flatMap((p) => p.docs);
    return source
      .filter(
        (q) =>
          (lessonNumber === 'all' || Number(q.lessonNumber) === Number(lessonNumber)) &&
          (q.questionText?.includes(term) ||
            (q.optionsText || []).some((o) => String(o).includes(term)))
      )
      .slice(0, 100);
  }, [isSearching, pages, pageIndex, search, allCache, lessonNumber]);

  // ---------------- حفظ (تعديل أو إضافة) ----------------
  async function saveQuestion() {
    const q = editing;
    if (!q.questionText.trim()) return setError('نص السؤال مطلوب.');
    if (q.optionsText.some((o) => !String(o).trim())) return setError('كل الخيارات الأربعة مطلوبة.');
    if (q.isNew && q.lessonNumber === '') return setError('اختر الدرس.');

    setBusy(true);
    setError('');
    try {
      const options = q.optionsText.map((o) => String(o).trim());
      if (q.isNew) {
        const lessonNum = Number(q.lessonNumber);
        const lessonTitle =
          lessons.find((l) => Number(l.number) === lessonNum)?.title || q.lessonTitle || '';
        const id = await makeQuestionId(subjectId, lessonNum, q.questionText.trim(), options);

        await setDoc(
          doc(db, 'questions', id),
          {
            subjectId,
            subject: currentSubject?.name || '',
            grade: currentSubject?.grade || '',
            semester: currentSubject?.semester || '',
            lesson: lessonTitle,
            lessonNumber: lessonNum,
            questionNumber: Number(q.questionNumber) || 0,
            questionText: q.questionText.trim(),
            optionsText: options,
            correctAnswerIndex: Number(q.correctAnswerIndex),
            explanation: q.explanation || '',
            difficulty: 'medium',
            sourceCohortYear: null,
            random: Math.random(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        await syncSubjectCounts(subjectId, {
          lessonNumber: lessonNum,
          lessonTitle,
          delta: 1,
        });
      } else {
        await updateDoc(doc(db, 'questions', q.id), {
          questionText: q.questionText.trim(),
          optionsText: options,
          correctAnswerIndex: Number(q.correctAnswerIndex),
          explanation: q.explanation || '',
        });
      }
      setEditing(null);
      const list = await fetchSubjects();
      setSubjects(list);
      await loadFirstPage();
      setAllCache(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion() {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'questions', confirmDelete.id));
      await syncSubjectCounts(subjectId, {
        lessonNumber: confirmDelete.lessonNumber,
        lessonTitle: confirmDelete.lesson,
        delta: -1,
      });
      setConfirmDelete(null);
      setSubjects(await fetchSubjects());
      await loadFirstPage();
      setAllCache(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const totalInSubject = currentSubject?.questionCount ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/subjects"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-accent mb-2"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع للمواد
          </Link>
          <h1 className="text-2xl font-extrabold">إدارة الأسئلة</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {currentSubject ? (
              <>
                <span className="text-accent font-bold">{currentSubject.name}</span> — {totalInSubject}{' '}
                سؤال ضمن {lessons.length} درس
              </>
            ) : (
              'اختر مادة'
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing(blankQuestion())}
          disabled={!subjectId}
          className="btn-primary btn-sm"
        >
          <Plus className="w-4 h-4" />
          إضافة سؤال
        </button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* الفلاتر */}
      <div className="grid sm:grid-cols-3 gap-3">
        <select
          className="field"
          value={subjectId}
          onChange={(e) => navigate(`/admin/questions/${e.target.value}`)}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className="field"
          value={lessonNumber}
          onChange={(e) => setLessonNumber(e.target.value)}
        >
          <option value="all">كل الدروس</option>
          {lessons.map((l) => (
            <option key={l.number} value={l.number}>
              الدرس {l.number}: {l.title} ({l.count})
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="field pr-11"
            placeholder="بحث في نص السؤال أو الخيارات..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searching && (
            <Spinner className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
          )}
        </div>
      </div>

      {/* شريط الحالة */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {isSearching ? (
          <p className="text-zinc-400">
            نتائج البحث: <span className="font-bold text-zinc-200">{visible.length}</span>
            {allCache ? ` من أصل ${allCache.length} سؤال في المادة` : ' (ضمن الصفحات المحمّلة)'}
            {visible.length === 100 && ' — معروض أول 100 فقط'}
          </p>
        ) : (
          <p className="text-zinc-400">
            الصفحة <span className="font-bold text-zinc-200">{pageIndex + 1}</span> — معروض{' '}
            {visible.length} سؤال (25 لكل صفحة)
          </p>
        )}

        {!isSearching && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0 || loading}
              className="btn btn-ghost btn-sm"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>
            <button
              onClick={nextPage}
              disabled={loading || (reachedEnd && pageIndex + 1 >= pages.length)}
              className="btn btn-ghost btn-sm"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Database}
          title={isSearching ? 'لا نتائج مطابقة' : 'لا توجد أسئلة في هذا النطاق'}
          description={
            isSearching
              ? 'جرّب كلمة أخرى أو غيّر الدرس المختار.'
              : 'استورد ملف Word أو أضف سؤالاً يدوياً من الزر أعلاه.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((q) => (
            <div key={q.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-600 mb-2">
                    الدرس {q.lessonNumber} · سؤال #{q.questionNumber}
                    {q.sourceCohortYear ? ` · جيل ${q.sourceCohortYear}` : ''}
                  </p>
                  <p className="font-bold leading-relaxed">{q.questionText}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditing({ ...q, isNew: false })}
                    className="btn btn-ghost btn-sm"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => setConfirmDelete(q)}
                    className="btn btn-ghost btn-sm text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 mt-4">
                {(q.optionsText || []).map((opt, i) => (
                  <div
                    key={i}
                    className={`text-sm rounded-lg px-3 py-2 border ${
                      i === q.correctAnswerIndex
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-surface2 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <span className="font-bold ml-1.5">{ARABIC_LETTERS[i]})</span>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نموذج التعديل / الإضافة */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editing.isNew ? 'إضافة سؤال جديد' : 'تعديل السؤال'}
              </h3>
              <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editing.isNew && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="qlesson">
                    الدرس
                  </label>
                  <select
                    id="qlesson"
                    className="field"
                    value={editing.lessonNumber}
                    onChange={(e) => setEditing({ ...editing, lessonNumber: e.target.value })}
                  >
                    <option value="">— اختر الدرس —</option>
                    {lessons.map((l) => (
                      <option key={l.number} value={l.number}>
                        الدرس {l.number}: {l.title}
                      </option>
                    ))}
                  </select>
                  {lessons.length === 0 && (
                    <p className="text-xs text-amber-300 mt-1.5">
                      لا توجد دروس بعد — استورد ملف Word أولاً لإنشاء الدروس.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="qnum">
                    رقم السؤال (مرجعي)
                  </label>
                  <input
                    id="qnum"
                    type="number"
                    min="0"
                    className="field"
                    value={editing.questionNumber || ''}
                    onChange={(e) => setEditing({ ...editing, questionNumber: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="qtext">
                نص السؤال
              </label>
              <textarea
                id="qtext"
                rows={3}
                className="field resize-none"
                value={editing.questionText}
                onChange={(e) => setEditing({ ...editing, questionText: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <span className="label">الخيارات (اختر الإجابة الصحيحة)</span>
              {editing.optionsText.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct"
                    checked={Number(editing.correctAnswerIndex) === i}
                    onChange={() => setEditing({ ...editing, correctAnswerIndex: i })}
                    className="w-5 h-5 accent-[rgb(var(--c-accent-fill))]"
                  />
                  <span className="font-bold text-zinc-500 w-5">{ARABIC_LETTERS[i]}</span>
                  <input
                    className="field flex-1"
                    value={opt}
                    onChange={(e) => {
                      const next = [...editing.optionsText];
                      next[i] = e.target.value;
                      setEditing({ ...editing, optionsText: next });
                    }}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="label" htmlFor="explanation">
                شرح الإجابة (اختياري — يظهر للطالب بعد التسليم)
              </label>
              <textarea
                id="explanation"
                rows={2}
                className="field resize-none"
                value={editing.explanation || ''}
                onChange={(e) => setEditing({ ...editing, explanation: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={saveQuestion} disabled={busy} className="btn-primary flex-1">
                {busy ? <Spinner className="w-5 h-5 on-accent" /> : null}
                {editing.isNew ? 'إضافة السؤال' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأكيد الحذف */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">حذف السؤال؟</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{confirmDelete.questionText}</p>
            <p className="text-xs text-amber-300">هذا الإجراء لا يمكن التراجع عنه.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">
                إلغاء
              </button>
              <button onClick={removeQuestion} disabled={busy} className="btn-danger flex-1">
                {busy ? <Spinner className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
