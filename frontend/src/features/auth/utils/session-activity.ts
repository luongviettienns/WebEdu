export function activityStorageKey(userId: string): string {
  return `webedu_last_activity_${userId}`;
}

export function readSessionActivity(userId: string, now: number): number {
  try {
    const time = Number(window.localStorage.getItem(activityStorageKey(userId)));
    return time > 0 && time <= now ? time : 0;
  } catch {
    return 0;
  }
}

export function recordSessionActivity(userId: string, time = Date.now()): void {
  try {
    window.localStorage.setItem(activityStorageKey(userId), String(time));
  } catch {
    // shortcut: bộ đếm chỉ áp dụng từng tab nếu trình duyệt chặn Storage, dùng kênh đồng bộ riêng nếu cần hỗ trợ chế độ này.
  }
}
