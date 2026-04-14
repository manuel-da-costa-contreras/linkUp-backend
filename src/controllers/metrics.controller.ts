import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';

const metricsService = new MetricsService();

export class MetricsController {
  static async summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await metricsService.summary();
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }
}
