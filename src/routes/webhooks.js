/**
 * Rutas para webhooks de servicios externos
 * Principalmente UltraMSG (WhatsApp)
 */
import { Router } from 'express';
import webhookController from '../controllers/webhookController.js';
import { webhookAuth } from '../middleware/auth.js';
import { validateUltraMSGWebhook } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/**
 * Webhook principal de UltraMSG
 * POST /api/webhooks/ultramsg
 */
router.post('/ultramsg',
  webhookAuth,
  validateUltraMSGWebhook,
  asyncHandler(webhookController.handleUltraMSGWebhook.bind(webhookController))
);

/**
 * Validación de webhook (para configuración inicial)
 * GET /api/webhooks/ultramsg/validate
 */
router.get('/ultramsg/validate',
  webhookAuth,
  asyncHandler(webhookController.validateUltraMSGWebhook.bind(webhookController))
);

/**
 * Test de webhook (desarrollo)
 * POST /api/webhooks/test
 */
router.post('/test',
  asyncHandler(webhookController.testWebhook.bind(webhookController))
);

/**
 * Estadísticas de webhooks
 * GET /api/webhooks/stats
 */
router.get('/stats',
  webhookAuth,
  asyncHandler(webhookController.getWebhookStats.bind(webhookController))
);

export default router;