import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export const HTTP_ERROR_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export interface ProblemDetailsPayload {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  invalidParams?: string[];
}

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

export function resolvePrismaUniqueConstraintDetail(err: unknown): string {
  if (typeof err !== 'object' || err === null) {
    return 'Dữ liệu đã tồn tại trong hệ thống (vi phạm ràng buộc duy nhất)';
  }
  const meta = (err as { meta?: { target?: unknown }; message?: unknown }).meta;
  const target = meta?.target;
  let targetStr = '';
  if (Array.isArray(target)) {
    targetStr = target.map(String).join(' ');
  } else if (typeof target === 'string') {
    targetStr = target;
  } else if (typeof (err as { message?: unknown }).message === 'string') {
    targetStr = (err as { message: string }).message;
  }

  const lower = targetStr.toLowerCase();

  if (lower.includes('course') || (lower.includes('code') && !lower.includes('class'))) {
    return 'Mã khóa học đã tồn tại trong hệ thống';
  }
  if (lower.includes('class') && lower.includes('code')) {
    return 'Mã lớp học đã tồn tại trong hệ thống';
  }
  if (lower.includes('enrollment') || lower.includes('student_id')) {
    return 'Học viên hiện đã có một lớp học đang hoạt động';
  }
  if (lower.includes('email') || lower.includes('phone')) {
    return 'Dữ liệu email hoặc số điện thoại đã tồn tại trong hệ thống';
  }

  return 'Dữ liệu đã tồn tại trong hệ thống (vi phạm ràng buộc duy nhất)';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected internal error occurred';
    let invalidParams: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = HTTP_ERROR_TITLES[status] ?? 'Http Exception';
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.error === 'string') {
          title = resObj.error;
        }

        if (Array.isArray(resObj.message)) {
          detail = 'Request validation failed';
          invalidParams = resObj.message.map(String);
        } else if (typeof resObj.message === 'string') {
          detail = resObj.message;
        } else {
          detail = exception.message || title;
        }
      }
    } else if (isPrismaUniqueConstraintError(exception)) {
      status = HttpStatus.CONFLICT;
      title = HTTP_ERROR_TITLES[HttpStatus.CONFLICT] ?? 'Conflict';
      detail = resolvePrismaUniqueConstraintDetail(exception);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
    }

    const instance = request?.originalUrl || request?.url || '';

    const problemDetails: ProblemDetailsPayload = {
      type: 'about:blank',
      title,
      status,
      detail,
      instance,
      timestamp: new Date().toISOString(),
      ...(invalidParams ? { invalidParams } : {}),
    };

    response
      .setHeader('Content-Type', 'application/problem+json')
      .status(status)
      .json(problemDetails);
  }
}
