import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { validateBody, validateParams } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { createUserSchema, updateUserSchema } from '../validators/users.validator';

const router = Router();

router.get('/', UsersController.list);
router.get('/:id', validateParams(idParamSchema), UsersController.getById);
router.post('/', validateBody(createUserSchema), UsersController.create);
router.patch('/:id', validateParams(idParamSchema), validateBody(updateUserSchema), UsersController.update);
router.delete('/:id', validateParams(idParamSchema), UsersController.remove);

export default router;
