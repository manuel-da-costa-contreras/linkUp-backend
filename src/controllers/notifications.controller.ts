import { NextFunction, Request, Response } from 'express';
import { NotificationsService } from '../services/notifications.service';
import { notificationsStreamService } from '../services/notifications-stream.service';
import { sendPaginated } from '../utils/apiResponse';
import { HttpError } from '../utils/httpError';

const notificationsService = new NotificationsService();

export class NotificationsController {
  static async stream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.uid) {
        throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
      }

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.flushHeaders();
      res.write('retry: 5000\n\n');

      const unsubscribe = notificationsStreamService.subscribe(
        req.params.orgId,
        req.auth.uid,
        res,
        {
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          types: typeof req.query.types === 'string' ? req.query.types : undefined,
        },
        typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'] : undefined,
      );

      req.on('close', () => {
        unsubscribe();
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.uid) {
        throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
      }

      const result = await notificationsService.list(req.params.orgId, req.auth.uid, {
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 25),
        status: (typeof req.query.status === 'string' ? req.query.status : 'active') as 'active' | 'dismissed' | 'all',
        types: typeof req.query.types === 'string' ? req.query.types : undefined,
      });

      sendPaginated(res, result.data, result.pagination, 200);
    } catch (error) {
      next(error);
    }
  }

  static async dismiss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.uid) {
        throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
      }

      await notificationsService.dismiss(req.params.orgId, req.auth.uid, req.params.notificationId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async dismissAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.uid) {
        throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
      }

      await notificationsService.dismissAll(req.params.orgId, req.auth.uid);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
