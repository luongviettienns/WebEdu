import { BadRequestException } from '@nestjs/common';
import { AssessmentType, QuestionType, Role, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AssessmentsController } from './assessments.controller.js';

const teacher: AuthenticatedUser = {
  id: 'u-1',
  email: 'gv@webedu.vn',
  fullName: 'Giáo viên A',
  phone: '0901000001',
  roles: [Role.TEACHER],
  effectiveRole: Role.TEACHER,
  status: UserStatus.ACTIVE,
  tokenVersion: 1,
};

function makeController() {
  const assessments = {
    streamOriginal: vi.fn(async () => 'orig-stream'),
    listMedia: vi.fn(async () => [{ id: 'm-1' }]),
    uploadMedia: vi.fn(async () => ({ id: 'm-2' })),
    streamMedia: vi.fn(async () => 'media-stream'),
    create: vi.fn(async () => ({ id: 'a-1' })),
    list: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
    getDetail: vi.fn(async () => ({ id: 'a-1' })),
    update: vi.fn(async () => ({ id: 'a-1' })),
    remove: vi.fn(async () => undefined),
    duplicate: vi.fn(async () => ({ id: 'a-2' })),
    publish: vi.fn(async () => ({ id: 'a-1', status: 'PUBLISHED' })),
  };
  const questions = {
    add: vi.fn(async () => ({ id: 'q-1' })),
    reorder: vi.fn(async () => [{ id: 'q-1' }]),
    update: vi.fn(async () => ({ id: 'q-1' })),
    remove: vi.fn(async () => undefined),
  };
  const imports = {
    importFile: vi.fn(async () => ({ assessmentId: 'a-imp' })),
    getReview: vi.fn(async () => ({ id: 'a-1', needsReviewCount: 0 })),
  };
  return {
    ctrl: new AssessmentsController(assessments as never, questions as never, imports as never),
    assessments,
    questions,
    imports,
  };
}

describe('AssessmentsController unit coverage', () => {
  it('delegates CRUD, import, media and question endpoints and validates missing uploads', async () => {
    const { ctrl, assessments, questions, imports } = makeController();
    const importDto = { type: AssessmentType.HOMEWORK, courseId: 'c-1' };

    expect(() => ctrl.importDocument(teacher, undefined, importDto)).toThrow(BadRequestException);
    const latin1Name = Buffer.from('Đề HSK1.docx', 'utf8').toString('latin1');
    await expect(
      ctrl.importDocument(teacher, { originalname: latin1Name, buffer: Buffer.from('x') }, importDto),
    ).resolves.toEqual({ assessmentId: 'a-imp' });
    expect(imports.importFile).toHaveBeenCalledWith('u-1', 'Đề HSK1.docx', expect.any(Buffer), importDto);

    expect(() => ctrl.uploadMedia(teacher, 'a-1', undefined)).toThrow(BadRequestException);
    await ctrl.uploadMedia(teacher, 'a-1', { originalname: 'ảnh.png', buffer: Buffer.from('y') });
    expect(assessments.uploadMedia).toHaveBeenCalledWith('a-1', 'ảnh.png', expect.any(Buffer), teacher);

    await expect(ctrl.getReview(teacher, 'a-1')).resolves.toEqual({ id: 'a-1', needsReviewCount: 0 });
    await expect(ctrl.streamOriginal(teacher, 'a-1')).resolves.toBe('orig-stream');
    await expect(ctrl.listMedia(teacher, 'a-1')).resolves.toEqual([{ id: 'm-1' }]);
    await expect(ctrl.streamMedia(teacher, 'a-1', 'm-1')).resolves.toBe('media-stream');

    await ctrl.create(teacher, { title: 'Đề 1', type: AssessmentType.HOMEWORK, courseId: 'c-1' });
    await ctrl.list(teacher, {});
    await ctrl.getDetail(teacher, 'a-1');
    await ctrl.update(teacher, 'a-1', { title: 'Mới' });
    await expect(ctrl.remove(teacher, 'a-1')).resolves.toEqual({ success: true });
    await ctrl.duplicate(teacher, 'a-1');
    await ctrl.publish(teacher, 'a-1');

    await ctrl.addQuestion(teacher, 'a-1', { type: QuestionType.ESSAY, prompt: 'Viết', payload: {}, points: 1 });
    await ctrl.reorderQuestions(teacher, 'a-1', { questionIds: ['q-1'] });
    await ctrl.updateQuestion(teacher, 'a-1', 'q-1', { prompt: 'Mới' });
    await expect(ctrl.removeQuestion(teacher, 'a-1', 'q-1')).resolves.toEqual({ success: true });
    expect(questions.remove).toHaveBeenCalledWith('a-1', 'q-1', teacher);
  });
});
