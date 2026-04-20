import { firestore } from '../config/firebase';
import {
  DashboardOverviewDTO,
  FirestoreTimestampDTO,
  JobsTrendPointDTO,
  SatisfactionBreakdownDTO,
} from '../models/metric.model';

type AnyDoc = FirebaseFirestore.DocumentData & { id?: string };

const PENDING_STATUSES = ['PENDING'];
const OPEN_JOB_STATUSES = ['PENDING', 'IN_PROGRESS'];
const COMPLETED_JOB_STATUS = 'COMPLETED';

export class MetricsRepository {
  private readonly clientsCollection = firestore.collection('clients');
  private readonly jobsCollection = firestore.collection('jobs');

  async summary(orgId?: string): Promise<DashboardOverviewDTO> {
    const now = new Date();
    const [clients, jobs] = await Promise.all([this.getDocsByOrg(this.clientsCollection, orgId), this.getDocsByOrg(this.jobsCollection, orgId)]);

    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const activeUsersCurrent = clients.length;
    const activeUsersPrevious = clients.reduce((count, client) => {
      const createdAt = this.extractEventDate(client);
      if (!createdAt) {
        return count;
      }

      return createdAt < currentMonthStart ? count + 1 : count;
    }, 0);

    const openAlertsCurrent = jobs.filter((job) => PENDING_STATUSES.includes(this.extractStatus(job))).length;
    const openAlertsPrevious = jobs.reduce((count, job) => {
      const updatedAt = this.extractEventDate(job);
      if (!updatedAt || !this.isSameUtcDay(updatedAt, this.addDaysUTC(now, -1))) {
        return count;
      }

      return PENDING_STATUSES.includes(this.extractStatus(job)) ? count + 1 : count;
    }, 0);

    const { start: weekStart, end: weekEnd } = this.getWeekRangeUTC(now);
    const previousWeekStart = this.addDaysUTC(weekStart, -7);

    const completedTasksCurrent = this.countCompletedInRange(jobs, weekStart, weekEnd);
    const completedTasksPrevious = this.countCompletedInRange(jobs, previousWeekStart, weekStart);

    const currentQuarterRange = this.getQuarterRangeUTC(now);
    const previousQuarterDate = this.addMonthsUTC(currentQuarterRange.start, -3);
    const previousQuarterRange = this.getQuarterRangeUTC(previousQuarterDate);

    const satisfactionBreakdown = this.computeSatisfactionBreakdown(
      jobs,
      currentQuarterRange.start,
      currentQuarterRange.end,
    );
    const previousSatisfactionBreakdown = this.computeSatisfactionBreakdown(
      jobs,
      previousQuarterRange.start,
      previousQuarterRange.end,
    );

    const currentSatisfactionValue = this.toSatisfactionValue(satisfactionBreakdown);
    const previousSatisfactionValue = this.toSatisfactionValue(previousSatisfactionBreakdown);

    return {
      metrics: {
        activeUsers: {
          value: activeUsersCurrent,
          delta: this.computeDelta(activeUsersCurrent, activeUsersPrevious),
          periodLabel: 'este mes',
        },
        openAlerts: {
          value: openAlertsCurrent,
          delta: this.computeDelta(openAlertsCurrent, openAlertsPrevious),
          periodLabel: 'vs ayer',
        },
        completedTasks: {
          value: completedTasksCurrent,
          delta: this.computeDelta(completedTasksCurrent, completedTasksPrevious),
          periodLabel: 'semana actual',
        },
        satisfaction: {
          value: currentSatisfactionValue,
          delta: this.computeDelta(currentSatisfactionValue, previousSatisfactionValue),
          periodLabel: 'trimestre',
        },
      },
      jobsTrend: this.buildJobsTrend(jobs, now),
      satisfactionBreakdown,
      updatedAt: this.getNowTimestampDTO(),
    };
  }

  private async getDocsByOrg(
    collection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
    orgId?: string,
  ): Promise<AnyDoc[]> {
    if (!orgId) {
      const snapshot = await collection.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    const [orgIdDocs, organizationIdDocs] = await Promise.all([
      collection.where('orgId', '==', orgId).get(),
      collection.where('organizationId', '==', orgId).get(),
    ]);

    const docsById = new Map<string, AnyDoc>();
    orgIdDocs.docs.forEach((doc) => docsById.set(doc.id, { id: doc.id, ...doc.data() }));
    organizationIdDocs.docs.forEach((doc) => docsById.set(doc.id, { id: doc.id, ...doc.data() }));
    return [...docsById.values()];
  }

  private countCompletedInRange(docs: AnyDoc[], start: Date, end: Date): number {
    return docs.reduce((count, doc) => {
      const status = this.extractStatus(doc);
      if (status !== COMPLETED_JOB_STATUS) {
        return count;
      }

      const date = this.extractEventDate(doc);
      if (!date || date < start || date >= end) {
        return count;
      }

      return count + 1;
    }, 0);
  }

  private buildJobsTrend(docs: AnyDoc[], now: Date): JobsTrendPointDTO[] {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      days.push(this.addDaysUTC(now, -i));
    }

    return days.map((day) => ({
      label: this.getWeekLabel(day),
      open: this.countByDayAndStatuses(docs, day, OPEN_JOB_STATUSES),
      completed: this.countByDayAndStatuses(docs, day, [COMPLETED_JOB_STATUS]),
    }));
  }

  private countByDayAndStatuses(docs: AnyDoc[], day: Date, statuses: string[]): number {
    return docs.reduce((count, doc) => {
      const date = this.extractEventDate(doc);
      if (!date || !this.isSameUtcDay(date, day)) {
        return count;
      }

      const status = this.extractStatus(doc);
      if (!statuses.includes(status)) {
        return count;
      }

      return count + 1;
    }, 0);
  }

  private computeSatisfactionBreakdown(docs: AnyDoc[], start: Date, end: Date): SatisfactionBreakdownDTO {
    return docs.reduce<SatisfactionBreakdownDTO>(
      (acc, doc) => {
        if (this.extractStatus(doc) !== COMPLETED_JOB_STATUS) {
          return acc;
        }

        const date = this.extractEventDate(doc);
        if (!date || date < start || date >= end) {
          return acc;
        }

        const rating = this.extractRating(doc);
        if (rating === null) {
          return acc;
        }

        if (rating >= 4 && rating <= 5) {
          acc.positive += 1;
          return acc;
        }

        if (rating >= 2 && rating <= 3) {
          acc.neutral += 1;
          return acc;
        }

        acc.negative += 1;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 },
    );
  }

  private toSatisfactionValue(breakdown: SatisfactionBreakdownDTO): number {
    const total = breakdown.positive + breakdown.neutral + breakdown.negative;
    if (total === 0) {
      return 0;
    }

    const value = (breakdown.positive / total) * 100;
    return Number(value.toFixed(2));
  }

  private computeDelta(current: number, previous: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    const delta = ((current - previous) / previous) * 100;
    return Number(delta.toFixed(2));
  }

  private extractStatus(doc: AnyDoc): string {
    return String(doc.status ?? doc.state ?? '').toUpperCase();
  }

  private extractRating(doc: AnyDoc): number | null {
    const rating = doc.rating ?? doc.score;
    if (typeof rating !== 'number' || Number.isNaN(rating)) {
      return null;
    }

    return Math.round(rating);
  }

  private extractEventDate(doc: AnyDoc): Date | null {
    const candidate = doc.updatedAt ?? doc.createdAt ?? doc.timestamp ?? doc.date ?? null;
    return this.toDate(candidate);
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'object') {
      const timestamp = value as {
        toDate?: () => Date;
        _seconds?: number;
        _nanoseconds?: number;
        seconds?: number;
        nanoseconds?: number;
      };

      if (typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const seconds = timestamp._seconds ?? timestamp.seconds;
      const nanoseconds = timestamp._nanoseconds ?? timestamp.nanoseconds ?? 0;
      if (typeof seconds === 'number') {
        return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
      }
    }

    return null;
  }

  private isSameUtcDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  private getWeekRangeUTC(date: Date): { start: Date; end: Date } {
    const day = date.getUTCDay();
    const isoDay = day === 0 ? 7 : day;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (isoDay - 1));

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  private getQuarterRangeUTC(date: Date): { start: Date; end: Date } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const quarterStartMonth = Math.floor(month / 3) * 3;

    const start = new Date(Date.UTC(year, quarterStartMonth, 1));
    const end = new Date(Date.UTC(year, quarterStartMonth + 3, 1));
    return { start, end };
  }

  private addDaysUTC(date: Date, days: number): Date {
    const clone = new Date(date);
    clone.setUTCDate(clone.getUTCDate() + days);
    return clone;
  }

  private addMonthsUTC(date: Date, months: number): Date {
    const clone = new Date(date);
    clone.setUTCMonth(clone.getUTCMonth() + months);
    return clone;
  }

  private getWeekLabel(date: Date): string {
    const labels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return labels[date.getUTCDay()];
  }

  private getNowTimestampDTO(): FirestoreTimestampDTO {
    const nowMs = Date.now();
    return {
      _seconds: Math.floor(nowMs / 1000),
      _nanoseconds: (nowMs % 1000) * 1_000_000,
    };
  }
}
