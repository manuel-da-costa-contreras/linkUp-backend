import { DashboardOverviewDTO } from '../models/metric.model';
import { MetricsRepository } from '../repositories/metrics.repository';

export class MetricsService {
  constructor(private readonly metricsRepository: MetricsRepository = new MetricsRepository()) {}

  async summary(orgId?: string): Promise<DashboardOverviewDTO> {
    return this.metricsRepository.summary(orgId);
  }
}
