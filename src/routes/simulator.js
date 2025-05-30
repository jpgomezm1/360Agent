/**
 * Rutas para simulación del formulario web
 * FASE 1: Solo simulación, no webhook real
 */
import { Router } from 'express';
import simulatorController from '../controllers/simulatorController.js';
import { 
  validateSimulateForm,
  validateMultipleSubmissions,
  validateCleanupTestData,
  validateTestId,
  createRateLimit
} from '../middleware/validation.js';
import { basicAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Rate limiting para simulador (prevenir abuso)
const simulatorRateLimit = createRateLimit(50, 15 * 60 * 1000); // 50 requests por 15 min

/**
 * Simular envío de formulario web
 * POST /api/simulator/submit
 */
router.post('/submit',
  simulatorRateLimit,
  validateSimulateForm,
  asyncHandler(simulatorController.simulateFormSubmission.bind(simulatorController))
);

/**
 * Usar datos de ejemplo predefinidos
 * POST /api/simulator/example
 */
router.post('/example',
  simulatorRateLimit,
  asyncHandler(simulatorController.useExampleData.bind(simulatorController))
);

/**
 * Obtener conjuntos de datos de prueba
 * GET /api/simulator/test-sets
 */
router.get('/test-sets',
  asyncHandler(simulatorController.getTestDataSets.bind(simulatorController))
);

/**
 * Procesar conjunto de datos de prueba específico
 * POST /api/simulator/test-sets/:testId
 */
router.post('/test-sets/:testId',
  simulatorRateLimit,
  validateTestId,
  asyncHandler(simulatorController.processTestDataSet.bind(simulatorController))
);

/**
 * Simulación múltiple para pruebas de carga
 * POST /api/simulator/multiple
 */
router.post('/multiple',
  basicAuth, // Requiere autenticación para prevenir abuso
  validateMultipleSubmissions,
  asyncHandler(simulatorController.simulateMultipleSubmissions.bind(simulatorController))
);

/**
 * Estado del simulador
 * GET /api/simulator/status
 */
router.get('/status',
  asyncHandler(simulatorController.getSimulatorStatus.bind(simulatorController))
);

/**
 * Limpiar datos de prueba
 * DELETE /api/simulator/cleanup
 */
router.delete('/cleanup',
  basicAuth,
  validateCleanupTestData,
  asyncHandler(simulatorController.cleanupTestData.bind(simulatorController))
);

export default router;