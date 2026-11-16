import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import { AttendancePolicy } from '../../attendance/policies/attendance.policy.js';
import { ClassAccessService } from '../../classes/services/class-access.service.js';
import { sumQuestionMaxScore } from '../../grading/policies/answer-normalizer.policy.js';
import {
  findNextScheduledFromList,
  groupByKey,
  selectPrimaryEnrollment,
  toGradingFormulaDto,
} from '../mappers/progress.mapper.js';
import {
  computeSessionProgressStats,
  computeStudentAcademicSummary,
  isAssignmentEligibleForAnyEnrollment,
  isStudentAtRisk,
} from '../policies/grade-calculation.policy.js';
import type {
  AcademicAssignmentInput,
  ClassProgressReportDto,
  ClassProgressStudentRowDto,
} from '../progress.types.js';

@Injectable()
export class ClassProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classAccessService: ClassAccessService,
    private readonly attendancePolicy: AttendancePolicy,
  ) {}

  async getClassProgress(
    actor: AuthenticatedUser,
    classId: string,
  ): Promise<ClassProgressReportDto> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        status: true,
        teacherId: true,
        totalSessions: true,
        expectedEndDate: true,
        course: {
          select: {
            name: true,
            miniTestWeight: true,
            midtermWeight: true,
            finalWeight: true,
            passingScore: true,
          },
        },
        teacher: { select: { fullName: true } },
      },
    });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    this.classAccessService.resolveClassDetailAccess(actor, cls);

    const [enrollments, sessions, attendanceRecords, assignments, submissions] =
      await Promise.all([
        this.prisma.enrollment.findMany({
          where: { classId },
          include: {
            student: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: [{ status: 'asc' }, { enrolledDate: 'desc' }],
        }),
        this.prisma.lessonSession.findMany({
          where: { classId },
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
          where: { classId },
          select: { sessionId: true, studentId: true, status: true },
        }),
        this.prisma.classAssignment.findMany({
          where: { classId },
          include: {
            assessment: {
              select: {
                type: true,
                questions: { select: { points: true } },
              },
            },
          },
        }),
        this.prisma.submission.findMany({
          where: {
            classAssignment: { classId },
            status: { not: SubmissionStatus.SUPERSEDED },
          },
          select: {
            classAssignmentId: true,
            studentId: true,
            status: true,
            totalScore: true,
            submittedAt: true,
          },
        }),
      ]);

    const completedSessionsCount = sessions.filter(
      (session) => session.status === SessionStatus.COMPLETED,
    ).length;
    const sessionProgress = computeSessionProgressStats(
      cls.totalSessions,
      completedSessionsCount,
    );
    const gradingFormula = toGradingFormulaDto(cls.course);

    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const enrollmentsByStudent = groupByKey(enrollments, (row) => row.studentId);
    const attendanceByStudent = groupByKey(attendanceRecords, (row) => row.studentId);
    const submissionsByStudentAssignment = groupByKey(
      submissions,
      (sub) => `${sub.studentId}:${sub.classAssignmentId}`,
    );

    const assignmentMeta = assignments.map((assignment) => ({
      id: assignment.id,
      type: assignment.assessment.type,
      assignedAt: assignment.assignedAt,
      dueAt: assignment.dueAt,
      maxScore: sumQuestionMaxScore(assignment.assessment.questions),
    }));

    const students: ClassProgressStudentRowDto[] = [];
    for (const studentRows of enrollmentsByStudent.values()) {
      const primary = selectPrimaryEnrollment(studentRows);
      const studentRecords = (attendanceByStudent.get(primary.studentId) ?? []).filter(
        (rec) => {
          const session = sessionById.get(rec.sessionId);
          if (!session || session.status !== SessionStatus.COMPLETED) return false;
          return studentRows.some((enr) =>
            this.attendancePolicy.isStudentEligibleForSessionDate(enr, session.sessionDate),
          );
        },
      );
      const attendanceMetrics = this.attendancePolicy.computeStudentMetrics(
        studentRecords,
        cls.totalSessions,
      );

      const academicInputs: AcademicAssignmentInput[] = assignmentMeta.map((assignment) => {
        const subs =
          submissionsByStudentAssignment.get(`${primary.studentId}:${assignment.id}`) ?? [];
        const hasSubmission = subs.some((sub) => sub.status !== SubmissionStatus.SUPERSEDED);
        return {
          id: assignment.id,
          type: assignment.type,
          maxScore: assignment.maxScore,
          isEligible: isAssignmentEligibleForAnyEnrollment(
            assignment,
            studentRows,
            hasSubmission,
          ),
          submissions: subs,
        };
      });

      const academicSummary = computeStudentAcademicSummary({
        formula: gradingFormula,
        assignments: academicInputs,
      });

      students.push({
        studentId: primary.studentId,
        fullName: primary.student.fullName,
        email: primary.student.email,
        enrollmentStatus: primary.status,
        presentCount: attendanceMetrics.presentCount,
        absencesCount: attendanceMetrics.totalAbsenceCount,
        markedSessionsCount: attendanceMetrics.markedSessionsCount,
        attendanceRatePercent: attendanceMetrics.attendanceRatePercent,
        isAt30PercentWarning: attendanceMetrics.isAt30PercentWarning,
        homeworkSubmittedCount: academicSummary.homeworkStats.submittedCount,
        homeworkGivenCount: academicSummary.homeworkStats.givenCount,
        homeworkSubmissionRatePercent: academicSummary.homeworkStats.submissionRatePercent,
        homeworkAverageScore10: academicSummary.homeworkStats.averageScore10,
        miniTestAvg: academicSummary.miniTestAvg,
        midtermAvg: academicSummary.midtermAvg,
        finalAvg: academicSummary.finalAvg,
        finalScore: academicSummary.finalScore,
        passStatus: academicSummary.passStatus,
        isAtRisk: isStudentAtRisk({
          isAt30PercentWarning: attendanceMetrics.isAt30PercentWarning,
          homeworkGivenCount: academicSummary.homeworkStats.givenCount,
          homeworkSubmissionRatePercent: academicSummary.homeworkStats.submissionRatePercent,
        }),
      });
    }

    students.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    return {
      classSummary: {
        classId: cls.id,
        classCode: cls.code,
        courseName: cls.course.name,
        teacherName: cls.teacher.fullName,
        status: cls.status,
        completedSessionsCount,
        totalSessions: cls.totalSessions,
        remainingSessionsCount: sessionProgress.remainingSessionsCount,
        progressPercent: sessionProgress.progressPercent,
        expectedEndDate: cls.expectedEndDate ? formatIsoDateUtc(cls.expectedEndDate) : null,
        nextSession: findNextScheduledFromList(sessions),
      },
      gradingFormula,
      students,
    };
  }
}
