/**
 * Configuración de Winston Logger
 * Logging centralizado para toda la aplicación
 */
import winston from 'winston';

// Configuración de formatos
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Configuración de transports
const transports = [
  // Console transport para desarrollo
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`;
      })
    )
  })
];

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

/**
 * Métodos de utilidad para logging contextual
 */
logger.whatsapp = (message, meta = {}) => {
  logger.info(message, { context: 'whatsapp', ...meta });
};

logger.ai = (message, meta = {}) => {
  logger.info(message, { context: 'ai', ...meta });
};

logger.rag = (message, meta = {}) => {
  logger.info(message, { context: 'rag', ...meta });
};

logger.conversation = (message, meta = {}) => {
  logger.info(message, { context: 'conversation', ...meta });
};

logger.database = (message, meta = {}) => {
  logger.info(message, { context: 'database', ...meta });
};

export default logger;