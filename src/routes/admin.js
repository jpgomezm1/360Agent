/**
 * Rutas de administración del sistema
 * Requieren autenticación
 */
import { Router } from 'express';
import adminController from '../controllers/adminController.js';
import { 
  basicAuth, 
  requirePermissions 
} from '../middleware/auth.js';
import {
  validatePropertiesQuery,
  validateSystemLogsQuery,
  validatePropertyId,
  validateConversationId,
  validateManualMessage,
  validateForceComplete
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Aplicar autenticación a todas las rutas de admin
router.use(basicAuth);

/**
 * Dashboard principal
 * GET /api/admin/dashboard
 */
router.get('/dashboard',
  asyncHandler(adminController.getDashboard.bind(adminController))
);

/**
 * Listar propiedades con filtros
 * GET /api/admin/properties
 */
router.get('/properties',
  validatePropertiesQuery,
  asyncHandler(adminController.getProperties.bind(adminController))
);

/**
 * Detalles de propiedad específica
 * GET /api/admin/properties/:propertyId
 */
router.get('/properties/:propertyId',
  validatePropertyId,
  asyncHandler(adminController.getPropertyDetails.bind(adminController))
);

/**
 * Conversaciones activas
 * GET /api/admin/conversations
 */
router.get('/conversations',
  asyncHandler(adminController.getActiveConversations.bind(adminController))
);

/**
 * Forzar completar conversación
 * POST /api/admin/conversations/:conversationId/complete
 */
router.post('/conversations/:conversationId/complete',
  requirePermissions(['write']),
  validateConversationId,
  validateForceComplete,
  asyncHandler(adminController.forceCompleteConversation.bind(adminController))
);

/**
 * Enviar mensaje manual a conversación
 * POST /api/admin/conversations/:conversationId/message
 */
router.post('/conversations/:conversationId/message',
  requirePermissions(['write']),
  validateConversationId,
  validateManualMessage,
  asyncHandler(adminController.sendManualMessage.bind(adminController))
);

/**
 * Logs del sistema
 * GET /api/admin/logs
 */
router.get('/logs',
  requirePermissions(['read']),
  validateSystemLogsQuery,
  asyncHandler(adminController.getSystemLogs.bind(adminController))
);

/**
 * Configuración del sistema
 * GET /api/admin/config
 */
router.get('/config',
  asyncHandler(adminController.getSystemConfig.bind(adminController))
);

/**
 * Estadísticas de rendimiento
 * GET /api/admin/performance
 */
router.get('/performance',
  asyncHandler(adminController.getPerformanceStats.bind(adminController))
);

export default router;