import { requestJson } from '@/lib/api-client';
import type {
  DropStudentClassPayload,
  EnrollStudentsPayload,
  TransferStudentClassPayload,
} from '@/features/classes/api/classes.types';

export async function enrollStudentsToClass(
  classId: string,
  payload: EnrollStudentsPayload,
): Promise<{ enrolledCount: number; classId: string }> {
  return requestJson<{ enrolledCount: number; classId: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function transferStudentClass(
  classId: string,
  studentId: string,
  payload: TransferStudentClassPayload,
): Promise<{ status: string; targetClassId: string }> {
  return requestJson<{ status: string; targetClassId: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(studentId)}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function dropStudentFromClass(
  classId: string,
  studentId: string,
  payload: DropStudentClassPayload,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(studentId)}/drop`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
