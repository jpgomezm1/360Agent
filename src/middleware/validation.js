/**
 * Middleware de validación de datos
 * Valida requests entrantes usando Joi
 */
import Joi from 'joi';
import logger from '../config/logger.js';

/**
 * Crear middleware de validación
 * @param {Object} schema - Schema de validación Joi
 * @param {string} property - Propiedad del request a validar ('body', 'query', 'params')
 * @returns {Function} Middleware de Express
 */
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      logger.warn('Validación fallida:', {
        property,
        errors: errorDetails,
        originalData: req[property]
      });

      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: errorDetails
      });
    }

    // Reemplazar datos originales con datos validados y sanitizados
    req[property] = value;
    next();
  };
}

/**
 * Schemas de validación para diferentes endpoints
 */

// Schema para simulación de formulario
export const simulateFormSchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(50).required()
    .messages({
      'string.empty': 'El nombre es requerido',
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede tener más de 50 caracteres'
    }),

  apellido: Joi.string().trim().min(2).max(50).required()
    .messages({
      'string.empty': 'El apellido es requerido',
      'string.min': 'El apellido debe tener al menos 2 caracteres'
    }),

  tipo_documento: Joi.string().valid('CC', 'CE', 'TI', 'PAS').required()
    .messages({
      'any.only': 'El tipo de documento debe ser CC, CE, TI o PAS'
    }),

  numero_documento: Joi.string().pattern(/^\d{6,12}$/).required()
    .messages({
      'string.pattern.base': 'El número de documento debe contener entre 6 y 12 dígitos'
    }),

  pais: Joi.string().trim().min(2).max(50).required(),

  celular: Joi.string().pattern(/^(\+?57)?[0-9]{10}$/).required()
    .messages({
      'string.pattern.base': 'El celular debe ser un número colombiano válido'
    }),

  email: Joi.string().email().lowercase().required()
    .messages({
      'string.email': 'El email debe tener un formato válido'
    }),

  ciudad_inmueble: Joi.string().trim().min(2).max(100).required(),

  direccion_inmueble: Joi.string().trim().min(5).max(200).required()
    .messages({
      'string.min': 'La dirección debe tener al menos 5 caracteres'
    }),

  matricula_inmobiliaria: Joi.string().trim().min(3).max(50).required(),

  timestamp: Joi.string().isoDate().optional()
});

// Schema para múltiples envíos de simulación
export const multipleSubmissionsSchema = Joi.object({
  count: Joi.number().integer().min(1).max(20).default(5)
    .messages({
      'number.max': 'Máximo 20 envíos simultáneos permitidos'
    }),

  delay: Joi.number().integer().min(0).max(10000).default(1000)
    .messages({
      'number.max': 'Delay máximo de 10 segundos'
    })
});

// Schema para envío de mensaje manual
export const sendManualMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(1000).required()
    .messages({
      'string.empty': 'El mensaje no puede estar vacío',
      'string.max': 'El mensaje no puede tener más de 1000 caracteres'
    }),

  type: Joi.string().valid('ADMIN', 'SYSTEM', 'BOT').default('ADMIN')
});

// Schema para completar conversación manualmente
export const forceCompleteSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(200).optional()
    .default('Completado manualmente por administrador')
    .messages({
      'string.min': 'La razón debe tener al menos 5 caracteres'
    })
});

// Schema para limpieza de datos de prueba
export const cleanupTestDataSchema = Joi.object({
  confirm: Joi.string().valid('DELETE_ALL_TEST_DATA').required()
    .messages({
      'any.only': 'Debe confirmar con "DELETE_ALL_TEST_DATA"'
    })
});

// Schema para filtros de propiedades
export const propertiesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  estado: Joi.string().valid('INICIADO', 'EN_PROGRESO', 'COMPLETADO').optional(),
  ciudad: Joi.string().trim().min(2).max(100).optional(),
  completitud_min: Joi.number().integer().min(0).max(100).optional(),
  completitud_max: Joi.number().integer().min(0).max(100).optional(),
  fecha_desde: Joi.string().isoDate().optional(),
  fecha_hasta: Joi.string().isoDate().optional()
});

// Schema para logs del sistema
export const systemLogsQuerySchema = Joi.object({
  level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  context: Joi.string().trim().max(50).optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional()
});

// Schema para webhook de UltraMSG - ACTUALIZADO PARA SOPORTAR "chat"
export const ultramsgWebhookSchema = Joi.object({
  event_type: Joi.string().optional(), // UltraMSG incluye esto
  instanceId: Joi.string().optional(),
  id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  referenceId: Joi.string().optional(),
  hash: Joi.string().optional(),
  data: Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('text', 'image', 'document', 'audio', 'video', 'sent', 'chat').required(),
    from: Joi.string().required(),
    to: Joi.string().optional(), // UltraMSG incluye esto
    author: Joi.string().optional(),
    pushname: Joi.string().optional(),
    ack: Joi.string().optional(),
    timestamp: Joi.number().optional(),
    time: Joi.number().optional(), // UltraMSG usa "time" en lugar de "timestamp"
    chatId: Joi.string().optional(),
    
    // Para mensajes de texto
    body: Joi.string().when('type', {
      is: Joi.string().valid('text', 'chat'),
      then: Joi.optional(), // Hacer opcional para mayor flexibilidad
      otherwise: Joi.optional()
    }),
    
    text: Joi.string().optional(),
    
    // Para archivos
    filename: Joi.string().when('type', {
      is: Joi.string().valid('document', 'image', 'audio', 'video'),
      then: Joi.optional(),
      otherwise: Joi.optional()
    }),
    
    caption: Joi.string().optional(),
    mimetype: Joi.string().optional(),
    size: Joi.number().integer().optional(),
    duration: Joi.number().optional(),
    media: Joi.string().optional(),
    
    // Campos adicionales de UltraMSG
    fromMe: Joi.boolean().optional(),
    self: Joi.boolean().optional(),
    isForwarded: Joi.boolean().optional(),
    isMentioned: Joi.boolean().optional(),
    quotedMsg: Joi.object().optional(),
    mentionedIds: Joi.array().optional()
    
  }).required()
});

/**
 * Middleware específicos para diferentes rutas
 */

// Validar formulario de simulación
export const validateSimulateForm = validate(simulateFormSchema);

// Validar múltiples envíos
export const validateMultipleSubmissions = validate(multipleSubmissionsSchema);

// Validar mensaje manual
export const validateManualMessage = validate(sendManualMessageSchema);

// Validar completar conversación
export const validateForceComplete = validate(forceCompleteSchema);

// Validar limpieza de datos
export const validateCleanupTestData = validate(cleanupTestDataSchema);

// Validar query de propiedades
export const validatePropertiesQuery = validate(propertiesQuerySchema, 'query');

// Validar query de logs
export const validateSystemLogsQuery = validate(systemLogsQuerySchema, 'query');

// Validar webhook de UltraMSG
export const validateUltraMSGWebhook = validate(ultramsgWebhookSchema);

/**
 * Middleware para validar UUIDs en parámetros
 * @param {string} paramName - Nombre del parámetro a validar
 * @returns {Function} Middleware de Express
 */
export function validateUUID(paramName) {
  const schema = Joi.object({
    [paramName]: Joi.string().uuid().required()
      .messages({
        'string.guid': `${paramName} debe ser un UUID válido`
      })
  });

  return validate(schema, 'params');
}

/**
 * Middleware para validar parámetros de ID
 */
export const validatePropertyId = validateUUID('propertyId');
export const validateConversationId = validateUUID('conversationId');
export const validateTestId = (req, res, next) => {
  const schema = Joi.object({
    testId: Joi.string().valid('test1', 'test2', 'test3').required()
      .messages({
        'any.only': 'testId debe ser test1, test2 o test3'
      })
  });

  return validate(schema, 'params')(req, res, next);
};

/**
 * Middleware para sanitizar datos de entrada
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function sanitizeInput(req, res, next) {
  // Función recursiva para sanitizar objetos
  function sanitize(obj) {
    if (typeof obj === 'string') {
      // Remover caracteres peligrosos pero mantener caracteres especiales del español
      return obj.trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/javascript:/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  // Sanitizar body, query y params
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}

/**
 * Middleware de rate limiting por IP
 * @param {number} maxRequests - Máximo número de requests
 * @param {number} windowMs - Ventana de tiempo en ms
 * @returns {Function} Middleware de Express
 */
export function createRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  // En desarrollo, desactivar rate limiting para evitar problemas con trust proxy
  if (process.env.NODE_ENV === 'development') {
    return (req, res, next) => {
      // Agregar headers informativos pero no bloquear
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': maxRequests,
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });
      next();
    };
  }

  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    // Limpiar requests antiguos
    for (const [key, data] of requests.entries()) {
      if (now - data.resetTime > windowMs) {
        requests.delete(key);
      }
    }

    // Obtener o crear entrada para la IP
    let ipData = requests.get(ip);
    if (!ipData) {
      ipData = {
        count: 0,
        resetTime: now
      };
      requests.set(ip, ipData);
    }

    // Resetear contador si ha pasado la ventana de tiempo
    if (now - ipData.resetTime > windowMs) {
      ipData.count = 0;
      ipData.resetTime = now;
    }

    // Incrementar contador
    ipData.count++;

    // Verificar límite
    if (ipData.count > maxRequests) {
      logger.warn('Rate limit excedido:', {
        ip,
        count: ipData.count,
        maxRequests,
        url: req.originalUrl
      });

      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas peticiones. Intenta de nuevo más tarde.',
        retryAfter: Math.ceil((windowMs - (now - ipData.resetTime)) / 1000)
      });
    }

    // Agregar headers de rate limiting
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - ipData.count),
      'X-RateLimit-Reset': new Date(ipData.resetTime + windowMs).toISOString()
    });

    next();
  };
}

export default {
  validate,
  validateSimulateForm,
  validateMultipleSubmissions,
  validateManualMessage,
  validateForceComplete,
  validateCleanupTestData,
  validatePropertiesQuery,
  validateSystemLogsQuery,
  validateUltraMSGWebhook,
  validateUUID,
  validatePropertyId,
  validateConversationId,
  validateTestId,
  sanitizeInput,
  createRateLimit
};