import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateRequest } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { loginPayloadSchema, registerPayloadSchema, sseTokenBodySchema } from '../validators/auth.validator';

const router = Router();

router.get('/', AuthController.health);
router.post('/login', validateBody(loginPayloadSchema), AuthController.login);
router.post('/register', validateBody(registerPayloadSchema), AuthController.register);
router.post('/sse-token', authenticateRequest, validateBody(sseTokenBodySchema), AuthController.sseToken);

export default router;
