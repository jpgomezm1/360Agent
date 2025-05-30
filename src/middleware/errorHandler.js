/**
 * Middleware para manejo centralizado de errores
 * Captura y procesa todos los errores de la aplicación
 */
import logger from '../config/logger.js';
import { ERROR_CODES } from '../utils/constants.js';

/**
 * Middleware de manejo de errores
 * @param {Error} error - Error capturado
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function errorHandler(error, req, res, next) {
  // Log del error
  logger.error('Error capturado por middleware:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Determinar tipo de error y respuesta apropiada
  const errorResponse = processError(error);

  // Enviar respuesta de error
  return res.status(errorResponse.statusCode).json({
    success: false,
    error: errorResponse.error,
    message: errorResponse.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
}

/**
 * Procesar error y determinar respuesta apropiada
 * @param {Error} error - Error a procesar
 * @returns {Object} Respuesta de error estructurada
 */
function processError(error) {
  // Errores de Prisma (Base de datos)
  if (error.code && error.code.startsWith('P')) {
    return handlePrismaError(error);
  }

  // Errores de validación
  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      error: ERROR_CODES.INVALID_FORMAT,
      message: 'Datos de entrada inválidos',
      details: error.details
    };
  }

  // Errores de WhatsApp/UltraMSG
  if (error.message.includes('UltraMSG') || error.message.includes('WhatsApp')) {
    return {
      statusCode: 502,
      error: ERROR_CODES.WHATSAPP_ERROR,
      message: 'Error en servicio de WhatsApp'
    };
  }

  // Errores de OpenAI
  if (error.message.includes('OpenAI') || error.code === 'insufficient_quota') {
    return {
      statusCode: 502,
      error: ERROR_CODES.AI_ERROR,
      message: 'Error en servicio de IA'
    };
  }

  // Errores de Weaviate (RAG)
  if (error.message.includes('Weaviate') || error.message.includes('vector')) {
    return {
      statusCode: 502,
      error: ERROR_CODES.RAG_ERROR,
      message: 'Error en servicio de búsqueda'
    };
  }

  // Errores de archivos
  if (error.code === 'ENOENT' || error.message.includes('file')) {
    return {
      statusCode: 400,
      error: ERROR_CODES.FILE_ERROR,
      message: 'Error al procesar archivo'
    };
  }

  // Errores de timeout
  if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
    return {
      statusCode: 408,
      error: ERROR_CODES.CONVERSATION_TIMEOUT,
      message: 'Tiempo de espera agotado'
    };
  }

  // Errores HTTP conocidos
  if (error.status || error.statusCode) {
    return {
      statusCode: error.status || error.statusCode,
      error: error.code || 'HTTP_ERROR',
      message: error.message || 'Error en petición HTTP'
    };
  }

  // Error genérico del servidor
  return {
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor'
  };
}

/**
 * Manejar errores específicos de Prisma
 * @param {Object} error - Error de Prisma
 * @returns {Object} Respuesta de error estructurada
 */
function handlePrismaError(error) {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        error: 'DUPLICATE_ENTRY',
        message: 'Ya existe un registro con esos datos'
      };

    case 'P2025':
      return {
        statusCode: 404,
        error: 'RECORD_NOT_FOUND',
        message: 'Registro no encontrado'
      };

    case 'P2003':
      return {
        statusCode: 400,
        error: 'FOREIGN_KEY_CONSTRAINT',
        message: 'Error de relación entre datos'
      };

    case 'P2021':
      return {
        statusCode: 500,
        error: 'TABLE_NOT_EXISTS',
        message: 'Error de configuración de base de datos'
      };

    case 'P1008':
      return {
        statusCode: 408,
        error: 'DATABASE_TIMEOUT',
        message: 'Timeout en base de datos'
      };

    case 'P1001':
      return {
        statusCode: 503,
        error: 'DATABASE_UNREACHABLE',
        message: 'No se puede conectar a la base de datos'
      };

    default:
      return {
        statusCode: 500,
        error: ERROR_CODES.DATABASE_ERROR,
        message: 'Error en base de datos'
      };
  }
}

/**
 * Middleware para manejar rutas no encontradas
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function notFoundHandler(req, res, next) {
    const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    error.status = 404;
    
    logger.warn('Ruta no encontrada:', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
   
    return res.status(404).json({
      success: false,
      error: 'ROUTE_NOT_FOUND',
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      availableEndpoints: {
        webhooks: '/api/webhooks/ultramsg',
        simulator: '/api/simulator/submit',
        admin: '/api/admin/dashboard',
        health: '/api/health'
      }
    });
   }
   
   /**
   * Middleware para capturar errores asíncronos
   * @param {Function} fn - Función async a envolver
   * @returns {Function} Middleware de Express
   */
   export function asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
   }
   
   /**
   * Middleware para logging de requests
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   * @param {Function} next - Next middleware
   */
   export function requestLogger(req, res, next) {
    const startTime = Date.now();
    
    // Log del request entrante
    logger.info('Request entrante:', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length')
    });
   
    // Override del método end para capturar la respuesta
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      logger.info('Request completado:', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length') || '0'
      });
   
      originalEnd.call(res, chunk, encoding);
    };
   
    next();
   }
   
   export default {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    requestLogger
   };