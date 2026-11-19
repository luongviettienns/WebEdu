import { expect, test } from '@playwright/test';
import {
  formatRelativeNotificationTime,
  formatUnreadBadgeLabel,
  resolveSafeNotificationHref,
} from './notification-time.util';

test('formatRelativeNotificationTime renders Vietnamese relative ranges and falls back to dd/MM/yyyy after 7 days', () => {
  const base = Date.parse('2026-11-20T10:00:00.000Z');
  expect(formatRelativeNotificationTime('2026-11-20T09:59:35.000Z', base)).toBe('Vừa xong');
  expect(formatRelativeNotificationTime('2026-11-20T09:45:00.000Z', base)).toBe('15 phút trước');
  expect(formatRelativeNotificationTime('2026-11-20T07:00:00.000Z', base)).toBe('3 giờ trước');
  expect(formatRelativeNotificationTime('2026-11-18T10:00:00.000Z', base)).toBe('2 ngày trước');
  expect(formatRelativeNotificationTime('2026-11-10T10:00:00.000Z', base)).toBe('10/11/2026');
});

test('formatUnreadBadgeLabel caps unread badge display at 99+', () => {
  expect(formatUnreadBadgeLabel(0)).toBe('');
  expect(formatUnreadBadgeLabel(12)).toBe('12');
  expect(formatUnreadBadgeLabel(99)).toBe('99');
  expect(formatUnreadBadgeLabel(120)).toBe('99+');
});

test('resolveSafeNotificationHref rejects open redirects and preserves safe internal paths', () => {
  expect(resolveSafeNotificationHref('/student/assignments/abc?mode=review')).toBe(
    '/student/assignments/abc?mode=review',
  );
  expect(resolveSafeNotificationHref('https://evil.example/phish')).toBe('/');
  expect(resolveSafeNotificationHref('//evil.example/phish')).toBe('/');
  expect(resolveSafeNotificationHref('/\\evil')).toBe('/');
});
