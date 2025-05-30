/**
 * Middleware de autenticación básica
 * FASE 1: Autenticación simple, expandir en fases futuras
 */
import logger from '../config/logger.js';

/**
 * Middleware de autenticación básica para endpoints de admin
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function basicAuth(req, res, next) {
  // En FASE 1, implementar autenticación básica simple
  // En fases futuras, implementar JWT, OAuth, etc.
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
      header: 'Authorization: Basic <credentials>'
    });
  }

  try {
    // Extraer credenciales
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Verificar credenciales (En producción, usar variables de entorno)
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== validUsername || password !== validPassword) {
      logger.warn('Intento de autenticación fallido:', {
        username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas'
      });
    }

    // Agregar información del usuario al request
    req.user = {
      username,
      role: 'admin',
      permissions: ['read', 'write', 'delete']
    };

    logger.info('Autenticación exitosa:', {
      username,
      ip: req.ip,
      url: req.originalUrl
    });

    next();

  } catch (error) {
    logger.error('Error en autenticación:', error);
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: 'Error en autenticación'
    });
  }
}

/**
 * Middleware de autenticación para webhooks
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function webhookAuth(req, res, next) {
  // Verificar que el webhook viene de una fuente confiable
  const userAgent = req.get('User-Agent');
  const ip = req.ip;

  // Lista de User-Agents permitidos (UltraMSG)
  const allowedUserAgents = [
    'UltraMsg',
    'WhatsApp',
    'curl', // Para pruebas
    'PostmanRuntime' // Para desarrollo
  ];

  // En desarrollo, permitir todas las peticiones
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Webhook auth - Modo desarrollo, permitiendo petición');
    return next();
  }

  // Verificar User-Agent
  const isValidUserAgent = allowedUserAgents.some(ua => 
    userAgent && userAgent.includes(ua)
  );

  if (!isValidUserAgent) {
    logger.warn('Webhook con User-Agent no autorizado:', {
      userAgent,
      ip,
      url: req.originalUrl
    });

    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Acceso no autorizado'
    });
  }

  // Verificar IP si está configurada
  const allowedIPs = process.env.WEBHOOK_ALLOWED_IPS?.split(',') || [];
  if (allowedIPs.length > 0 && !allowedIPs.includes(ip)) {
    logger.warn('Webhook desde IP no autorizada:', {
      ip,
      allowedIPs,
      url: req.originalUrl
    });

    return res.status(403).json({
      success: false,
      error: 'IP_NOT_ALLOWED',
      message: 'IP no autorizada'
    });
  }

  next();
}

/**
 * Middleware para verificar permisos específicos
 * @param {Array} requiredPermissions - Permisos requeridos
 * @returns {Function} Middleware de Express
 */
export function requirePermissions(requiredPermissions = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Usuario no autenticado'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermissions) {
      logger.warn('Acceso denegado por permisos insuficientes:', {
        user: req.user.username,
        required: requiredPermissions,
        userPermissions,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Permisos insuficientes',
        required: requiredPermissions
      });
    }

    next();
  };
}

/**
 * Middleware para generar API key temporal (desarrollo)
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 */
export function generateApiKey(req, res) {
  const apiKey = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
  
  logger.info('API Key temporal generada');

  return res.status(200).json({
    success: true,
    message: 'API Key temporal generada (solo para desarrollo)',
    apiKey,
    expiresIn: '24 horas',
    note: 'Esta funcionalidad es solo para desarrollo y pruebas'
  });
}

/**
 * Middleware de CORS personalizado
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
export function corsHandler(req, res, next) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://yourdomain.com',
    // Agregar dominios permitidos
  ];

  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}

export default {
  basicAuth,
  webhookAuth,
  requirePermissions,
  generateApiKey,
  corsHandler
};