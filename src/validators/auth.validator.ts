import { z } from 'zod';

export const authPayloadSchema = z.object({
  email: z.string().trim().email('email must be valid'),
  password: z.string().min(6, 'password must have at least 6 characters'),
});
