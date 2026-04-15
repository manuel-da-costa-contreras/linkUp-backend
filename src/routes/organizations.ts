import { ClientsController } from '../controllers/clients.controller';
import { JobsController } from '../controllers/jobs.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { OrganizationsController } from '../controllers/organizations.controller';
import { requireOrgAccess, requireRole } from '../middlewares/authorization';
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
  requireOrgAccess,
  OrganizationsController.dashboardOverview,
);

router.get(
  '/:orgId/clients',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  validateQuery(clientsPaginationQuerySchema),
  ClientsController.list,
);

router.get(
  '/:orgId/clients/options',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  validateQuery(organizationClientsQuerySchema),
  ClientsController.listOptions,
);

router.post(
  '/:orgId/clients',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateBody(createClientBodySchema),
  ClientsController.create,
);

router.put(
  '/:orgId/clients/:clientId',
  validateParams(organizationClientParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateBody(updateClientBodySchema),
  ClientsController.update,
);

router.delete(
  '/:orgId/clients/:clientId',
  validateParams(organizationClientParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  ClientsController.remove,
);

router.get(
  '/:orgId/jobs',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  validateQuery(jobsPaginationQuerySchema),
  JobsController.list,
);

router.post(
  '/:orgId/jobs',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateBody(createJobBodySchema),
  JobsController.create,
);

router.put(
  '/:orgId/jobs/:jobId',
  validateParams(organizationJobParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateBody(updateJobBodySchema),
  JobsController.update,
);

router.patch(
  '/:orgId/jobs/:jobId/status',
  validateParams(organizationJobParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  JobsController.patchStatus,
);

router.delete(
  '/:orgId/jobs/:jobId',
  validateParams(organizationJobParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  JobsController.remove,
);

router.get(
  '/:orgId/notifications/stream',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  validateQuery(notificationsStreamQuerySchema),
  NotificationsController.stream,
);

router.get(
  '/:orgId/notifications',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  validateQuery(notificationsPaginationQuerySchema),
  NotificationsController.list,
);

router.patch(
  '/:orgId/notifications/:notificationId/dismiss',
  validateParams(organizationNotificationParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  NotificationsController.dismiss,
);

router.post(
  '/:orgId/notifications/dismiss-all',
  validateParams(organizationClientsParamsSchema),
  requireOrgAccess,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  NotificationsController.dismissAll,
);

export default router;
