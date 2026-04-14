import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate';
import { authPayloadSchema } from '../validators/auth.validator';

const router = Router();

router.get('/', AuthController.health);
router.post('/login', validateBody(authPayloadSchema), AuthController.login);
router.post('/register', validateBody(authPayloadSchema), AuthController.register);

export default router;
