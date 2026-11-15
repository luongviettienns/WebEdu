import { expect, test } from '@playwright/test';
import {
  formatUpdatedGradeBadge,
  isStudentScoreVisible,
  isWaitingForTeacherGrading,
} from './grading-status';

test('Zero-Leak gate: only RETURNED exposes scores to students', () => {
  expect(isStudentScoreVisible('NOT_STARTED')).toBe(false);
  expect(isStudentScoreVisible('IN_PROGRESS')).toBe(false);
  expect(isStudentScoreVisible('SUBMITTED_WAITING')).toBe(false);
  expect(isStudentScoreVisible('AUTO_GRADED_PENDING_REVIEW')).toBe(false);
  expect(isStudentScoreVisible('GRADED')).toBe(false);
  expect(isStudentScoreVisible('SUPERSEDED')).toBe(false);
  expect(isStudentScoreVisible('RETURNED')).toBe(true);
});

test('Waiting banner shows until teacher confirms AND publishes', () => {
  expect(isWaitingForTeacherGrading('SUBMITTED_WAITING')).toBe(true);
  expect(isWaitingForTeacherGrading('AUTO_GRADED_PENDING_REVIEW')).toBe(true);
  expect(isWaitingForTeacherGrading('GRADED')).toBe(true);
  expect(isWaitingForTeacherGrading('RETURNED')).toBe(false);
  expect(isWaitingForTeacherGrading('IN_PROGRESS')).toBe(false);
});

test('formatUpdatedGradeBadge formats updated timestamp to dd/mm/yyyy', () => {
  expect(formatUpdatedGradeBadge(null)).toBeNull();
  expect(formatUpdatedGradeBadge(undefined)).toBeNull();
  expect(formatUpdatedGradeBadge('2026-11-15T10:00:00.000Z')).toBe(
    'Đã cập nhật 15/11/2026',
  );
});
