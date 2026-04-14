import { z } from 'zod';

export const createOrderSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  total: z.number().min(0, 'total must be >= 0'),
});

export const updateOrderSchema = z
  .object({
    userId: z.string().trim().min(1, 'userId cannot be empty').optional(),
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
    total: z.number().min(0, 'total must be >= 0').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update',
  });
