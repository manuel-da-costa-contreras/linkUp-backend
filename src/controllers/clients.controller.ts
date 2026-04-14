import { NextFunction, Request, Response } from 'express';
import { ClientsService } from '../services/clients.service';
import { sendPaginated } from '../utils/apiResponse';

const clientsService = new ClientsService();

export class ClientsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clientsService.list(req.params.orgId, {
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined,
        sortDir: req.query.sortDir === 'asc' ? 'asc' : 'desc',
      });

      sendPaginated(res, result.data, result.pagination, 200);
    } catch (error) {
      next(error);
    }
  }

  static async listOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const clients = await clientsService.listOptions(req.params.orgId, search);
      res.status(200).json(clients);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await clientsService.create(req.params.orgId, req.body);
      res.status(201).json(client);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await clientsService.update(req.params.orgId, req.params.clientId, req.body);
      res.status(200).json(client);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clientsService.remove(req.params.orgId, req.params.clientId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
