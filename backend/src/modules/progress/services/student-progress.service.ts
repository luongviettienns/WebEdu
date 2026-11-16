import { ForbiddenException, Injectable } from '@nestjs/common';
import { EnrollmentStatus, SessionStatus, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import { AttendancePolicy } from '../../attendance/policies/attendance.policy.js';
import { getCompletedSessionsCountMap } from '../../classes/policies/class-session-lifecycle.util.js';
import { sumQuestionMaxScore } from '../../grading/policies/answer-normalizer.policy.js';
import type { GetStudentProgressQueryDto } from '../dto/progress.dto.js';
import {
  findNextScheduledFromList,
  groupByKey,
  selectPrimaryEnrollment,
  sortPublishedResultsNewestFirst,
  toGradingFormulaDto,
  toPublishedResultItemDto,
} from '../mappers/progress.mapper.js';
import {
  computeSessionProgressStats,
  computeStudentAcademicSummary,
  isAssignmentEligibleForAnyEnrollment,
} from '../policies/grade-calculation.policy.js';
import type {
  AcademicAssignmentInput,
  PublishedResultItemDto,
  StudentProgressResponseDto,
} from '../progress.types.js';

@Injectable()
export class StudentProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicy: AttendancePolicy,
  ) {}

  async getMyProgress(
    actor: AuthenticatedUser,
    query: GetStudentProgressQueryDto = {},
  ): Promise<StudentProgressResponseDto> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: actor.id },
      orderBy: [{ status: 'asc' }, { enrolledDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        class: {
          select: {
            id: true,
            code: true,
            status: true,
            totalSessions: true,
            expectedEndDate: true,
            course: {
              select: {
                name: true,
                level: true,
                miniTestWeight: true,
                midtermWeight: true,
                finalWeight: true,
                passingScore: true,
              },
            },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });

    const byClass = groupByKey(enrollments, (row) => row.classId);
    const uniqueEnrollments = Array.from(byClass.values())
      .map(selectPrimaryEnrollment)
      .sort((a, b) => {
        const aActive = a.status === EnrollmentStatus.ACTIVE ? 0 : 1;
        const bActive = b.status === EnrollmentStatus.ACTIVE ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return b.enrolledDate.getTime() - a.enrolledDate.getTime();
      });

    const selected = query.classId
      ? uniqueEnrollments.find((row) => row.classId === query.classId)
      : uniqueEnrollments[0];

    if (query.classId && !selected) {
      throw new ForbiddenException('Bạn không có quyền xem tiến độ của lớp học này');
    }

    if (!selected) {
      return {
        selectedClass: null,
        gradingFormula: null,
        attendance: null,
        academicSummary: null,
        publishedResults: [],
        classHistory: [],
      };
    }

    const allClassIds = uniqueEnrollments.map((row) => row.classId);
    const [completedCountMap, sessions, attendanceRecords, assignments, submissions] =
      await Promise.all([
        getCompletedSessionsCountMap(this.prisma, allClassIds),
        this.prisma.lessonSession.findMany({
          where: { classId: selected.classId },
          orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            sessionNumber: true,
            sessionDate: true,
            startTime: true,
            endTime: true,
            status: true,
            isMakeup: true,
          },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { classId: selected.classId, studentId: actor.id },
          select: { sessionId: true, status: true },
        }),
        this.prisma.classAssignment.findMany({
          where: { classId: selected.classId },
          orderBy: [{ dueAt: 'asc' }, { assignedAt: 'desc' }],
          include: {
            assessment: {
              select: {
                title: true,
                type: true,
                questions: { select: { points: true } },
              },
            },
          },
        }),
        this.prisma.submission.findMany({
          where: {
            studentId: actor.id,
            classAssignment: { classId: selected.classId },
            status: { not: SubmissionStatus.SUPERSEDED },
          },
          select: {
            id: true,
            classAssignmentId: true,
            status: true,
            totalScore: true,
            submittedAt: true,
            returnedAt: true,
            teacherFeedback: true,
          },
        }),
      ]);

    const classIntervals = byClass.get(selected.classId) ?? [selected];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const eligibleAttendance = attendanceRecords.filter((rec) => {
      const session = sessionById.get(rec.sessionId);
      if (!session || session.status !== SessionStatus.COMPLETED) return false;
      return classIntervals.some((enr) =>
        this.attendancePolicy.isStudentEligibleForSessionDate(enr, session.sessionDate),
      );
    });

    const selectedCompletedCount = sessions.filter(
      (session) => session.status === SessionStatus.COMPLETED,
    ).length;
    const selectedProgress = computeSessionProgressStats(
      selected.class.totalSessions,
      selectedCompletedCount,
    );

    const subsByAssignment = groupByKey(submissions, (sub) => sub.classAssignmentId);
    const gradingFormula = toGradingFormulaDto(selected.class.course);
    const publishedResults: PublishedResultItemDto[] = [];

    const academicInputs: AcademicAssignmentInput[] = assignments.map((assignment) => {
      const subs = subsByAssignment.get(assignment.id) ?? [];
      const maxScore = sumQuestionMaxScore(assignment.assessment.questions);
      const hasSubmission = subs.some((sub) => sub.status !== SubmissionStatus.SUPERSEDED);
      const isEligible = isAssignmentEligibleForAnyEnrollment(
        assignment,
        classIntervals,
        hasSubmission,
      );

      const returned = subs.find(
        (sub) => sub.status === SubmissionStatus.RETURNED && sub.totalScore !== null,
      );
      if (returned && returned.totalScore !== null) {
        publishedResults.push(
          toPublishedResultItemDto(
            assignment,
            { ...returned, totalScore: returned.totalScore },
            maxScore,
          ),
        );
      }

      return {
        id: assignment.id,
        type: assignment.assessment.type,
        maxScore,
        isEligible,
        submissions: subs,
      };
    });

    const classHistory = uniqueEnrollments.map((row) => {
      const completed =
        row.classId === selected.classId
          ? selectedCompletedCount
          : (completedCountMap.get(row.classId) ?? 0);
      const progress = computeSessionProgressStats(row.class.totalSessions, completed);
      return {
        classId: row.classId,
        classCode: row.class.code,
        courseName: row.class.course.name,
        teacherName: row.class.teacher.fullName,
        enrollmentStatus: row.status,
        classStatus: row.class.status,
        enrolledDate: formatIsoDateUtc(row.enrolledDate),
        leftDate: row.leftDate ? formatIsoDateUtc(row.leftDate) : null,
        expectedEndDate: row.class.expectedEndDate
          ? formatIsoDateUtc(row.class.expectedEndDate)
          : null,
        completedSessionsCount: completed,
        totalSessions: row.class.totalSessions,
        progressPercent: progress.progressPercent,
      };
    });

    return {
      selectedClass: {
        classId: selected.classId,
        classCode: selected.class.code,
        courseName: selected.class.course.name,
        courseLevel: selected.class.course.level,
        teacherName: selected.class.teacher.fullName,
        status: selected.class.status,
        enrollmentStatus: selected.status,
        enrolledDate: formatIsoDateUtc(selected.enrolledDate),
        leftDate: selected.leftDate ? formatIsoDateUtc(selected.leftDate) : null,
        expectedEndDate: selected.class.expectedEndDate
          ? formatIsoDateUtc(selected.class.expectedEndDate)
          : null,
        completedSessionsCount: selectedCompletedCount,
        totalSessions: selected.class.totalSessions,
        remainingSessionsCount: selectedProgress.remainingSessionsCount,
        progressPercent: selectedProgress.progressPercent,
        nextSession: findNextScheduledFromList(sessions),
      },
      gradingFormula,
      attendance: this.attendancePolicy.computeStudentMetrics(
        eligibleAttendance,
        selected.class.totalSessions,
      ),
      academicSummary: computeStudentAcademicSummary({
        formula: gradingFormula,
        assignments: academicInputs,
      }),
      publishedResults: sortPublishedResultsNewestFirst(publishedResults),
      classHistory,
    };
  }
}
