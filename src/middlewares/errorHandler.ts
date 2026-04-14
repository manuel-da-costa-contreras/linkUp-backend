import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';
import { HttpError } from '../utils/httpError';

export function notFound(_req: Request, res: Response): void {
  sendError(res, 'Route not found', 404, undefined, 'ROUTE_NOT_FOUND');
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    sendError(res, error.message, error.statusCode, error.details, error.code);
    return;
  }

  if (error instanceof Error) {
    sendError(res, error.message, 500, undefined, 'INTERNAL_ERROR');
    return;
  }

  sendError(res, 'Internal server error', 500, undefined, 'INTERNAL_ERROR');
}
