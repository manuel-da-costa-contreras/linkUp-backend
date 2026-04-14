import { NextFunction, Request, Response } from 'express';
import { UsersService } from '../services/users.service';
import { sendSuccess } from '../utils/apiResponse';

const usersService = new UsersService();

export class UsersController {
  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await usersService.list();
      sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getById(req.params.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.create(req.body);
      sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.update(req.params.id, req.body);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await usersService.remove(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}
