import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().email('email must be valid'),
  name: z.string().trim().min(2, 'name must have at least 2 characters'),
  role: z.enum(['admin', 'user']).optional(),
});

export const updateUserSchema = z
  .object({
    email: z.string().trim().email('email must be valid').optional(),
    name: z.string().trim().min(2, 'name must have at least 2 characters').optional(),
    role: z.enum(['admin', 'user']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update',
  });
