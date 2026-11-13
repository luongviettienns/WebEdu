import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, Role } from '@prisma/client';
import {
  assertCanMutateAssessment,
  assertCanViewAssessment,
  assertEditableAssessment,
  listVisibilityWhere,
} from './assessment-access.policy.js';

const owner = { id: 'gv-1', roles: [Role.TEACHER] };
const other = { id: 'gv-2', roles: [Role.TEACHER] };
const admin = { id: 'ad-1', roles: [Role.ADMIN] };
const draft = {
  id: 'asm-1',
  createdById: 'gv-1',
  status: AssessmentStatus.DRAFT,
  isLocked: false,
};

describe('assessment-access.policy', () => {
  it('lets the owner and Admin mutate; other teachers are denied', () => {
    expect(() => assertCanMutateAssessment(owner, 'gv-1')).not.toThrow();
    expect(() => assertCanMutateAssessment(admin, 'gv-1')).not.toThrow();
    expect(() => assertCanMutateAssessment(other, 'gv-1')).toThrow(ForbiddenException);
  });

  it('blocks edits on a missing, published, or locked assessment', () => {
    expect(() => assertEditableAssessment(owner, null)).toThrow(NotFoundException);
    expect(() =>
      assertEditableAssessment(owner, { ...draft, status: AssessmentStatus.PUBLISHED }),
    ).toThrow(ConflictException);
    expect(() => assertEditableAssessment(owner, { ...draft, isLocked: true })).toThrow(ConflictException);
    expect(() => assertEditableAssessment(owner, draft)).not.toThrow();
  });

  it('hides another teacher\'s draft but allows published papers', () => {
    expect(() => assertCanViewAssessment(other, draft)).toThrow(NotFoundException);
    expect(() =>
      assertCanViewAssessment(other, { ...draft, status: AssessmentStatus.PUBLISHED }),
    ).not.toThrow();
    expect(() => assertCanViewAssessment(owner, draft)).not.toThrow();
    expect(() => assertCanViewAssessment(admin, draft)).not.toThrow();
    expect(listVisibilityWhere(owner)).toEqual({
      OR: [{ createdById: 'gv-1' }, { status: AssessmentStatus.PUBLISHED }],
    });
    expect(listVisibilityWhere(admin)).toEqual({});
  });
});
