import type { AssessmentType } from '@/features/assessments/api/assessments.api';

export interface AssessmentTypePreset {
  defaultDurationMinutes: number | null;
  durationLabel: string;
  sectionHint: string;
}

export const ASSESSMENT_TYPE_PRESETS: Record<AssessmentType, AssessmentTypePreset> = {
  HOMEWORK: {
    defaultDurationMinutes: null,
    durationLabel: 'Không giới hạn (BTVN)',
    sectionHint:
      'Gợi ý: 5–15 câu ôn tập kiến thức buổi học (Trắc nghiệm, Điền khuyết, Sắp xếp câu hoặc Tự luận ngắn).',
  },
  MINI_TEST: {
    defaultDurationMinutes: 15,
    durationLabel: '15 phút',
    sectionHint:
      'Gợi ý: Đề kiểm tra ngắn 10–15 câu đánh giá nhanh từ vựng và ngữ pháp trọng tâm.',
  },
  MIDTERM: {
    defaultDurationMinutes: 45,
    durationLabel: '45 phút',
    sectionHint:
      'Gợi ý: Cấu trúc 2–3 phần gồm Nghe hiểu (Audio), Đọc hiểu / Điền khuyết và Sắp xếp câu hoặc Viết ngắn.',
  },
  FINAL: {
    defaultDurationMinutes: 60,
    durationLabel: '60 phút',
    sectionHint:
      'Gợi ý: Đề tổng kết chuẩn HSK gồm Nghe hiểu, Đọc hiểu tổng hợp và Phần viết / Tự luận.',
  },
};

export function formatPresetDurationInput(type: AssessmentType): string {
  const minutes = ASSESSMENT_TYPE_PRESETS[type].defaultDurationMinutes;
  return minutes === null ? '' : String(minutes);
}
