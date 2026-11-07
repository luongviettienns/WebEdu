import type { TestingModule } from '@nestjs/testing';
import { StudentAccessService } from '../../src/modules/students/services/student-access.service.js';
import { StudentCrudService } from '../../src/modules/students/services/student-crud.service.js';
import { StudentEnrollmentService } from '../../src/modules/students/services/student-enrollment.service.js';
import { StudentQueryService } from '../../src/modules/students/services/student-query.service.js';

/**
 * Resolves the Students module providers from the real Nest container and
 * exposes one handle so integration scenarios can exercise the whole module
 * (query + crud + enrollment + access) the same way the controller does.
 */
export function resolveStudentServices(moduleRef: TestingModule) {
  const queries = moduleRef.get(StudentQueryService);
  const crud = moduleRef.get(StudentCrudService);
  const enrollment = moduleRef.get(StudentEnrollmentService);
  const access = moduleRef.get(StudentAccessService);

  return {
    getStudentById: queries.getStudentById.bind(queries),
    getStudentLearningRecords: queries.getStudentLearningRecords.bind(queries),
    getStudentClassHistory: queries.getStudentClassHistory.bind(queries),
    updateStudent: crud.updateStudent.bind(crud),
    assignInitialClass: enrollment.assignInitialClass.bind(enrollment),
    verifyClassLearningAccess: access.verifyClassLearningAccess.bind(access),
  };
}

export type StudentServicesHandle = ReturnType<typeof resolveStudentServices>;
