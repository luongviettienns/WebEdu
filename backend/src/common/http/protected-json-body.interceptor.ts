import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import express, { type Request, type Response } from 'express';
import { defer, mergeMap } from 'rxjs';

// Allow the full accepted UTF-16 payload even when each unit requires six JSON bytes.
const parseAnswers = express.json({ limit: '64mb', inflate: false });
const parseAiBatch = express.json({ limit: '32mb', inflate: false });
const parseAiReview = express.json({ limit: '2mb', inflate: false });
const AUTOSAVE_PATH = /^\/api\/v1\/assignments\/[^/]+\/submissions\/autosave$/i;
const SUBMIT_PATH = /^\/api\/v1\/assignments\/[^/]+\/submissions\/submit$/i;
const AI_BATCH_PATH = /^\/api\/v1\/assignments\/[^/]+\/ai-grade$/i;
const AI_REVIEW_PATH = /^\/api\/v1\/submissions\/[^/]+\/ai-grade$/i;

export function protectedJsonParser(method: string, path: string) {
  const normalizedPath = path.replace(/\/+$/, '');
  if (method === 'PATCH' && AUTOSAVE_PATH.test(normalizedPath)) return parseAnswers;
  if (method !== 'POST') return undefined;
  if (SUBMIT_PATH.test(normalizedPath)) return parseAnswers;
  if (AI_BATCH_PATH.test(normalizedPath)) return parseAiBatch;
  if (AI_REVIEW_PATH.test(normalizedPath)) return parseAiReview;
}

@Injectable()
export class ProtectedJsonBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const parse = protectedJsonParser(request.method, request.path);
    if (!parse) return next.handle();
    return defer(() => new Promise<void>((resolve, reject) => {
      parse(request, http.getResponse<Response>(), (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    })).pipe(mergeMap(() => next.handle()));
  }
}
