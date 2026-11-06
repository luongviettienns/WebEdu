import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, ForbiddenException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  it('formats HttpException into standard RFC 7807 response', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock } as unknown as Response;
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

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access Denied',
        path: '/api/v1/test',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats unexpected Error into 500 Internal Server Error', () => {
    const filter = new AllExceptionsFilter();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock } as unknown as Response;
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

    const exception = new Error('Unexpected crash');
    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal Server Error',
        path: '/api/v1/crash',
        timestamp: expect.any(String),
      }),
    );
  });
});
