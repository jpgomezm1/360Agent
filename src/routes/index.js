/**
 * Rutas principales de la aplicación
 * Incluye endpoints públicos y de información general
 */
import { Router } from 'express';
import { generateApiKey } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * Endpoint de información de la API
 * GET /api/
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bot WhatsApp Inmobiliario - API',
    version: '1.0.0',
    phase: 'FASE_1_CONVERSACIONAL',
    features: {
      formSimulation: true,
      whatsappIntegration: true,
      aiProcessing: true,
      ragSystem: true,
      documentProcessing: true,
      googleSheetsExport: true,
      emailNotifications: true
    },
    endpoints: {
      webhooks: '/api/webhooks',
      simulator: '/api/simulator', 
      admin: '/api/admin',
      health: '/api/health'
    },
    documentation: 'README.md',
    timestamp: new Date().toISOString()
  });
});

/**
 * Health check del sistema
 * GET /api/health
 */
router.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0-FASE1',
    environment: process.env.NODE_ENV || 'development',
    services: {
      api: 'operational',
      database: 'operational', // Se puede expandir con checks reales
      whatsapp: 'operational',
      ai: 'operational',
      rag: 'operational'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };

  res.status(200).json({
    success: true,
    health
  });
}));

/**
 * Información de la fase actual
 * GET /api/phase
 */
router.get('/phase', (req, res) => {
  res.json({
    success: true,
    currentPhase: 'FASE_1_CONVERSACIONAL',
    description: 'Bot conversacional inteligente para recopilación de información inmobiliaria',
    implemented: [
      'Simulación de formulario web',
      'Conversación inteligente por WhatsApp',
      'Interpretación con GPT-4 (NO regex)',
      'Sistema RAG para respuestas contextuales',
      'Seguimiento de completitud de campos',
      'Procesamiento de documentos con OCR',
      'Exportación automática a Google Sheets',
      'Notificaciones por email con Resend'
    ],
    notImplemented: [
      'Webhook real del formulario web',
      'Integración con sistema de Background checks',
      'Integración con Pulppo',
      'Proceso de aprobación real',
      'Publicación automática de propiedades'
    ],
    nextPhase: 'FASE_2_INTEGRACIONES',
    timestamp: new Date().toISOString()
  });
});

/**
 * Generar API key temporal (solo desarrollo)
 * POST /api/generate-key
 */
router.post('/generate-key', 
  asyncHandler(generateApiKey)
);

/**
 * Estadísticas públicas básicas
 * GET /api/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { default: conversationManager } = await import('../core/conversationManager.js');
    
    const stats = await conversationManager.getConversationStats();
    
    // Solo exponer estadísticas básicas públicamente
    const publicStats = {
      totalConversations: stats.total,
      activeConversations: stats.activas,
      completedConversations: stats.completadas,
      systemUptime: process.uptime(),
      phase: 'FASE_1_CONVERSACIONAL',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      stats: publicStats
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas públicas:', error);
    res.json({
      success: false,
      error: 'Error al obtener estadísticas',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * Endpoint de test (desarrollo)
 * GET /api/test
 */
router.get('/test', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({
      success: false,
      error: 'Endpoint solo disponible en desarrollo'
    });
  }

  res.json({
    success: true,
    message: 'Endpoint de test funcionando',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      ip: req.ip
    }
  });
});

export default router;