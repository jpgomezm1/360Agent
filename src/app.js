/**
* Aplicación principal Express
* Configuración completa del servidor y middleware
*/
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateConfig } from './config/index.js';
import logger from './config/logger.js';
import { testDatabaseConnection } from './config/database.js';

// Middleware personalizados
import { 
errorHandler, 
notFoundHandler, 
requestLogger 
} from './middleware/errorHandler.js';
import { 
sanitizeInput, 
createRateLimit 
} from './middleware/validation.js';
import { corsHandler } from './middleware/auth.js';

// Rutas
import indexRoutes from './routes/index.js';
import webhookRoutes from './routes/webhooks.js';
import simulatorRoutes from './routes/simulator.js';
import adminRoutes from './routes/admin.js';

class App {
constructor() {
  this.app = express();
  this.initialize();
}

/**
 * Inicializar aplicación Express
 */
async initialize() {
  try {
    // Validar configuración
    validateConfig();
    logger.info('Configuración validada exitosamente');

    // Verificar conexión a base de datos
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    // Configurar middleware básico
    this.setupBasicMiddleware();

    // Configurar middleware de seguridad
    this.setupSecurityMiddleware();

    // Configurar rutas
    this.setupRoutes();

    // Configurar manejo de errores
    this.setupErrorHandling();

    logger.info('Aplicación Express inicializada exitosamente');

  } catch (error) {
    logger.error('Error al inicializar aplicación:', error);
    throw error;
  }
}

/**
 * Configurar middleware básico
 */
setupBasicMiddleware() {
  // Trust proxy configuración condicional para desarrollo
  if (process.env.NODE_ENV === 'development') {
    this.app.set('trust proxy', false);
  } else {
    this.app.set('trust proxy', 1);
  }

  // Logging de requests
  this.app.use(requestLogger);

  // Parseo de JSON y URL encoded
  this.app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Verificar contenido JSON válido
      try {
        JSON.parse(buf);
      } catch (e) {
        const error = new Error('JSON inválido');
        error.status = 400;
        throw error;
      }
    }
  }));

  this.app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Sanitización de entrada
  this.app.use(sanitizeInput);

  logger.info('Middleware básico configurado');
}

/**
 * Configurar middleware de seguridad
 */
setupSecurityMiddleware() {
  // CORS personalizado
  this.app.use(corsHandler);

  // Helmet para headers de seguridad
  this.app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // Rate limiting global - SOLO EN PRODUCCIÓN
  if (process.env.NODE_ENV !== 'development') {
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 1000, // máximo 1000 requests por ventana
      message: {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas peticiones desde esta IP'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Saltar rate limiting para health checks
        return req.path === '/api/health';
      }
    });

    this.app.use('/api/', globalRateLimit);

    // Rate limiting específico para webhooks
    const webhookRateLimit = createRateLimit(500, 15 * 60 * 1000);
    this.app.use('/api/webhooks/', webhookRateLimit);
  }

  logger.info('Middleware de seguridad configurado');
}

/**
 * Configurar rutas de la aplicación
 */
setupRoutes() {
  // Ruta raíz
  this.app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Bot WhatsApp Inmobiliario - FASE 1',
      version: '1.0.0',
      status: 'operational',
      documentation: '/api',
      timestamp: new Date().toISOString()
    });
  });

  // Rutas principales de la API
  this.app.use('/api', indexRoutes);
  this.app.use('/api/webhooks', webhookRoutes);
  this.app.use('/api/simulator', simulatorRoutes);
  this.app.use('/api/admin', adminRoutes);

  // Ruta para favicon (evitar logs de error innecesarios)
  this.app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  logger.info('Rutas configuradas exitosamente');
}

/**
 * Configurar manejo de errores
 */
setupErrorHandling() {
  // Capturar rutas no encontradas
  this.app.use(notFoundHandler);

  // Manejador global de errores
  this.app.use(errorHandler);

  // Capturar errores no manejados
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada:', error);
    
    // Dar tiempo para que se escriban los logs antes de salir
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rechazada no manejada:', {
      reason,
      promise
    });
  });

  logger.info('Manejo de errores configurado');
}

/**
 * Configurar graceful shutdown
 */
setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    logger.info(`Señal ${signal} recibida, iniciando graceful shutdown...`);

    try {
      // Cerrar servidor HTTP
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('Servidor HTTP cerrado');
      }

      // Cerrar conexión a base de datos
      const { closePrismaClient } = await import('./config/database.js');
      await closePrismaClient();

      // Limpiar timeouts de conversaciones
      const { default: conversationManager } = await import('./core/conversationManager.js');
      conversationManager.activeConversations.clear();
      for (const timeout of conversationManager.timeouts.values()) {
        clearTimeout(timeout);
      }
      conversationManager.timeouts.clear();

      logger.info('Graceful shutdown completado');
      process.exit(0);

    } catch (error) {
      logger.error('Error durante graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Registrar manejadores de señales
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('Graceful shutdown configurado');
}

/**
 * Inicializar servicios externos
 */
async initializeServices() {
  try {
    logger.info('Inicializando servicios externos...');

    // Inicializar RAG (Weaviate)
    const { default: ragService } = await import('./services/ragService.js');
    const ragConnected = await ragService.checkConnection();
    if (ragConnected) {
      logger.info('Servicio RAG inicializado exitosamente');
    } else {
      logger.warn('No se pudo conectar al servicio RAG');
    }

    // Validar configuración de WhatsApp - LÓGICA CORREGIDA
    const { default: whatsappService } = await import('./services/whatsappService.js');
    const whatsappResult = await whatsappService.validateService();
    
    // La función validateService retorna boolean, no un objeto
    if (whatsappResult === true) {
      logger.info('Servicio WhatsApp validado exitosamente');
    } else {
      logger.warn('Servicio WhatsApp no está disponible');
    }

    // Validar configuración de email
    const { default: emailService } = await import('./services/emailService.js');
    const emailValid = await emailService.validateConfiguration();
    if (emailValid) {
      logger.info('Servicio de email validado exitosamente');
    } else {
      logger.warn('Servicio de email no está configurado correctamente');
    }

    // Validar configuración de Google Sheets
    const { default: sheetsService } = await import('./services/sheetsService.js');
    const sheetsConnected = await sheetsService.checkConnection();
    if (sheetsConnected) {
      logger.info('Servicio Google Sheets validado exitosamente');
    } else {
      logger.warn('Servicio Google Sheets no está disponible');
    }

    logger.info('Inicialización de servicios completada');

  } catch (error) {
    logger.error('Error al inicializar servicios:', error);
    // No lanzar error para permitir que la app funcione parcialmente
  }
}

/**
 * Obtener instancia de Express
 */
getApp() {
  return this.app;
}

/**
 * Establecer instancia del servidor
 */
setServer(server) {
  this.server = server;
  this.setupGracefulShutdown();
}
}

// Crear y exportar instancia de la aplicación
const appInstance = new App();
export default appInstance;