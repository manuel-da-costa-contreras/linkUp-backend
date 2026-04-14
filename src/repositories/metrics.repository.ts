import { firestore } from '../config/firebase';
import {
  DashboardOverviewDTO,
  FirestoreTimestampDTO,
  JobsTrendPointDTO,
  SatisfactionBreakdownDTO,
} from '../models/metric.model';

const OPEN_STATUSES = ['open', 'pending'];
const COMPLETED_STATUSES = ['completed', 'paid', 'done'];

export class MetricsRepository {
  private readonly usersCollection = firestore.collection('users');
  private readonly alertsCollection = firestore.collection('alerts');
  private readonly tasksCollection = firestore.collection('tasks');
  private readonly jobsCollection = firestore.collection('jobs');
  private readonly ordersCollection = firestore.collection('orders');
  private readonly feedbackCollection = firestore.collection('feedback');

  async summary(orgId?: string): Promise<DashboardOverviewDTO> {
    const now = new Date();

    const [users, alerts, tasks, jobs, orders, feedback] = await Promise.all([
      this.getDocs(this.usersCollection, orgId),
      this.getDocs(this.alertsCollection, orgId),
      this.getDocs(this.tasksCollection, orgId),
      this.getDocs(this.jobsCollection, orgId),
      this.getDocs(this.ordersCollection, orgId),
      this.getDocs(this.feedbackCollection, orgId),
    ]);

    const jobsSource = jobs.length > 0 ? jobs : orders;
    const completedTasksSource = tasks.length > 0 ? tasks : orders;

    const activeUsersCurrent = this.countInMonth(users, now.getUTCFullYear(), now.getUTCMonth());
    const previousMonthDate = this.addMonthsUTC(now, -1);
    const activeUsersPrevious = this.countInMonth(
      users,
      previousMonthDate.getUTCFullYear(),
      previousMonthDate.getUTCMonth(),
    );

    const openAlertsCurrent = this.countInUtcDay(alerts, now, OPEN_STATUSES);
    const yesterday = this.addDaysUTC(now, -1);
    const openAlertsPrevious = this.countInUtcDay(alerts, yesterday, OPEN_STATUSES);

    const { start: weekStart, end: weekEnd } = this.getWeekRangeUTC(now);
    const previousWeekStart = this.addDaysUTC(weekStart, -7);

    const completedTasksCurrent = this.countInRange(
      completedTasksSource,
      weekStart,
      weekEnd,
      COMPLETED_STATUSES,
    );
    const completedTasksPrevious = this.countInRange(
      completedTasksSource,
      previousWeekStart,
      weekStart,
      COMPLETED_STATUSES,
    );

    const currentQuarterRange = this.getQuarterRangeUTC(now);
    const previousQuarterDate = this.addMonthsUTC(currentQuarterRange.start, -3);
    const previousQuarterRange = this.getQuarterRangeUTC(previousQuarterDate);

    const satisfactionBreakdown = this.computeSatisfactionBreakdown(
      feedback,
      currentQuarterRange.start,
      currentQuarterRange.end,
    );
    const previousSatisfactionBreakdown = this.computeSatisfactionBreakdown(
      feedback,
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
      jobsTrend: this.buildJobsTrend(jobsSource, now),
      satisfactionBreakdown,
      updatedAt: this.getNowTimestampDTO(),
    };
  }

  private async getDocs(
    collection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
    orgId?: string,
  ): Promise<FirebaseFirestore.DocumentData[]> {
    if (!orgId) {
      const snapshot = await collection.get();
      return snapshot.docs.map((doc) => doc.data());
    }

    const [orgIdDocs, organizationIdDocs] = await Promise.all([
      collection.where('orgId', '==', orgId).get(),
      collection.where('organizationId', '==', orgId).get(),
    ]);

    const docsById = new Map<string, FirebaseFirestore.DocumentData>();

    orgIdDocs.docs.forEach((doc) => {
      docsById.set(doc.id, doc.data());
    });

    organizationIdDocs.docs.forEach((doc) => {
      docsById.set(doc.id, doc.data());
    });

    return [...docsById.values()];
  }

  private countInMonth(docs: FirebaseFirestore.DocumentData[], year: number, monthIndex: number): number {
    return docs.reduce((count, doc) => {
      const date = this.extractEventDate(doc);
      if (!date) {
        return count;
      }

      const isInMonth = date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
      return isInMonth ? count + 1 : count;
    }, 0);
  }

  private countInUtcDay(docs: FirebaseFirestore.DocumentData[], day: Date, validStatuses?: string[]): number {
    return docs.reduce((count, doc) => {
      const date = this.extractEventDate(doc);
      if (!date || !this.isSameUtcDay(date, day)) {
        return count;
      }

      if (validStatuses && validStatuses.length > 0) {
        const status = this.extractStatus(doc);
        if (!validStatuses.includes(status)) {
          return count;
        }
      }

      return count + 1;
    }, 0);
  }

  private countInRange(
    docs: FirebaseFirestore.DocumentData[],
    start: Date,
    end: Date,
    validStatuses?: string[],
  ): number {
    return docs.reduce((count, doc) => {
      const date = this.extractEventDate(doc);
      if (!date || date < start || date >= end) {
        return count;
      }

      if (validStatuses && validStatuses.length > 0) {
        const status = this.extractStatus(doc);
        if (!validStatuses.includes(status)) {
          return count;
        }
      }

      return count + 1;
    }, 0);
  }

  private buildJobsTrend(docs: FirebaseFirestore.DocumentData[], now: Date): JobsTrendPointDTO[] {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      days.push(this.addDaysUTC(now, -i));
    }

    return days.map((day) => ({
      label: this.getWeekLabel(day),
      open: this.countInUtcDay(docs, day, OPEN_STATUSES),
      completed: this.countInUtcDay(docs, day, COMPLETED_STATUSES),
    }));
  }

  private computeSatisfactionBreakdown(
    docs: FirebaseFirestore.DocumentData[],
    start: Date,
    end: Date,
  ): SatisfactionBreakdownDTO {
    return docs.reduce<SatisfactionBreakdownDTO>(
      (acc, doc) => {
        const date = this.extractEventDate(doc);
        if (!date || date < start || date >= end) {
          return acc;
        }

        const sentiment = this.extractSentiment(doc);
        if (sentiment === 'positive') {
          acc.positive += 1;
        } else if (sentiment === 'negative') {
          acc.negative += 1;
        } else if (sentiment === 'neutral') {
          acc.neutral += 1;
        }

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

  private extractStatus(doc: FirebaseFirestore.DocumentData): string {
    return String(doc.status ?? doc.state ?? '').toLowerCase();
  }

  private extractSentiment(doc: FirebaseFirestore.DocumentData): 'positive' | 'neutral' | 'negative' | null {
    const sentimentRaw = doc.sentiment ?? doc.type ?? null;
    if (typeof sentimentRaw === 'string') {
      const sentiment = sentimentRaw.toLowerCase();
      if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') {
        return sentiment;
      }
    }

    const rating = doc.rating ?? doc.score;
    if (typeof rating === 'number') {
      if (rating >= 4) {
        return 'positive';
      }

      if (rating <= 2) {
        return 'negative';
      }

      return 'neutral';
    }

    return null;
  }

  private extractEventDate(doc: FirebaseFirestore.DocumentData): Date | null {
    const candidate = doc.createdAt ?? doc.updatedAt ?? doc.timestamp ?? doc.date ?? null;
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
