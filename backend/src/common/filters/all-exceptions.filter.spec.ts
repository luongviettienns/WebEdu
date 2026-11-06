import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
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
});
