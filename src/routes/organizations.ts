import { ClientsController } from '../controllers/clients.controller';
import { JobsController } from '../controllers/jobs.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { OrganizationsController } from '../controllers/organizations.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate';
import {
  clientsPaginationQuerySchema,
  createClientBodySchema,
  createJobBodySchema,
  jobsPaginationQuerySchema,
  notificationsPaginationQuerySchema,
  notificationsStreamQuerySchema,
  organizationClientParamsSchema,
  organizationClientsParamsSchema,
  organizationClientsQuerySchema,
  organizationDashboardParamsSchema,
  organizationJobParamsSchema,
  organizationNotificationParamsSchema,
  updateClientBodySchema,
  updateJobBodySchema,
} from '../validators/organizations.validator';
import { Router } from 'express';

const router = Router();

router.get(
  '/:orgId/dashboard/overview',
  validateParams(organizationDashboardParamsSchema),
  OrganizationsController.dashboardOverview,
);

router.get(
  '/:orgId/clients',
  validateParams(organizationClientsParamsSchema),
  validateQuery(clientsPaginationQuerySchema),
  ClientsController.list,
);

router.get(
  '/:orgId/clients/options',
  validateParams(organizationClientsParamsSchema),
  validateQuery(organizationClientsQuerySchema),
  ClientsController.listOptions,
);

router.post(
  '/:orgId/clients',
  validateParams(organizationClientsParamsSchema),
  validateBody(createClientBodySchema),
  ClientsController.create,
);

router.put(
  '/:orgId/clients/:clientId',
  validateParams(organizationClientParamsSchema),
  validateBody(updateClientBodySchema),
  ClientsController.update,
);

router.delete(
  '/:orgId/clients/:clientId',
  validateParams(organizationClientParamsSchema),
  ClientsController.remove,
);

router.get(
  '/:orgId/jobs',
  validateParams(organizationClientsParamsSchema),
  validateQuery(jobsPaginationQuerySchema),
  JobsController.list,
);

router.post(
  '/:orgId/jobs',
  validateParams(organizationClientsParamsSchema),
  validateBody(createJobBodySchema),
  JobsController.create,
);

router.put(
  '/:orgId/jobs/:jobId',
  validateParams(organizationJobParamsSchema),
  validateBody(updateJobBodySchema),
  JobsController.update,
);

router.patch(
  '/:orgId/jobs/:jobId/status',
  validateParams(organizationJobParamsSchema),
  JobsController.patchStatus,
);

router.delete(
  '/:orgId/jobs/:jobId',
  validateParams(organizationJobParamsSchema),
  JobsController.remove,
);

router.get(
  '/:orgId/notifications/stream',
  validateParams(organizationClientsParamsSchema),
  validateQuery(notificationsStreamQuerySchema),
  NotificationsController.stream,
);

router.get(
  '/:orgId/notifications',
  validateParams(organizationClientsParamsSchema),
  validateQuery(notificationsPaginationQuerySchema),
  NotificationsController.list,
);

router.patch(
  '/:orgId/notifications/:notificationId/dismiss',
  validateParams(organizationNotificationParamsSchema),
  NotificationsController.dismiss,
);

router.post(
  '/:orgId/notifications/dismiss-all',
  validateParams(organizationClientsParamsSchema),
  NotificationsController.dismissAll,
);

export default router;
