import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';
import { HttpError } from '../utils/httpError';

const authService = new AuthService();

export class AuthController {
  static async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, { module: 'auth', status: 'ok' });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async sseToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.uid) {
        throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
      }

      const result = await authService.issueSseToken({
        uid: req.auth.uid,
        orgId: req.body.orgId,
        claimOrgId: req.auth.orgId,
        claimRole: req.auth.role,
      });

      sendSuccess(res, {
        tokenType: 'sse',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
