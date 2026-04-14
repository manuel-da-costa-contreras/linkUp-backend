import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'id is required'),
});
