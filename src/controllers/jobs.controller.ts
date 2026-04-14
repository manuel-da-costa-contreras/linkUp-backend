import { NextFunction, Request, Response } from 'express';
import { JobsService } from '../services/jobs.service';
import { sendPaginated, sendSuccess } from '../utils/apiResponse';

const jobsService = new JobsService();

export class JobsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await jobsService.list(req.params.orgId, {
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

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobsService.create(req.params.orgId, req.body);
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobsService.update(req.params.orgId, req.params.jobId, req.body);
      res.status(200).json(job);
    } catch (error) {
      next(error);
    }
  }

  static async patchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobsService.updateStatus(req.params.orgId, req.params.jobId, req.body);
      sendSuccess(res, job, 200);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await jobsService.remove(req.params.orgId, req.params.jobId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
