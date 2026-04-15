import { z } from 'zod';

export const loginPayloadSchema = z.object({
  email: z.string().trim().email('email must be valid'),
  password: z.string().min(6, 'password must have at least 6 characters'),
});

export const registerPayloadSchema = z.object({
  email: z.string().trim().email('email must be valid'),
  password: z.string().min(6, 'password must have at least 6 characters'),
  orgId: z.string().trim().min(1, 'orgId is required'),
  name: z.string().trim().min(2, 'name must have at least 2 characters').max(120).optional(),
});

export const sseTokenBodySchema = z.object({
  orgId: z.string().trim().min(1, 'orgId is required'),
});
