'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import {
  autosaveAssignment, submitAssignment, type StudentAnswerPayload, type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import { useAutosaveScheduler, useExamBrowserSync, useExamCountdown } from './useExamBrowserSync';
import {
  clearLocalDraft, findFirstPartialOrderingIndex, formatSavedTimeHmS,
  readDraftFlags, writeDraftFlags,
} from '../utils/exam-draft';
import {
  mergePendingExamAnswers, pruneAcknowledgedExamDrafts, publishExamRevision, recoverPendingExamAnswers,
  sameExamAnswer, storePendingExamAnswers, type PendingExamAnswers,
} from '../utils/exam-pending-draft';
import {
  applyPendingQuestionPatch, buildResolvedSessionSnapshot, buildSyncPayload, fetchExamEntrySession,
  INITIAL_SESSION_SNAPSHOT, mergeAutosaveSessionQuestions,
  reconcilePendingAfterAutosave, tickCountdownSnapshot,
  type ExamSaveState, type ExamSnapshotLike,
} from '../utils/exam-session-transport';
import { ApiClientError, extractErrorMessage } from '@/lib/api-client';

export type { ExamSaveState, ExamViewMode } from '@/features/assignments/utils/exam-session-transport';

const CONFLICT_MESSAGE =
  'Cùng một câu đã được sửa ở nơi khác. Bản nháp trên thiết bị này còn nguyên. Bấm Lưu nháp hoặc Nộp bài để dùng đáp án đang hiển thị.';

export function useStudentExamSession(assignmentId: string, mode?: string | null) {
  const [snapshot, setSnapshot] = useState<ExamSnapshotLike>(INITIAL_SESSION_SNAPSHOT);
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveState, setSaveState] = useState<ExamSaveState>('idle');
  const [draftMemoryOnly, setDraftMemoryOnly] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const snapshotRef = useRef<ExamSnapshotLike>(INITIAL_SESSION_SNAPSHOT);
  const pending = useRef<PendingExamAnswers>({});
  const recoveredDrafts = useRef<ReadonlyMap<string, string>>(new Map());
  const conflict = useRef(false);
  const writing = useRef<Promise<void> | null>(null);
  const sending = useRef(false);
  const clientId = useRef('');
  const flushAutosaveRef = useRef<() => void>(() => undefined);
  const { clearTimers, scheduleForType } = useAutosaveScheduler();

  const show = useCallback((next: ExamSnapshotLike) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const applyServer = useCallback((dto: StudentExamSessionDto, nextMode: 'taking' | 'review', useLocal = false) => {
    const resolved = buildResolvedSessionSnapshot(dto, nextMode);
    if (nextMode === 'taking' && useLocal) {
      setFlaggedIds(readDraftFlags(dto.submission.id, dto.submission.studentId));
    } else if (nextMode !== 'taking') {
      setFlaggedIds({});
    }
    if (useLocal && nextMode === 'taking') {
      pruneAcknowledgedExamDrafts(dto);
      const recovered = recoverPendingExamAnswers(dto, resolved.mergedFromLocal ? resolved.snapshot.answers : undefined);
      pending.current = recovered.pending;
      conflict.current = recovered.hasConflict;
      recoveredDrafts.current = recovered.sourceDrafts;
    }
    const merged = mergePendingExamAnswers(dto, nextMode === 'taking' ? pending.current : {});
    const hasPending = Object.keys(merged.pending).length > 0;
    if (nextMode === 'taking') {
      pending.current = merged.pending;
      const stored = storePendingExamAnswers(dto, clientId.current, merged.pending);
      setDraftMemoryOnly(hasPending && !stored);
    } else setDraftMemoryOnly(false);
    conflict.current = nextMode === 'taking' && (merged.hasConflict || (conflict.current && hasPending));
    if (conflict.current) setActionError(CONFLICT_MESSAGE);
    else setActionError((current) => current === CONFLICT_MESSAGE ? '' : current);
    show({
      ...resolved.snapshot, answers: merged.answers, audioPlayCounts: merged.audioPlayCounts,
      elapsedSeconds: dto.submission.elapsedSeconds, remainingSeconds: dto.submission.remainingSeconds,
      anchorElapsedSeconds: dto.submission.elapsedSeconds, anchorRemainingSeconds: dto.submission.remainingSeconds,
    });
    setLastSavedText(formatSavedTimeHmS(dto.submission.lastSavedAt));
    setSaveState(hasPending ? 'dirty' : 'saved');
    setConnectionLost(false);
  }, [show]);

  const reload = useCallback(async (expectedId: string) => {
    const { dto, nextMode } = await fetchExamEntrySession(assignmentId, mode, undefined, clientId.current);
    if (snapshotRef.current.session?.submission.id !== expectedId) return false;
    const changedAttempt = dto.submission.id !== expectedId;
    if (changedAttempt) {
      pending.current = {};
      conflict.current = false;
      setCurrentIndex(0);
      setFlaggedIds({});
    }
    applyServer(dto, nextMode, changedAttempt);
    return true;
  }, [assignmentId, mode, applyServer]);

  const flushAutosave = useCallback(async (explicit = false, timerOnly = false) => {
    const attemptId = snapshotRef.current.session?.submission.id;
    while (writing.current) {
      if (timerOnly) return;
      await writing.current;
    }
    const snap = snapshotRef.current;
    if (!snap.session || snap.session.submission.id !== attemptId || snap.viewMode !== 'taking' ||
        sending.current || document.hidden || !navigator.onLine) return;
    const expectedId = snap.session.submission.id;
    const selected = timerOnly || (conflict.current && !explicit) ? {} : pending.current;
    const request = buildSyncPayload(snap, new Set(Object.keys(selected)));
    if (request.answers.length) { clearTimers(); setSaveState('saving'); setActionError(''); }
    const write = (async () => {
      try {
        const rawUpdated = await autosaveAssignment(assignmentId, {
          ...request, timerClientId: clientId.current,
        });
        if (snapshotRef.current.session?.submission.id !== expectedId) return;
        const updated = mergeAutosaveSessionQuestions(rawUpdated, snap.session!.questions);
        if (updated.submission.revision > snap.session!.submission.revision && request.answers.length) {
          pending.current = reconcilePendingAfterAutosave(pending.current, request.answers, updated, sameExamAnswer);
          conflict.current = false;
          pruneAcknowledgedExamDrafts(updated, explicit ? { drafts: recoveredDrafts.current, sent: request.answers, displayed: snap.answers } : undefined);
          publishExamRevision(updated);
        }
        if (updated.submission.status !== 'IN_PROGRESS') publishExamRevision(updated);
        applyServer(updated, updated.submission.status === 'IN_PROGRESS' ? 'taking' : 'review');
      } catch (error) {
        if (snapshotRef.current.session?.submission.id !== expectedId) return;
        if (error instanceof ApiClientError && error.status === 409) {
          try {
            await reload(expectedId);
            if (snapshotRef.current.session?.submission.id === expectedId &&
                snapshotRef.current.viewMode === 'taking' && !conflict.current && Object.keys(pending.current).length) {
              setTimeout(() => { flushAutosaveRef.current(); }, 0);
            }
            return;
          } catch (reloadError) { error = reloadError; }
        }
        if (error instanceof ApiClientError) {
          setActionError(extractErrorMessage(error, 'Không thể lưu bản nháp lúc này.'));
          setSaveState('dirty');
        } else {
          setConnectionLost(true);
          setSaveState('offline');
        }
      }
    })();
    writing.current = write;
    try { await write; } finally { if (writing.current === write) writing.current = null; }
  }, [assignmentId, applyServer, clearTimers, reload]);

  useEffect(() => {
    flushAutosaveRef.current = () => { void flushAutosave(); };
  }, [flushAutosave]);
  const submitNow = useCallback(async (auto = false) => {
    if (auto) { await flushAutosave(false, true); return; }
    if (sending.current) return;
    while (writing.current) await writing.current;
    const snap = snapshotRef.current;
    if (!snap.session || snap.viewMode !== 'taking' || sending.current) return;
    const partialIdx = findFirstPartialOrderingIndex(snap.session.questions, snap.answers);
    if (partialIdx >= 0) {
      setActionError('Còn câu sắp xếp chưa chọn đủ các mảnh từ. Vui lòng hoàn thành hoặc xóa hết trước khi nộp.');
      setCurrentIndex(partialIdx);
      return;
    }
    sending.current = true;
    setSubmitting(true);
    setActionError('');
    clearTimers();
    const expectedId = snap.session.submission.id;
    const request = buildSyncPayload(snap, new Set(Object.keys(pending.current)));
    try {
      const result = await submitAssignment(assignmentId, request);
      if (snapshotRef.current.session?.submission.id !== expectedId) return;
      pending.current = {};
      if (result.submission.revision > snap.session.submission.revision) {
        pruneAcknowledgedExamDrafts(result, { drafts: recoveredDrafts.current, sent: request.answers, displayed: snap.answers });
      }
      clearLocalDraft(result.submission.id, result.submission.studentId);
      publishExamRevision(result);
      applyServer(result, 'review');
    } catch (error) {
      if (snapshotRef.current.session?.submission.id !== expectedId) return;
      if (error instanceof ApiClientError && error.status === 409) {
        try {
          if (await reload(expectedId) && snapshotRef.current.viewMode === 'taking' && !conflict.current) {
            setActionError('Bài chưa nộp. Vui lòng kiểm tra bản nháp đã đồng bộ và bấm Nộp bài lại.');
          }
          return;
        } catch (reloadError) { error = reloadError; }
      }
      setActionError(extractErrorMessage(error, 'Không thể nộp bài lúc này. Vui lòng thử lại.'));
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }, [assignmentId, applyServer, clearTimers, flushAutosave, reload]);

  const pause = useCallback(() => {
    const { session, viewMode } = snapshotRef.current;
    if (!session || viewMode !== 'taking' || session.submission.remainingSeconds === null) return;
    void autosaveAssignment(assignmentId, {
      submissionId: session.submission.id, timerClientId: clientId.current, pauseTimer: true, answers: [],
    }, true).catch(() => undefined);
  }, [assignmentId]);

  useEffect(() => {
    if (!assignmentId) return;
    const controller = new AbortController();
    clientId.current = crypto.randomUUID();
    pending.current = {};
    recoveredDrafts.current = new Map();
    conflict.current = false;
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      show(INITIAL_SESSION_SNAPSHOT);
      return fetchExamEntrySession(assignmentId, mode, controller.signal, clientId.current);
    }).then((loaded) => {
      if (!loaded || controller.signal.aborted) return;
      applyServer(loaded.dto, loaded.nextMode, true);
      if (loaded.nextMode === 'taking' && !conflict.current && Object.keys(pending.current).length) void flushAutosave();
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErrorMessage(extractErrorMessage(error, 'Không thể mở bài tập này'));
      show({ ...INITIAL_SESSION_SNAPSHOT, viewMode: 'error' });
    });
    return () => { controller.abort(); clearTimers(); pause(); snapshotRef.current = INITIAL_SESSION_SNAPSHOT; };
  }, [assignmentId, mode, applyServer, clearTimers, flushAutosave, pause, show]);

  const resume = useCallback(() => { void flushAutosave(); }, [flushAutosave]);
  const syncRemote = useCallback(() => { if (!document.hidden) void flushAutosave(false, true); }, [flushAutosave]);
  const offline = useExamBrowserSync({
    submissionId: snapshot.session?.submission.id, studentId: snapshot.session?.submission.studentId,
    onResume: resume, onPause: pause, onRemoteChange: syncRemote,
  });
  const taking = snapshot.viewMode === 'taking';
  const timed = snapshot.remainingSeconds !== null;
  useEffect(() => {
    if (!taking || !timed || offline) return;
    const timer = setInterval(() => { if (!document.hidden) void flushAutosave(false, true); }, 10_000);
    return () => clearInterval(timer);
  }, [taking, timed, offline, flushAutosave]);
  const tick = useCallback(() => {
    if (document.hidden) return null;
    const ticked = tickCountdownSnapshot(snapshotRef.current);
    if (ticked) show(ticked.nextSnap);
    return ticked?.nextRemaining ?? null;
  }, [show]);
  const expire = useCallback(() => void submitNow(true), [submitNow]);
  useExamCountdown({ active: taking && timed && !offline && !connectionLost && !submitting, submissionId: snapshot.session?.submission.id, onTick: tick, onExpire: expire });
  const stagePending = useCallback((
    questionId: string,
    type: QuestionType,
    patch: { answer?: StudentAnswerPayload; audioPlayCount?: number },
  ) => {
    const snap = snapshotRef.current;
    if (snap.viewMode !== 'taking' || !snap.session) return;
    const { nextPending, nextSnap } = applyPendingQuestionPatch(snap, pending.current, questionId, patch);
    pending.current = nextPending;
    setDraftMemoryOnly(!storePendingExamAnswers(snap.session, clientId.current, nextPending));
    show(nextSnap);
    if (patch.answer !== undefined) setSaveState(navigator.onLine ? 'dirty' : 'offline');
    scheduleForType(type, () => { if (navigator.onLine && !document.hidden) void flushAutosave(); });
  }, [flushAutosave, scheduleForType, show]);
  const updateAnswer = useCallback((questionId: string, type: QuestionType, answer: StudentAnswerPayload) => {
    stagePending(questionId, type, { answer });
  }, [stagePending]);
  const recordAudioPlay = useCallback((questionId: string) => {
    const nextPlays = (snapshotRef.current.audioPlayCounts[questionId] ?? 0) + 1;
    stagePending(questionId, 'LISTENING', { audioPlayCount: nextPlays });
  }, [stagePending]);
  const selectQuestion = useCallback((index: number) => {
    if (Object.keys(pending.current).length && navigator.onLine) void flushAutosave();
    setCurrentIndex(index);
  }, [flushAutosave]);
  const toggleFlag = useCallback((id: string) => {
    const sub = snapshotRef.current.session?.submission;
    const scope = snapshotRef.current.session?.assignment.assignmentId;
    setFlaggedIds((current) => {
      const next = { ...current, [id]: !current[id] };
      if (sub) writeDraftFlags(sub.id, sub.studentId, next, scope);
      return next;
    });
  }, []);
  return {
    ...snapshot, flaggedIds, currentIndex, lastSavedText, errorMessage,
    saveState: draftMemoryOnly && saveState !== 'saving' ? 'memory-only' as const : saveState,
    actionError: [actionError, draftMemoryOnly && 'Không thể lưu trên thiết bị. Hãy giữ trang mở đến khi bản nháp đồng bộ.'].filter(Boolean).join(' '),
    submitting, isOffline: offline || connectionLost, selectQuestion, toggleFlag, updateAnswer, recordAudioPlay,
    saveDraftNow: () => flushAutosave(true), submitNow,
  };
}
