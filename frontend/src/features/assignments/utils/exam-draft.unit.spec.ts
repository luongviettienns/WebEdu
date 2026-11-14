import { expect, test } from '@playwright/test';
import {
  getAssignmentSubmissions,
  type SanitizedQuestionDto,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import {
  clearLocalDraft,
  getDraftStorageKey,
  MAX_CLOCK_SKEW_MS,
  MAX_ELAPSED_DELTA_SECONDS,
  MAX_LOCAL_DRAFT_DRIFT_MS,
  mergeAudioPlayCounts,
  persistExamDraftSnapshot,
  readLocalDraft,
  resolveInitialSessionDraft,
  sanitizeAdoptedLocalDraft,
  sanitizeLocalDraftAnswers,
  writeLocalDraft,
  type ExamLocalDraft,
} from '@/features/assignments/utils/exam-draft';
import {
  reconcileAutosaveSnapshot,
  type ExamSnapshotLike,
} from '@/features/assignments/utils/exam-session-transport';
import { purgeLegacyWebStorageTokens } from '@/lib/api-client';

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

interface MockWindow {
  localStorage: Storage;
  sessionStorage: Storage;
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalFetch = globalThis.fetch;

function installMockWindow(): MockWindow {
  const mockWin: MockWindow = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  };
  Object.defineProperty(globalThis, 'window', {
    value: mockWin,
    configurable: true,
    writable: true,
  });
  return mockWin;
}

function restoreGlobals(): void {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
  globalThis.fetch = originalFetch;
}

function createSampleQuestions(): SanitizedQuestionDto[] {
  return [
    {
      id: 'q-single',
      position: 1,
      type: 'SINGLE_CHOICE',
      prompt: 'Single choice',
      points: 2,
      options: [
        { id: 'opt-1', text: 'A' },
        { id: 'opt-2', text: 'B' },
      ],
    },
    {
      id: 'q-multi',
      position: 2,
      type: 'MULTIPLE_CHOICE',
      prompt: 'Multi choice',
      points: 2,
      options: [
        { id: 'm-1', text: 'M1' },
        { id: 'm-2', text: 'M2' },
        { id: 'm-3', text: 'M3' },
      ],
    },
    {
      id: 'q-order',
      position: 3,
      type: 'ORDERING',
      prompt: 'Order tokens',
      points: 3,
      tokens: ['我', '很', '好', '我'],
    },
    {
      id: 'q-fill',
      position: 4,
      type: 'FILL_BLANK',
      prompt: 'Fill blank',
      points: 2,
      maxLength: 10,
    },
    {
      id: 'q-essay',
      position: 5,
      type: 'ESSAY',
      prompt: 'Essay',
      points: 5,
      maxLength: 8,
    },
    {
      id: 'q-listen-opt',
      position: 6,
      type: 'LISTENING',
      prompt: 'Listening options',
      points: 2,
      mediaId: 'med-1',
      maxListens: 2,
      multiple: false,
      options: [
        { id: 'lo-1', text: 'L1' },
        { id: 'lo-2', text: 'L2' },
      ],
    },
    {
      id: 'q-listen-text',
      position: 7,
      type: 'LISTENING',
      prompt: 'Listening text',
      points: 2,
      mediaId: 'med-2',
      maxListens: 1,
    },
    {
      id: 'q-img-opt',
      position: 8,
      type: 'IMAGE_BASED',
      prompt: 'Image multi',
      points: 2,
      mediaId: 'med-3',
      multiple: true,
      options: [
        { id: 'io-1', text: 'I1' },
        { id: 'io-2', text: 'I2' },
      ],
    },
    {
      id: 'q-img-text',
      position: 9,
      type: 'IMAGE_BASED',
      prompt: 'Image text',
      points: 2,
      mediaId: 'med-4',
    },
  ];
}

function createSessionDto(overrides?: {
  studentId?: string;
  submissionId?: string;
  lastSavedAt?: string;
  elapsedSeconds?: number;
  remainingSeconds?: number | null;
  answers?: StudentExamSessionDto['answers'];
  questions?: SanitizedQuestionDto[];
}): StudentExamSessionDto {
  const studentId = overrides?.studentId ?? 'student-1';
  const submissionId = overrides?.submissionId ?? 'sub-1';
  const lastSavedAt = overrides?.lastSavedAt ?? '2026-11-14T10:00:00.000Z';
  const questions = overrides?.questions ?? createSampleQuestions();
  return {
    assignment: {
      assignmentId: 'assign-1',
      assessmentId: 'assess-1',
      assessmentTitle: 'HSK2 Mini Test',
      assessmentType: 'MINI_TEST',
      classId: 'class-1',
      classCode: 'HSK2-K26-01',
      className: 'HSK 2',
      assignedAt: '2026-11-01T00:00:00.000Z',
      dueAt: '2026-11-20T00:00:00.000Z',
      effectiveDurationMinutes: 30,
      instructions: null,
      questionCount: questions.length,
      totalPoints: 22,
      isOverdue: false,
      submissionId,
      attemptNumber: 1,
      status: 'IN_PROGRESS',
      displayStatusLabel: 'Đang làm dở',
      remainingSeconds: overrides?.remainingSeconds !== undefined ? overrides.remainingSeconds : 1200,
      elapsedSeconds: overrides?.elapsedSeconds ?? 120,
      answeredCount: 1,
      lastSavedAt,
      submittedAt: null,
      autoSubmitted: false,
      autoScore: null,
      totalScore: null,
      teacherFeedback: null,
    },
    submission: {
      id: submissionId,
      studentId,
      attemptNumber: 1,
      status: 'IN_PROGRESS',
      displayStatusLabel: 'Đang làm dở',
      startedAt: '2026-11-14T09:58:00.000Z',
      lastSavedAt,
      lastSyncedAt: lastSavedAt,
      elapsedSeconds: overrides?.elapsedSeconds ?? 120,
      remainingSeconds: overrides?.remainingSeconds !== undefined ? overrides.remainingSeconds : 1200,
      submittedAt: null,
      autoSubmitted: false,
      dueAtOverride: null,
      reopenReason: null,
    },
    questions,
    answers: overrides?.answers ?? [
      {
        questionId: 'q-single',
        answerPayload: { selectedOptionIds: ['opt-1'] },
        audioPlayCount: 0,
        updatedAt: lastSavedAt,
      },
      {
        questionId: 'q-listen-opt',
        answerPayload: { selectedOptionIds: ['lo-1'] },
        audioPlayCount: 1,
        updatedAt: lastSavedAt,
      },
    ],
  };
}

test.describe('Exam Draft Security, Bounded Merge & Transport Sync', () => {
  let mockWin: MockWindow;

  test.beforeEach(() => {
    mockWin = installMockWindow();
  });

  test.afterEach(() => {
    restoreGlobals();
  });

  test('exports expected drift, clock skew, and elapsed delta constants', () => {
    expect(MAX_LOCAL_DRAFT_DRIFT_MS).toBe(5 * 60 * 1000);
    expect(MAX_CLOCK_SKEW_MS).toBe(5_000);
    expect(MAX_ELAPSED_DELTA_SECONDS).toBe(300);
  });

  test('scopes localStorage keys by studentId and submissionId', () => {
    expect(getDraftStorageKey('sub-42', 'stu-a')).toBe('webedu_exam_draft_stu-a_sub-42');
    expect(getDraftStorageKey('sub-42', 'stu-b')).toBe('webedu_exam_draft_stu-b_sub-42');

    const draftA: ExamLocalDraft = {
      updatedAtMs: 1000,
      answers: { q1: { text: 'Alice' } },
      elapsedSeconds: 10,
      remainingSeconds: 500,
      audioPlayCounts: {},
    };
    const draftB: ExamLocalDraft = {
      updatedAtMs: 2000,
      answers: { q1: { text: 'Bob' } },
      elapsedSeconds: 20,
      remainingSeconds: 490,
      audioPlayCounts: {},
    };

    writeLocalDraft('sub-42', 'stu-a', draftA);
    writeLocalDraft('sub-42', 'stu-b', draftB);

    expect(readLocalDraft('sub-42', 'stu-a')).toEqual(draftA);
    expect(readLocalDraft('sub-42', 'stu-b')).toEqual(draftB);

    clearLocalDraft('sub-42', 'stu-a');
    expect(readLocalDraft('sub-42', 'stu-a')).toBeNull();
    expect(readLocalDraft('sub-42', 'stu-b')).toEqual(draftB);

    const savedAt = persistExamDraftSnapshot('sub-42', 'stu-a', {
      answers: { q1: { text: 'Persisted' } },
      elapsedSeconds: 12,
      remainingSeconds: 498,
      audioPlayCounts: {},
    });
    expect(savedAt).toBeGreaterThan(0);
    expect(readLocalDraft('sub-42', 'stu-a')?.answers).toEqual({ q1: { text: 'Persisted' } });
  });

  test('purgeLegacyWebStorageTokens removes access token and all webedu_exam_draft_* keys across both storages', () => {
    mockWin.localStorage.setItem('webedu_access_token', 'jwt');
    mockWin.localStorage.setItem('webedu_exam_draft_stu1_sub1', '{"updatedAtMs":1}');
    mockWin.localStorage.setItem('webedu_exam_draft_stu2_sub2', '{"updatedAtMs":2}');
    mockWin.localStorage.setItem('webedu_exam_draft_stu3_sub3', '{"updatedAtMs":3}');
    mockWin.localStorage.setItem('unrelated_setting', 'keep');

    mockWin.sessionStorage.setItem('webedu_access_token', 'jwt');
    mockWin.sessionStorage.setItem('webedu_exam_draft_stu1_sub1', '{"updatedAtMs":1}');
    mockWin.sessionStorage.setItem('webedu_exam_draft_stu2_sub2', '{"updatedAtMs":2}');
    mockWin.sessionStorage.setItem('other_session_key', 'keep');

    purgeLegacyWebStorageTokens();

    expect(mockWin.localStorage.getItem('webedu_access_token')).toBeNull();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_stu1_sub1')).toBeNull();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_stu2_sub2')).toBeNull();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_stu3_sub3')).toBeNull();
    expect(mockWin.localStorage.getItem('unrelated_setting')).toBe('keep');

    expect(mockWin.sessionStorage.getItem('webedu_access_token')).toBeNull();
    expect(mockWin.sessionStorage.getItem('webedu_exam_draft_stu1_sub1')).toBeNull();
    expect(mockWin.sessionStorage.getItem('webedu_exam_draft_stu2_sub2')).toBeNull();
    expect(mockWin.sessionStorage.getItem('other_session_key')).toBe('keep');
  });

  test('sanitizeLocalDraftAnswers strips unknown questionIds, invalid shapes, out-of-bounds options/tokens, and caps maxLength', () => {
    const questions = createSampleQuestions();
    const rawAnswers: Record<string, unknown> = {
      'unknown-question': { text: 'should be removed' },
      'q-single': { selectedOptionIds: ['opt-1', 'opt-2'] },
      'q-multi': { selectedOptionIds: ['m-1', 'm-1', 'm-3'] },
      'q-order': { orderedTokens: ['我', '很', '我'] },
      'q-fill': { text: '123456789012345' },
      'q-essay': { text: 'abcdefghijkl' },
      'q-listen-opt': { selectedOptionIds: ['fake-opt'] },
      'q-listen-text': { selectedOptionIds: ['wrong-shape'] },
      'q-img-opt': { selectedOptionIds: ['io-1', 'io-2'] },
      'q-img-text': { text: 'Valid image caption answer' },
    };

    const sanitized = sanitizeLocalDraftAnswers(
      questions,
      rawAnswers as Record<string, StudentAnswerPayload>,
    );

    expect(sanitized['unknown-question']).toBeUndefined();
    expect(sanitized['q-single']).toBeUndefined();
    expect(sanitized['q-multi']).toEqual({ selectedOptionIds: ['m-1', 'm-3'] });
    expect(sanitized['q-order']).toEqual({ orderedTokens: ['我', '很', '我'] });
    expect(sanitized['q-fill']).toEqual({ text: '1234567890' });
    expect(sanitized['q-essay']).toEqual({ text: 'abcdefgh' });
    expect(sanitized['q-listen-opt']).toBeUndefined();
    expect(sanitized['q-listen-text']).toBeUndefined();
    expect(sanitized['q-img-opt']).toEqual({ selectedOptionIds: ['io-1', 'io-2'] });
    expect(sanitized['q-img-text']).toEqual({ text: 'Valid image caption answer' });

    const invalidOrdering = sanitizeLocalDraftAnswers(questions, {
      'q-order': { orderedTokens: ['我', '我', '我'] },
      'q-multi': { selectedOptionIds: ['m-1', 'non-existent'] },
    } as Record<string, StudentAnswerPayload>);
    expect(invalidOrdering['q-order']).toBeUndefined();
    expect(invalidOrdering['q-multi']).toBeUndefined();
  });

  test('resolveInitialSessionDraft rejects and wipes stale, >5min drifted, and future-dated drafts', () => {
    const serverSavedAt = '2026-11-14T10:00:00.000Z';
    const serverSavedMs = new Date(serverSavedAt).getTime();
    const session = createSessionDto({ lastSavedAt: serverSavedAt });

    // 1. Stale draft (updatedAtMs <= serverSavedMs) must be rejected AND wiped from storage
    writeLocalDraft('sub-1', 'student-1', {
      updatedAtMs: serverSavedMs,
      answers: { 'q-fill': { text: 'stale' } },
      elapsedSeconds: 200,
      remainingSeconds: 1000,
      audioPlayCounts: {},
    });
    const staleRes = resolveInitialSessionDraft(session, 'taking', serverSavedMs + 10_000);
    expect(staleRes.mergedFromLocal).toBe(false);
    expect(staleRes.answers['q-fill']).toBeUndefined();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_student-1_sub-1')).toBeNull();
    expect(readLocalDraft('sub-1', 'student-1')).toBeNull();

    // 2. Drifted > 5 minutes past serverSavedMs must be rejected AND wiped
    writeLocalDraft('sub-1', 'student-1', {
      updatedAtMs: serverSavedMs + MAX_LOCAL_DRAFT_DRIFT_MS + 1,
      answers: { 'q-fill': { text: 'drifted' } },
      elapsedSeconds: 200,
      remainingSeconds: 1000,
      audioPlayCounts: {},
    });
    const driftRes = resolveInitialSessionDraft(
      session,
      'taking',
      serverSavedMs + MAX_LOCAL_DRAFT_DRIFT_MS + 2_000,
    );
    expect(driftRes.mergedFromLocal).toBe(false);
    expect(driftRes.answers['q-fill']).toBeUndefined();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_student-1_sub-1')).toBeNull();

    // 3. Future-dated tampered draft (> nowMs + MAX_CLOCK_SKEW_MS) must be rejected AND wiped
    writeLocalDraft('sub-1', 'student-1', {
      updatedAtMs: serverSavedMs + 60_000,
      answers: { 'q-fill': { text: 'future' } },
      elapsedSeconds: 200,
      remainingSeconds: 1000,
      audioPlayCounts: {},
    });
    const futureRes = resolveInitialSessionDraft(session, 'taking', serverSavedMs + 10_000);
    expect(futureRes.mergedFromLocal).toBe(false);
    expect(futureRes.answers['q-fill']).toBeUndefined();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_student-1_sub-1')).toBeNull();
  });

  test('resolveInitialSessionDraft merges valid draft with sanitized answers, clamped timers, and monotonic audio counts', () => {
    const serverSavedAt = '2026-11-14T10:00:00.000Z';
    const serverSavedMs = new Date(serverSavedAt).getTime();
    const session = createSessionDto({
      lastSavedAt: serverSavedAt,
      elapsedSeconds: 120,
      remainingSeconds: 1200,
    });

    writeLocalDraft('sub-1', 'student-1', {
      updatedAtMs: serverSavedMs + 30_000,
      answers: {
        'q-single': { selectedOptionIds: ['opt-1', 'opt-2'] },
        'q-fill': { text: '你好' },
        'unknown-q': { text: 'bad' },
      },
      elapsedSeconds: 9999,
      remainingSeconds: 100,
      audioPlayCounts: {
        'q-listen-opt': 0,
        'q-listen-text': 99,
        'unknown-audio': 5,
        'q-single': 5,
        'q-img-opt': 4,
        'q-fill': -3,
      },
    });

    const merged = resolveInitialSessionDraft(session, 'taking', serverSavedMs + 35_000);
    expect(merged.mergedFromLocal).toBe(true);
    expect(merged.draftUpdatedAtMs).toBe(serverSavedMs + 30_000);
    // Invalid q-single in local draft is dropped so server answer survives
    expect(merged.answers['q-single']).toEqual({ selectedOptionIds: ['opt-1'] });
    expect(merged.answers['q-fill']).toEqual({ text: '你好' });
    expect(merged.answers['unknown-q']).toBeUndefined();

    // Clamped elapsed [120, 120 + 300] and remaining [1200 - 300, 1200]
    expect(merged.elapsedSeconds).toBe(420);
    expect(merged.remainingSeconds).toBe(900);

    // Monotonic audio counts capped by maxListens, ignoring non-LISTENING & unknown questions
    expect(merged.audioPlayCounts['q-listen-opt']).toBe(1);
    expect(merged.audioPlayCounts['q-listen-text']).toBe(1);
    expect(merged.audioPlayCounts['unknown-audio']).toBeUndefined();
    expect(merged.audioPlayCounts['q-single']).toBeUndefined();
    expect(merged.audioPlayCounts['q-img-opt']).toBeUndefined();
    expect(merged.audioPlayCounts['q-fill']).toBeUndefined();
  });

  test('mergeAudioPlayCounts ignores entries for non-LISTENING questions', () => {
    const questions = createSessionDto().questions;

    const merged = mergeAudioPlayCounts(
      questions,
      { 'q-listen-opt': 1, 'q-single': 3, 'q-fill': 2, 'unknown-server': 4 },
      { 'q-listen-opt': 9, 'q-listen-text': 1, 'q-single': 10, 'q-img-opt': 5, 'unknown-local': 3 },
    );

    expect(merged).toEqual({
      'q-listen-opt': 2,
      'q-listen-text': 1,
    });
    expect(Object.keys(merged)).not.toContain('q-single');
    expect(Object.keys(merged)).not.toContain('q-img-opt');
    expect(Object.keys(merged)).not.toContain('q-fill');
    expect(Object.keys(merged)).not.toContain('unknown-server');
    expect(Object.keys(merged)).not.toContain('unknown-local');
  });

  test('sanitizeAdoptedLocalDraft strips tampered invalid answers/non-LISTENING counts and clamps forged timers & updatedAtMs', () => {
    const nowMs = 1_763_114_600_000;
    const session = createSessionDto({ elapsedSeconds: 120, remainingSeconds: 1200 });
    const currentSnap: ExamSnapshotLike = {
      session,
      viewMode: 'taking',
      answers: { 'q-single': { selectedOptionIds: ['opt-1'] } },
      audioPlayCounts: { 'q-listen-opt': 1, 'q-single': 2 },
      elapsedSeconds: 150,
      remainingSeconds: 1170,
    };

    const tamperedIncoming = {
      updatedAtMs: nowMs + 600_000,
      viewMode: 'review',
      answers: {
        'q-single': { selectedOptionIds: ['opt-1', 'opt-2'] }, // invalid (>1 option) -> preserve opt-1
        'q-multiple': { selectedOptionIds: ['forged-opt'] }, // invalid -> omitted
        'q-fill': { text: 'Cross-tab answer' }, // valid -> adopted
        'unknown-q': { text: 'Injected' }, // unknown -> stripped
      },
      elapsedSeconds: 99_999, // forged far ahead
      remainingSeconds: 9_999, // forged extra time
      audioPlayCounts: {
        'q-listen-opt': 0, // stale -> monotonic keeps 1
        'q-listen-text': 5, // capped at maxListens (1)
        'q-single': 9, // non-LISTENING -> stripped
        'q-essay': 4, // non-LISTENING -> stripped
        'unknown-q': 3,
      },
    } as unknown as ExamLocalDraft;

    const adopted = sanitizeAdoptedLocalDraft(tamperedIncoming, currentSnap, nowMs);
    expect(adopted).not.toBeNull();
    expect(adopted!.snapshot.viewMode).toBe('taking');
    expect(adopted!.snapshot.session).toBe(session);
    expect(adopted!.snapshot.answers).toEqual({
      'q-single': { selectedOptionIds: ['opt-1'] },
      'q-fill': { text: 'Cross-tab ' }, // capped at maxLength: 10
    });
    expect(adopted!.snapshot.answers['q-multiple']).toBeUndefined();
    expect(adopted!.snapshot.answers['unknown-q']).toBeUndefined();
    expect(adopted!.snapshot.audioPlayCounts).toEqual({
      'q-listen-opt': 1,
      'q-listen-text': 1,
    });
    expect(adopted!.snapshot.elapsedSeconds).toBe(150 + MAX_ELAPSED_DELTA_SECONDS);
    expect(adopted!.snapshot.remainingSeconds).toBe(1170);
    expect(adopted!.updatedAtMs).toBe(nowMs + MAX_CLOCK_SKEW_MS);

    // Forged low remainingSeconds clamps within MAX_ELAPSED_DELTA_SECONDS, forged low elapsedSeconds never goes backward
    const downwardTampered: ExamLocalDraft = {
      updatedAtMs: nowMs,
      answers: {},
      elapsedSeconds: 10,
      remainingSeconds: 5,
      audioPlayCounts: {},
    };
    const adoptedDown = sanitizeAdoptedLocalDraft(downwardTampered, currentSnap, nowMs);
    expect(adoptedDown!.snapshot.elapsedSeconds).toBe(150);
    expect(adoptedDown!.snapshot.remainingSeconds).toBe(1170 - MAX_ELAPSED_DELTA_SECONDS);

    // Forged null remainingSeconds cannot wipe server countdown
    const nullTimerTampered: ExamLocalDraft = {
      updatedAtMs: nowMs,
      answers: {},
      elapsedSeconds: 160,
      remainingSeconds: null,
      audioPlayCounts: {},
    };
    const adoptedNullTimer = sanitizeAdoptedLocalDraft(nullTimerTampered, currentSnap, nowMs);
    expect(adoptedNullTimer!.snapshot.remainingSeconds).toBe(1170);

    // Non-taking viewMode ignores cross-tab adoption
    const reviewSnap: ExamSnapshotLike = { ...currentSnap, viewMode: 'review' };
    expect(sanitizeAdoptedLocalDraft(downwardTampered, reviewSnap, nowMs)).toBeNull();
  });

  test('reconcileAutosaveSnapshot merges timers and audioPlayCounts monotonically from server response', () => {
    const session = createSessionDto({ elapsedSeconds: 150, remainingSeconds: 1150 });
    const prevSnap: ExamSnapshotLike = {
      session,
      viewMode: 'taking',
      answers: { 'q-single': { selectedOptionIds: ['opt-1'] } },
      audioPlayCounts: { 'q-listen-opt': 2, 'q-listen-text': 0 },
      elapsedSeconds: 140,
      remainingSeconds: 1160,
    };

    const updated = createSessionDto({
      elapsedSeconds: 180,
      remainingSeconds: 1120,
      answers: [
        {
          questionId: 'q-listen-opt',
          answerPayload: { selectedOptionIds: ['lo-1'] },
          audioPlayCount: 1,
          updatedAt: '2026-11-14T10:03:00.000Z',
        },
        {
          questionId: 'q-listen-text',
          answerPayload: { text: 'ok' },
          audioPlayCount: 1,
          updatedAt: '2026-11-14T10:03:00.000Z',
        },
      ],
    });

    const reconciled = reconcileAutosaveSnapshot(prevSnap, updated);
    expect(reconciled.elapsedSeconds).toBe(180);
    expect(reconciled.remainingSeconds).toBe(1120);
    expect(reconciled.audioPlayCounts).toEqual({
      'q-listen-opt': 2,
      'q-listen-text': 1,
    });
    expect(reconciled.answers).toEqual(prevSnap.answers);
  });

  test('getAssignmentSubmissions appends page and limit query params cleanly and preserves active exam drafts across fetchApi calls', async () => {
    const requestedUrls: string[] = [];
    mockWin.localStorage.setItem('webedu_access_token', 'stale-jwt');
    mockWin.localStorage.setItem('webedu_exam_draft_stu-1_sub-1', '{"updatedAtMs":100}');
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({ assignment: {}, students: [], total: 0, page: 1, limit: 20 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await getAssignmentSubmissions('assign/1');
    await getAssignmentSubmissions('assign-1', { page: 2, limit: 20 });

    expect(requestedUrls[0]).toMatch(/\/assignments\/assign%2F1\/submissions$/);
    expect(requestedUrls[1]).toMatch(/\/assignments\/assign-1\/submissions\?page=2&limit=20$/);
    expect(mockWin.localStorage.getItem('webedu_access_token')).toBeNull();
    expect(mockWin.localStorage.getItem('webedu_exam_draft_stu-1_sub-1')).toBe('{"updatedAtMs":100}');
  });
});
