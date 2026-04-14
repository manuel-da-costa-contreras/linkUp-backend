import { NextFunction, Request, Response } from 'express';
import { OrdersService } from '../services/orders.service';
import { sendSuccess } from '../utils/apiResponse';

const ordersService = new OrdersService();

export class OrdersController {
  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await ordersService.list();
      sendSuccess(res, orders);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.getById(req.params.id);
      sendSuccess(res, order);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.create(req.body);
      sendSuccess(res, order, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.update(req.params.id, req.body);
      sendSuccess(res, order);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await ordersService.remove(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}
