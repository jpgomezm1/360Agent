/**
 * Controlador de administración
 * Endpoints para monitoreo y gestión del sistema
 */
import conversationManager from '../core/conversationManager.js';
import fieldTracker from '../core/fieldTracker.js';
import completionChecker from '../core/completionChecker.js';
import createPrismaClient from '../config/database.js';
import logger from '../config/logger.js';

class AdminController {
  constructor() {
    this.prisma = createPrismaClient();
  }

  /**
   * Dashboard general del sistema
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getDashboard(req, res) {
    try {
      // Obtener estadísticas de diferentes componentes
      const [
        conversationStats,
        trackingStats,
        completionStats,
        recentActivity
      ] = await Promise.all([
        conversationManager.getConversationStats(),
        fieldTracker.getTrackingStats(),
        completionChecker.getCompletionStats(),
        this.getRecentActivity()
      ]);

      const dashboard = {
        timestamp: new Date().toISOString(),
        system: {
          status: 'active',
          uptime: process.uptime(),
          version: '1.0.0-FASE1'
        },
        conversations: conversationStats,
        tracking: trackingStats,
        completion: completionStats,
        recentActivity
      };

      return res.status(200).json({
        success: true,
        dashboard
      });

    } catch (error) {
      logger.error('Error al obtener dashboard:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener lista de propiedades con filtros
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getProperties(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        estado,
        ciudad,
        completitud_min,
        completitud_max,
        fecha_desde,
        fecha_hasta
      } = req.query;

      // Construir filtros
      const where = {};
      
      if (estado) {
        where.estado_recoleccion = estado;
      }
      
      if (ciudad) {
        where.ciudad_inmueble = { contains: ciudad, mode: 'insensitive' };
      }
      
      if (completitud_min || completitud_max) {
        where.porcentaje_completitud = {};
        if (completitud_min) where.porcentaje_completitud.gte = parseInt(completitud_min);
        if (completitud_max) where.porcentaje_completitud.lte = parseInt(completitud_max);
      }
      
      if (fecha_desde || fecha_hasta) {
        where.createdAt = {};
        if (fecha_desde) where.createdAt.gte = new Date(fecha_desde);
        if (fecha_hasta) where.createdAt.lte = new Date(fecha_hasta);
      }

      // Calcular offset
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Obtener propiedades con paginación
      const [properties, totalCount] = await Promise.all([
        this.prisma.property.findMany({
          where,
          skip: offset,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            conversaciones: {
              where: { estado: 'ACTIVA' },
              take: 1,
              select: { id: true, ultimo_mensaje: true }
            },
            _count: {
              select: { documentos: true }
            }
          }
        }),
        this.prisma.property.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          properties,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalCount,
            totalPages,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      logger.error('Error al obtener propiedades:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener detalles de una propiedad específica
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getPropertyDetails(req, res) {
    try {
      const { propertyId } = req.params;

      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          conversaciones: {
            orderBy: { createdAt: 'desc' },
            include: {
              mensajes: {
                orderBy: { createdAt: 'desc' },
                take: 10
              }
            }
          },
          documentos: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Propiedad no encontrada'
        });
      }

      // Obtener información adicional
      const [propertyStatus, completeness] = await Promise.all([
        fieldTracker.getPropertyStatus(propertyId),
        completionChecker.checkCompleteness(propertyId)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          property,
          status: propertyStatus,
          completeness
        }
      });

    } catch (error) {
      logger.error('Error al obtener detalles de propiedad:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener conversaciones activas
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getActiveConversations(req, res) {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: { estado: 'ACTIVA' },
        include: {
          property: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              direccion_inmueble: true,
              ciudad_inmueble: true,
              porcentaje_completitud: true
            }
          },
          mensajes: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { ultimo_mensaje: 'desc' }
      });

      return res.status(200).json({
        success: true,
        data: {
          conversations,
          count: conversations.length
        }
      });

    } catch (error) {
      logger.error('Error al obtener conversaciones activas:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Forzar finalización de conversación
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async forceCompleteConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { reason = 'Completado manualmente por administrador' } = req.body;

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { property: true }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada'
        });
      }

      // Verificar completitud
      const completeness = await completionChecker.checkCompleteness(conversation.property_id);

      // Marcar como completada si cumple requisitos mínimos
      if (completeness.percentage >= 80) {
        await completionChecker.markAsCompleted(conversation.property_id);
      }

      // Cerrar conversación
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { 
          estado: 'COMPLETADA',
          contexto_actual: JSON.stringify({
            ...JSON.parse(conversation.contexto_actual || '{}'),
            completedBy: 'admin',
            reason,
            timestamp: new Date().toISOString()
          })
        }
      });

      logger.info('Conversación completada manualmente', {
        conversationId,
        propertyId: conversation.property_id,
        reason,
        completeness: completeness.percentage
      });

      return res.status(200).json({
        success: true,
        message: 'Conversación completada exitosamente',
        data: {
          conversationId,
          propertyId: conversation.property_id,
          completeness
        }
      });

    } catch (error) {
      logger.error('Error al completar conversación manualmente:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Enviar mensaje manual a conversación
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async sendManualMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { message, type = 'ADMIN' } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Mensaje requerido'
        });
      }

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { property: true }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada'
        });
      }

      // Enviar mensaje por WhatsApp
      const whatsappResult = await conversationManager.sendMessage(
        conversation.whatsapp_number,
        message
      );

      if (!whatsappResult.success) {
        throw new Error('Error al enviar mensaje por WhatsApp');
      }

      // Guardar mensaje en BD
      await conversationManager.saveMessage(
        conversationId,
        message,
        type,
        'ENVIADO',
        { sentBy: 'admin', manual: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        data: {
          conversationId,
          whatsappNumber: conversation.whatsapp_number,
          messageSent: message
        }
      });

    } catch (error) {
      logger.error('Error al enviar mensaje manual:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener logs del sistema
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getSystemLogs(req, res) {
    try {
      const {
        level = 'info',
        limit = 100,
        context,
        from,
        to
      } = req.query;

      // Esta es una implementación básica
      // En producción se conectaría con el sistema de logs real
      const logs = {
        level,
        limit: parseInt(limit),
        filters: { context, from, to },
        entries: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Sistema funcionando correctamente',
            context: 'system'
          }
        ],
        message: 'Logs simulados - implementar integración con Winston en producción'
      };

      return res.status(200).json({
        success: true,
        data: logs
      });

    } catch (error) {
      logger.error('Error al obtener logs del sistema:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Configuración del sistema
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getSystemConfig(req, res) {
    try {
      const config = {
        phase: 'FASE_1_CONVERSACIONAL',
        features: {
          formSimulation: true,
          whatsappIntegration: true,
          aiProcessing: true,
          ragSystem: true,
          documentProcessing: true,
          googleSheetsExport: true,
          emailNotifications: true,
          realWebhook: false,
          backgroundChecks: false,
          pulppoIntegration: false,
          autoPublication: false
        },
        limits: {
          maxConversationTimeout: 86400000, // 24 horas
          maxFileSize: 5242880, // 5MB
          minPhotos: 5,
          minDocuments: 5,
          minDescriptionWords: 50
        },
        integrations: {
          whatsapp: 'UltraMSG',
          ai: 'OpenAI GPT-4',
          rag: 'Weaviate',
          database: 'Neon PostgreSQL',
          email: 'Resend',
          sheets: 'Google Sheets API'
        }
      };

      return res.status(200).json({
        success: true,
        config
      });

    } catch (error) {
      logger.error('Error al obtener configuración del sistema:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Estadísticas de rendimiento
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getPerformanceStats(req, res) {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      const performance = {
        system: {
          uptime: {
            seconds: uptime,
            formatted: this.formatUptime(uptime)
          },
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          },
          cpu: {
            usage: process.cpuUsage()
          }
        },
        database: {
          status: 'connected',
          // Aquí se pueden agregar estadísticas específicas de la BD
        },
        cache: {
          activeConversations: conversationManager.activeConversations?.size || 0,
          activeTimeouts: conversationManager.timeouts?.size || 0
        }
      };

      return res.status(200).json({
        success: true,
        performance
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas de rendimiento:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener actividad reciente del sistema
   * @returns {Promise<Object>} Actividad reciente
   */
  async getRecentActivity() {
    try {
      const recentProperties = await this.prisma.property.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          direccion_inmueble: true,
          estado_recoleccion: true,
          porcentaje_completitud: true,
          updatedAt: true
        }
      });

      const recentConversations = await this.prisma.conversation.findMany({
        take: 10,
        orderBy: { ultimo_mensaje: 'desc' },
        select: {
          id: true,
          whatsapp_number: true,
          estado: true,
          ultimo_mensaje: true,
          property: {
            select: {
              nombre: true,
              apellido: true
            }
          }
        }
      });

      return {
        recentProperties,
        recentConversations,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error al obtener actividad reciente:', error);
      return {
        recentProperties: [],
        recentConversations: [],
        error: error.message
      };
    }
  }

  /**
   * Formatear tiempo de uptime
   * @param {number} seconds - Segundos de uptime
   * @returns {string} Tiempo formateado
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Health check del sistema
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async healthCheck(req, res) {
    try {
      // Verificar componentes críticos
      const checks = {
        database: false,
        whatsapp: false,
        ai: false,
        rag: false,
        email: false,
        sheets: false
      };

      // Verificar base de datos
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = true;
      } catch (error) {
        logger.error('Health check - Database failed:', error);
      }

      // Verificar otros servicios (implementar según necesidad)
      // checks.whatsapp = await whatsappService.validateService();
      // checks.ai = await aiService.checkConnection();
      // etc.

      const allHealthy = Object.values(checks).every(check => check === true);

      return res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        status: allHealthy ? 'healthy' : 'degraded',
        checks,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error en health check:', error);
      return res.status(503).json({
        success: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Crear instancia del controlador
const adminController = new AdminController();

export default adminController;