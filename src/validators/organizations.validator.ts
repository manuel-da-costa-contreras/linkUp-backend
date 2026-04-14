import { z } from 'zod';

const jobStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']);

export const organizationDashboardParamsSchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
});

export const organizationClientParamsSchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
  clientId: z.string().trim().min(1, 'clientId is required'),
});

export const organizationJobParamsSchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
  jobId: z.string().trim().min(1, 'jobId is required'),
});

export const organizationNotificationParamsSchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
  notificationId: z.string().trim().min(1, 'notificationId is required'),
});

export const organizationClientsParamsSchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
});

export const clientsPaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(100).optional(),
    sortBy: z.enum(['name', 'totalJobs', 'pendingJobs', 'inProgressJobs', 'completedJobs', 'createdAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const jobsPaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(100).optional(),
    sortBy: z.enum(['name', 'clientName', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const notificationsPaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['active', 'dismissed', 'all']).default('active'),
    types: z.string().max(200).optional(),
  });

export const notificationsStreamQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).default('active'),
  types: z.string().max(200).optional(),
});

export const organizationClientsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const createClientBodySchema = z.object({
  name: z.string().trim().min(2, 'name must have at least 2 characters').max(120),
});

export const updateClientBodySchema = z.object({
  name: z.string().trim().min(2, 'name must have at least 2 characters').max(120),
});

export const createJobBodySchema = z.object({
  name: z.string().trim().min(2, 'name must have at least 2 characters').max(160),
  clientId: z.string().trim().min(1, 'clientId is required'),
  status: jobStatusSchema.optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const updateJobBodySchema = z
  .object({
    name: z.string().trim().min(2, 'name must have at least 2 characters').max(160).optional(),
    clientId: z.string().trim().min(1, 'clientId is required').optional(),
    status: jobStatusSchema.optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update',
  });

export const patchJobStatusBodySchema = z
  .object({
    status: jobStatusSchema,
    reason: z.string().trim().min(1).max(500).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'COMPLETED' && value.rating === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rating'],
        message: 'rating is required when status is COMPLETED',
      });
    }

    if (value.status !== 'COMPLETED' && value.rating !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rating'],
        message: 'rating is only allowed when status is COMPLETED',
      });
    }
  });
