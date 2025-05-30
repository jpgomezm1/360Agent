/**
 * Configuración específica de la base de datos Prisma
 */
import { PrismaClient } from '@prisma/client';
import { database } from './index.js';
import logger from './logger.js';

/**
 * Cliente Prisma singleton
 */
let prisma = null;

/**
 * Crear conexión a la base de datos
 */
export function createPrismaClient() {
  if (prisma) {
    return prisma;
  }

  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: database.url
        }
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ]
    });

    // Logging de queries en desarrollo
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Query ejecutada:', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`
        });
      });
    }

    // Logging de errores
    prisma.$on('error', (e) => {
      logger.error('Error en base de datos:', e);
    });

    logger.info('Cliente Prisma inicializado correctamente');
    return prisma;
  } catch (error) {
    logger.error('Error al inicializar Prisma:', error);
    throw error;
  }
}

/**
 * Cerrar conexión a la base de datos
 */
export async function closePrismaClient() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('Conexión a base de datos cerrada');
  }
}

/**
 * Verificar conexión a la base de datos
 */
export async function testDatabaseConnection() {
  try {
    const client = createPrismaClient();
    await client.$queryRaw`SELECT 1`;
    logger.info('Conexión a base de datos verificada');
    return true;
  } catch (error) {
    logger.error('Error al verificar conexión a base de datos:', error);
    return false;
  }
}

// Exportar cliente por defecto
export default createPrismaClient;