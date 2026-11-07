/**
 * Tính tuổi chính xác theo giờ Việt Nam (Asia/Ho_Chi_Minh).
 * Xử lý chuẩn cả năm nhuận 29/02 và biên 00:00-06:59 GMT+7.
 */
export function calculateAgeInVnTimezone(
  dateOfBirthIso?: string | null,
  referenceInstant?: Date,
): number | null {
  const trimmed = (dateOfBirthIso ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  const parts = datePart ? datePart.split('-') : [];
  if (parts.length !== 3) {
    return null;
  }

  const dobYear = Number(parts[0]);
  const dobMonth = Number(parts[1]);
  const dobDay = Number(parts[2]);

  if (
    !Number.isInteger(dobYear) ||
    !Number.isInteger(dobMonth) ||
    !Number.isInteger(dobDay) ||
    dobYear < 1900 ||
    dobMonth < 1 ||
    dobMonth > 12 ||
    dobDay < 1 ||
    dobDay > 31
  ) {
    return null;
  }

  const refInstant = referenceInstant ?? new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const vnDateString = formatter.format(refInstant);
  const [refYearStr, refMonthStr, refDayStr] = vnDateString.split('-');
  const refYear = Number(refYearStr);
  const refMonth = Number(refMonthStr);
  const refDay = Number(refDayStr);

  let age = refYear - dobYear;
  if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
    age -= 1;
  }
  return age;
}

/**
 * Định dạng chuỗi ngày YYYY-MM-DD hoặc ISO sang dd/mm/yyyy
 */
export function formatDateDdMmYyyy(isoDateOrTimestamp?: string | null): string {
  if (!isoDateOrTimestamp) {
    return '—';
  }
  const trimmed = isoDateOrTimestamp.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const dateObj = new Date(trimmed);
  if (Number.isNaN(dateObj.getTime())) {
    return trimmed;
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Định dạng ISO timestamp sang dd/mm/yyyy HH:mm (hoặc dd/mm/yyyy HH:mm:ss)
 */
export function formatDateTimeVn(
  isoTimestamp?: string | null,
  includeSeconds = false,
): string {
  if (!isoTimestamp) {
    return '—';
  }
  const dateObj = new Date(isoTimestamp);
  if (Number.isNaN(dateObj.getTime())) {
    return isoTimestamp;
  }
  const datePart = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);

  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(dateObj);

  return `${datePart} ${timePart}`;
}
