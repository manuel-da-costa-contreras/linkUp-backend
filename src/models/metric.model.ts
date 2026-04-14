export type MetricItemDTO = {
  value: number;
  delta: number;
  periodLabel: string;
};

export type JobsTrendPointDTO = {
  label: string;
  open: number;
  completed: number;
};

export type SatisfactionBreakdownDTO = {
  positive: number;
  neutral: number;
  negative: number;
};

export type FirestoreTimestampDTO = {
  _seconds: number;
  _nanoseconds: number;
};

export type DashboardOverviewDTO = {
  metrics: {
    activeUsers: MetricItemDTO;
    openAlerts: MetricItemDTO;
    completedTasks: MetricItemDTO;
    satisfaction: MetricItemDTO;
  };
  jobsTrend: JobsTrendPointDTO[];
  satisfactionBreakdown: SatisfactionBreakdownDTO;
  updatedAt: FirestoreTimestampDTO;
};
