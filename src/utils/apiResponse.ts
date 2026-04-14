import { Response } from 'express';
import { PaginationMeta } from '../models/pagination.model';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiPaginatedSuccess<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response<ApiSuccess<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200,
): Response<ApiPaginatedSuccess<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
  code?: string,
): Response<ApiError> {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: code ?? 'INTERNAL_ERROR',
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
