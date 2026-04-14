import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';

const metricsService = new MetricsService();

export class OrganizationsController {
  static async dashboardOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await metricsService.summary(req.params.orgId);
      res.status(200).json(overview);
    } catch (error) {
      next(error);
    }
  }
}
