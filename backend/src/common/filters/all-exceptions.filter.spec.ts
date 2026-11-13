import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter (RFC 7807 Problem Details)', () => {
  it('formats HttpException into standard RFC 7807 response with application/problem+json', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
    const responseMock = {
      setHeader: setHeaderMock,
      status: statusMock,
    } as unknown as Response;
    const requestMock = { url: '/api/v1/test' } as unknown as Request;

    const hostMock: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T>() => responseMock as unknown as T,
        getRequest: <T>() => requestMock as unknown as T,
        getNext: vi.fn(),
      }),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    };

    const exception = new ForbiddenException('Access Denied');
    filter.catch(exception, hostMock);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Access Denied',
        instance: '/api/v1/test',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats validation errors into RFC 7807 problem details with invalidParams extension', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
    const responseMock = {
      setHeader: setHeaderMock,
      status: statusMock,
    } as unknown as Response;
    const requestMock = { url: '/api/v1/users' } as unknown as Request;

    const hostMock: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T>() => responseMock as unknown as T,
        getRequest: <T>() => requestMock as unknown as T,
        getNext: vi.fn(),
      }),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    };

    const validationException = new BadRequestException({
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
    });
    filter.catch(validationException, hostMock);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Request validation failed',
        invalidParams: ['email must be an email', 'password is too short'],
        instance: '/api/v1/users',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats unexpected Error into 500 Internal Server Error without leaking internal stack', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
    const responseMock = {
      setHeader: setHeaderMock,
      status: statusMock,
    } as unknown as Response;
    const requestMock = { url: '/api/v1/crash' } as unknown as Request;

    const hostMock: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T>() => responseMock as unknown as T,
        getRequest: <T>() => requestMock as unknown as T,
        getNext: vi.fn(),
      }),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    };

    const exception = new Error('Database connection pool timeout');
    filter.catch(exception, hostMock);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected internal error occurred',
        instance: '/api/v1/crash',
        timestamp: expect.any(String),
      }),
    );
  });

  it('maps Prisma P2002 unique constraint error to 409 Conflict ProblemDetails (P1-4)', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
    const responseMock = {
      setHeader: setHeaderMock,
      status: statusMock,
    } as unknown as Response;
    const requestMock = { url: '/api/v1/users/dup' } as unknown as Request;

    const hostMock: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T>() => responseMock as unknown as T,
        getRequest: <T>() => requestMock as unknown as T,
        getNext: vi.fn(),
      }),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    };

    const prismaDupError = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
      code: 'P2002',
    });
    filter.catch(prismaDupError, hostMock);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Dữ liệu email hoặc số điện thoại đã tồn tại trong hệ thống',
        instance: '/api/v1/users/dup',
        timestamp: expect.any(String),
      }),
    );
  });

  it('maps distinct Prisma P2002 targets to accurate RFC 7807 Conflict messages (FIX-09)', () => {
    const filter = new AllExceptionsFilter();

    const makeHost = (url: string) => {
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
      const responseMock = { setHeader: setHeaderMock, status: statusMock } as unknown as Response;
      const requestMock = { url } as unknown as Request;
      const host: ArgumentsHost = {
        switchToHttp: () => ({
          getResponse: <T>() => responseMock as unknown as T,
          getRequest: <T>() => requestMock as unknown as T,
          getNext: vi.fn(),
        }),
        getArgs: vi.fn(),
        getArgByIndex: vi.fn(),
        switchToRpc: vi.fn(),
        switchToWs: vi.fn(),
        getType: vi.fn(),
      };
      return { host, jsonMock, statusMock };
    };

    // Course code conflict
    const courseHost = makeHost('/api/v1/courses');
    const courseErr = Object.assign(new Error('Unique constraint failed on the fields: (`code`)'), {
      code: 'P2002',
      meta: { target: ['code'], modelName: 'Course' },
    });
    filter.catch(courseErr, courseHost.host);
    expect(courseHost.statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(courseHost.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Mã khóa học đã tồn tại trong hệ thống',
      }),
    );

    // Class code conflict
    const classHost = makeHost('/api/v1/classes');
    const classErr = Object.assign(new Error('Unique constraint failed on the constraint: (`classes_code_key`)'), {
      code: 'P2002',
      meta: { target: 'classes_code_key' },
    });
    filter.catch(classErr, classHost.host);
    expect(classHost.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Mã lớp học đã tồn tại trong hệ thống',
      }),
    );

    // Active enrollment index conflict
    const enrollmentHost = makeHost('/api/v1/students/s-1/initial-class');
    const enrollmentErr = Object.assign(new Error('Unique constraint failed on the constraint: (`idx_unique_student_active_enrollment`)'), {
      code: 'P2002',
      meta: { target: 'idx_unique_student_active_enrollment' },
    });
    filter.catch(enrollmentErr, enrollmentHost.host);
    expect(enrollmentHost.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Học viên hiện đã có một lớp học đang hoạt động',
      }),
    );

    // Generic fallback
    const genericHost = makeHost('/api/v1/generic');
    const genericErr = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['some_custom_unique_col'] },
    });
    filter.catch(genericErr, genericHost.host);
    expect(genericHost.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Dữ liệu đã tồn tại trong hệ thống (vi phạm ràng buộc duy nhất)',
      }),
    );
  });

  describe('Request Correlation ID (TD-07)', () => {
    const UUID_V4_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const createRequestHost = (headers?: Record<string, string | string[] | undefined>) => {
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const setHeaderMock = vi.fn().mockReturnValue({ status: statusMock });
      const responseMock = {
        setHeader: setHeaderMock,
        status: statusMock,
      } as unknown as Response;
      const requestMock = {
        url: '/api/v1/corr-test',
        headers: headers ?? {},
      } as unknown as Request;
      const host: ArgumentsHost = {
        switchToHttp: () => ({
          getResponse: <T>() => responseMock as unknown as T,
          getRequest: <T>() => requestMock as unknown as T,
          getNext: vi.fn(),
        }),
        getArgs: vi.fn(),
        getArgByIndex: vi.fn(),
        switchToRpc: vi.fn(),
        switchToWs: vi.fn(),
        getType: vi.fn(),
      };
      return { host, setHeaderMock, statusMock, jsonMock };
    };

    it('preserves valid x-request-id (string or string[]) in X-Request-Id header and body requestId', () => {
      const filter = new AllExceptionsFilter();
      const validId = 'req-abc12345';
      const { host, setHeaderMock, jsonMock } = createRequestHost({
        'x-request-id': validId,
      });

      filter.catch(new ForbiddenException('Access Denied'), host);

      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', validId);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          requestId: validId,
        }),
      );

      const arrayReq = createRequestHost({ 'x-request-id': ['req_arr_987654'] });
      filter.catch(new ForbiddenException('Access Denied'), arrayReq.host);

      expect(arrayReq.setHeaderMock).toHaveBeenCalledWith('X-Request-Id', 'req_arr_987654');
      expect(arrayReq.jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req_arr_987654',
        }),
      );
    });

    it('ignores unsafe or malformed x-request-id and generates a valid UUID instead', () => {
      const filter = new AllExceptionsFilter();
      const malformedValues: Array<string | string[] | undefined> = [
        'bad\r\nid',
        '123',
        '',
        ' req-abc12345 ',
        'a'.repeat(65),
        [],
        undefined,
      ];

      for (const badHeader of malformedValues) {
        const { host, setHeaderMock, jsonMock } = createRequestHost(
          badHeader === undefined ? {} : { 'x-request-id': badHeader },
        );

        filter.catch(new BadRequestException('Invalid input'), host);

        const requestIdHeaderCall = setHeaderMock.mock.calls.find(
          (args) => args[0] === 'X-Request-Id',
        );
        expect(requestIdHeaderCall).toBeDefined();
        const generatedId = String(requestIdHeaderCall?.[1] ?? '');
        expect(generatedId).toMatch(UUID_V4_REGEX);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            requestId: generatedId,
          }),
        );
      }
    });

    it('logs [requestId=...] in Logger.error on 500 errors without leaking internal exception message in JSON response', () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const filter = new AllExceptionsFilter();
      const { host, setHeaderMock, statusMock, jsonMock } = createRequestHost({
        'x-request-id': 'req-trace-999',
      });

      const dbErr = new Error('FATAL: password authentication failed for user postgres');
      filter.catch(dbErr, host);

      expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', 'req-trace-999');

      const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(body).toEqual(
        expect.objectContaining({
          status: 500,
          title: 'Internal Server Error',
          detail: 'An unexpected internal error occurred',
          requestId: 'req-trace-999',
        }),
      );
      expect(JSON.stringify(body)).not.toContain('postgres');
      expect(JSON.stringify(body)).not.toContain('password authentication');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = String(errorSpy.mock.calls[0]?.[0] ?? '');
      expect(loggedMessage).toContain('[requestId=req-trace-999]');
      expect(loggedMessage).toContain('req-trace-999');
      expect(loggedMessage).toContain('FATAL: password authentication failed');
    });
  });
});
