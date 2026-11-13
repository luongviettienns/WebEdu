'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listCourses, type CourseItemDto } from '@/features/courses/api/courses.api';
import {
  addQuestion,
  createAssessment,
  deleteQuestion,
  getAssessment,
  getAssessmentReview,
  listAssessments,
  listMedia,
  publishAssessmentWithDrafts,
  reorderQuestions,
  saveAssessmentAndDrafts,
  updateQuestion,
  uploadMedia,
  type AssessmentStatus,
  type AssessmentType,
  type QuestionType,
  type TeacherAssessmentDto,
  type TeacherQuestionDto,
} from '@/features/assessments/api/assessments.api';
import type { MediaItem } from '@/features/assessments/components/MediaAttach';
import {
  omitDraft,
  parseDurationMinutes,
  swapQuestionIds,
  withQuestionList,
  type QuestionDraft,
  type QuestionUpdatePatch,
} from '@/features/assessments/utils/question-payload';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';

const PAGE_SIZE = 20;

export function useAssessments() {
  const [items, setItems] = useState<TeacherAssessmentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [courses, setCourses] = useState<CourseItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AssessmentType | ''>('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<AssessmentStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const debouncedSearch = useDebounce(search, 300);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);
  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleType = useCallback((v: AssessmentType | '') => { setType(v); setPage(1); }, []);
  const handleCourseId = useCallback((v: string) => { setCourseId(v); setPage(1); }, []);
  const handleStatus = useCallback((v: AssessmentStatus | '') => { setStatus(v); setPage(1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listCourses({}, { signal: controller.signal })
      .then((res) => { if (!controller.signal.aborted) setCourses(res.items ?? []); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const activeCourses = useMemo(() => courses.filter((c) => c.isActive), [courses]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listAssessments(
          {
            search: debouncedSearch.trim() || undefined,
            type: type || undefined,
            courseId: courseId || undefined,
            status: status || undefined,
            page,
            limit: PAGE_SIZE,
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setItems(res.items);
          setTotal(res.total);
          setLimit(res.limit);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(extractErrorMessage(err, 'Không thể tải ngân hàng đề'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedSearch, type, courseId, status, page, reloadTick]);

  return {
    items, total, page, limit, setPage, courses, activeCourses,
    search, setSearch: handleSearch, type, setType: handleType,
    courseId, setCourseId: handleCourseId, status, setStatus: handleStatus,
    loading, error, reload,
  };
}

export function useAssessmentWorkspace(assessmentId: string | null, mode: 'edit' | 'review') {
  const [detail, setDetail] = useState<TeacherAssessmentDto | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AssessmentType>('HOMEWORK');
  const [courseId, setCourseId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [drafts, setDrafts] = useState<Record<string, QuestionDraft>>({});
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    const controller = new AbortController();
    const fetchDetail = mode === 'review' ? getAssessmentReview : getAssessment;
    void fetchDetail(assessmentId, { signal: controller.signal })
      .then((row) => {
        if (controller.signal.aborted) return;
        setDetail(row);
        setTitle(row.title);
        setDescription(row.description ?? '');
        setType(row.type);
        setCourseId(row.courseId);
        setDurationMinutes(row.durationMinutes ? String(row.durationMinutes) : '');
        setDrafts({});
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, mode === 'review' ? 'Không thể tải bản duyệt' : 'Không thể tải đề'));
        }
      });
    return () => controller.abort();
  }, [assessmentId, mode]);

  const detailId = detail?.id;
  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    void listMedia(detailId, controller.signal).then(setLibrary).catch(() => undefined);
    return () => controller.abort();
  }, [detailId]);

  const questions = detail?.questions ?? [];
  const isLocked = Boolean(detail?.isLocked || detail?.status === 'PUBLISHED');
  const hasNeedsReview = questions.some((q) => q.needsReview);

  const replaceQuestion = (updated: TeacherQuestionDto) => {
    setDetail((curr) =>
      curr ? withQuestionList(curr, (curr.questions ?? []).map((q) => (q.id === updated.id ? updated : q))) : curr,
    );
    setDrafts((curr) => omitDraft(curr, updated.id));
  };

  const runAction = async <T,>(fallback: string, fn: () => Promise<T>): Promise<T | null> => {
    setError('');
    setSaved('');
    setSaving(true);
    try {
      return await fn();
    } catch (err) {
      setError(extractErrorMessage(err, fallback));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const validatedMeta = () => {
    if (!title.trim() || (!detail && !courseId)) {
      setError(detail ? 'Tên đề không được để trống' : 'Tên đề và khóa HSK là bắt buộc');
      return null;
    }
    const parsed = parseDurationMinutes(durationMinutes);
    if (!parsed.ok) { setError(parsed.error); return null; }
    return { title: title.trim(), description: description.trim(), durationMinutes: parsed.value ?? null };
  };

  const saveDraft = async () => {
    const meta = validatedMeta();
    if (!meta) return;
    await runAction(mode === 'review' ? 'Không thể lưu nháp' : 'Không thể lưu đề', async () => {
      const next = !detail
        ? await createAssessment({
            title: meta.title,
            description: meta.description || undefined,
            durationMinutes: meta.durationMinutes ?? undefined,
            type,
            courseId,
          })
        : await saveAssessmentAndDrafts(detail, meta, drafts, replaceQuestion);
      setDetail(next);
      setSaved('Đã lưu nháp');
    });
  };

  const publish = async (onDone?: () => void) => {
    if (!detail) return;
    const meta = validatedMeta();
    if (!meta) return;
    await runAction('Không thể phát hành', async () => {
      const published = await publishAssessmentWithDrafts(detail, meta, drafts, replaceQuestion);
      setDetail(published);
      setDrafts({});
      setSaved('Đã phát hành đề');
      onDone?.();
    });
  };

  const handleAddQuestion = async (input: {
    type: QuestionType; prompt: string; payload: Record<string, unknown>; points: number;
  }): Promise<boolean> => {
    if (!detail) return false;
    if (!input.prompt) { setError('Nội dung câu hỏi không được để trống'); return false; }
    if (!Number.isFinite(input.points) || input.points <= 0 || input.points > 1000) {
      setError('Điểm câu hỏi phải lớn hơn 0 và tối đa 1000'); return false;
    }
    const q = await runAction('Không thể thêm câu hỏi', () => addQuestion(detail.id, input));
    if (!q) return false;
    setDetail((curr) => (curr ? withQuestionList(curr, [...(curr.questions ?? []), q]) : curr));
    return true;
  };

  const handlePatchQuestion = async (q: TeacherQuestionDto, patch: QuestionUpdatePatch, msg?: string) => {
    if (!detail) return;
    await runAction('Không thể sửa câu hỏi', async () => {
      replaceQuestion(await updateQuestion(detail.id, q.id, patch));
      if (msg) setSaved(msg);
    });
  };

  const handleMove = async (index: number, delta: -1 | 1) => {
    if (!detail) return;
    const ids = swapQuestionIds(questions, index, delta);
    if (!ids) return;
    await runAction('Không thể đổi thứ tự', async () => {
      const rows = await reorderQuestions(detail.id, ids);
      setDetail((curr) => (curr ? { ...curr, questions: rows } : curr));
    });
  };

  const handleDelete = async (q: TeacherQuestionDto) => {
    if (!detail) return;
    await runAction('Không thể xóa câu hỏi', async () => {
      await deleteQuestion(detail.id, q.id);
      setDrafts((curr) => omitDraft(curr, q.id));
      setDetail((curr) =>
        curr ? withQuestionList(curr, (curr.questions ?? []).filter((item) => item.id !== q.id)) : curr,
      );
    });
  };

  const handleUpload = detail
    ? async (file: File) => {
        try {
          const row = await uploadMedia(detail.id, file);
          setLibrary((curr) => [...curr, row]);
          return row.id;
        } catch (err) {
          setError(extractErrorMessage(err, 'Không thể tải media'));
          throw err;
        }
      }
    : undefined;

  return {
    detail, title, setTitle, description, setDescription, type, setType,
    courseId, setCourseId, durationMinutes, setDurationMinutes,
    drafts, setQuestionDraft: (id: string, next: QuestionDraft) => setDrafts((c) => ({ ...c, [id]: next })),
    library, saving, error, setError, saved, preview, setPreview,
    questions, isLocked, hasNeedsReview,
    saveDraft, publish, handleAddQuestion, handlePatchQuestion, handleMove, handleDelete, handleUpload,
  };
}
