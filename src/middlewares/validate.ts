import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodIssue, ZodSchema } from 'zod';
import { HttpError } from '../utils/httpError';

function formatIssues(issues: ZodIssue[]): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new HttpError(400, 'Validation failed', { field: 'body', reason: 'invalid_payload', issues: formatIssues(result.error.issues) }, 'VALIDATION_ERROR'));
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateParams<T extends Record<string, string>>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(new HttpError(400, 'Validation failed', { field: 'params', reason: 'invalid_payload', issues: formatIssues(result.error.issues) }, 'VALIDATION_ERROR'));
      return;
    }

    req.params = result.data;
    next();
  };
}

export function validateQuery<T extends Record<string, unknown>>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(new HttpError(400, 'Validation failed', { field: 'query', reason: 'invalid_payload', issues: formatIssues(result.error.issues) }, 'VALIDATION_ERROR'));
      return;
    }

    req.query = result.data as Request['query'];
    next();
  };
}
