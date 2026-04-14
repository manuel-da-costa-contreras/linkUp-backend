import { Router } from 'express';
import { OrdersController } from '../controllers/orders.controller';
import { validateBody, validateParams } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { createOrderSchema, updateOrderSchema } from '../validators/orders.validator';

const router = Router();

router.get('/', OrdersController.list);
router.get('/:id', validateParams(idParamSchema), OrdersController.getById);
router.post('/', validateBody(createOrderSchema), OrdersController.create);
router.patch('/:id', validateParams(idParamSchema), validateBody(updateOrderSchema), OrdersController.update);
router.delete('/:id', validateParams(idParamSchema), OrdersController.remove);

export default router;
