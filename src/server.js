/**
 * Servidor principal de la aplicación
 * Punto de entrada del sistema
 */
import { createServer } from 'http';
import appInstance from './app.js';
import { app as appConfig } from './config/index.js';
import logger from './config/logger.js';

class Server {
  constructor() {
    this.app = appInstance.getApp();
    this.port = appConfig.port;
    this.server = null;
  }

  /**
   * Iniciar servidor
   */
  async start() {
    try {
      logger.info('Iniciando servidor...');

      // Inicializar servicios externos
      await appInstance.initializeServices();

      // Crear servidor HTTP
      this.server = createServer(this.app);

      // Configurar eventos del servidor
      this.setupServerEvents();

      // Establecer referencia del servidor en la app
      appInstance.setServer(this.server);

      // Iniciar servidor
      await this.listen();

      // Mostrar información de inicio
      this.logStartupInfo();

      // Tareas de inicialización adicionales
      await this.performStartupTasks();

    } catch (error) {
      logger.error('Error al iniciar servidor:', error);
      process.exit(1);
    }
  }

  /**
   * Configurar eventos del servidor HTTP
   */
  setupServerEvents() {
    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Puerto ${this.port} ya está en uso`);
        process.exit(1);
      } else {
        logger.error('Error del servidor:', error);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      const bind = typeof address === 'string' 
        ? `pipe ${address}` 
        : `puerto ${address.port}`;
      
      logger.info(`Servidor escuchando en ${bind}`);
    });

    this.server.on('connection', (socket) => {
      // Configurar timeout para conexiones
      socket.setTimeout(30000); // 30 segundos
    });

    this.server.on('clientError', (error, socket) => {
      logger.warn('Error del cliente:', error.message);
      if (!socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });
  }

  /**
   * Iniciar escucha del servidor
   */
  async listen() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Mostrar información de inicio
   */
  logStartupInfo() {
    const startupInfo = {
      application: 'Bot WhatsApp Inmobiliario',
      version: '1.0.0',
      phase: 'FASE_1_CONVERSACIONAL',
      environment: process.env.NODE_ENV || 'development',
      port: this.port,
      processId: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      },
      timestamp: new Date().toISOString()
    };

    logger.info('🚀 Servidor iniciado exitosamente:', startupInfo);

    // Mostrar URLs importantes
    const baseUrl = `http://localhost:${this.port}`;
    logger.info('📍 URLs importantes:', {
      api: `${baseUrl}/api`,
      health: `${baseUrl}/api/health`,
      dashboard: `${baseUrl}/api/admin/dashboard`,
      simulator: `${baseUrl}/api/simulator/submit`,
      webhook: `${baseUrl}/api/webhooks/ultramsg`
    });

    // Mostrar configuración de fase
    logger.info('⚙️ Configuración FASE 1:', {
      formSimulation: '✅ Habilitado',
      whatsappIntegration: '✅ UltraMSG',
      aiProcessing: '✅ OpenAI GPT-4',
      ragSystem: '✅ Weaviate',
      documentProcessing: '✅ OCR + Sharp',
      emailNotifications: '✅ Resend',
      googleSheetsExport: '✅ Google Sheets API',
      realWebhook: '❌ Fase 2',
      backgroundChecks: '❌ Fase 2',
      pulppoIntegration: '❌ Fase 2'
    });
  }

  /**
   * Realizar tareas de inicialización adicionales
   */
  async performStartupTasks() {
    try {
      logger.info('Ejecutando tareas de inicialización...');

      // Limpiar conversaciones expiradas
      const { default: conversationManager } = await import('./core/conversationManager.js');
      const cleanedConversations = await conversationManager.cleanupExpiredConversations();
      if (cleanedConversations > 0) {
        logger.info(`Conversaciones expiradas limpiadas: ${cleanedConversations}`);
      }

      // Limpiar archivos temporales
      const { default: documentService } = await import('./services/documentService.js');
      const cleanedFiles = await documentService.cleanupTempFiles(24);
      if (cleanedFiles > 0) {
        logger.info(`Archivos temporales limpiados: ${cleanedFiles}`);
      }

      // Cargar base de conocimiento RAG si está vacía
      const { default: ragService } = await import('./services/ragService.js');
      const ragStats = await ragService.getKnowledgeStats();
      if (ragStats.totalDocuments === 0) {
        logger.info('Base de conocimiento RAG vacía, cargando datos iniciales...');
        // Aquí se puede cargar datos iniciales si es necesario
        // await this.loadInitialKnowledgeBase();
      }

      // Programar tareas recurrentes
      this.scheduleRecurringTasks();

      logger.info('Tareas de inicialización completadas');

    } catch (error) {
      logger.error('Error en tareas de inicialización:', error);
      // No detener el servidor por errores en tareas opcionales
    }
  }

  /**
   * Programar tareas recurrentes
   */
  scheduleRecurringTasks() {
    // Limpiar conversaciones expiradas cada hora
    setInterval(async () => {
      try {
        const { default: conversationManager } = await import('./core/conversationManager.js');
        const cleaned = await conversationManager.cleanupExpiredConversations();
        if (cleaned > 0) {
          logger.info(`Tarea recurrente: ${cleaned} conversaciones expiradas limpiadas`);
        }
      } catch (error) {
        logger.error('Error en tarea de limpieza de conversaciones:', error);
      }
    }, 60 * 60 * 1000); // Cada hora

    // Limpiar archivos temporales cada 6 horas
    setInterval(async () => {
      try {
        const { default: documentService } = await import('./services/documentService.js');
        const cleaned = await documentService.cleanupTempFiles(6);
        if (cleaned > 0) {
          logger.info(`Tarea recurrente: ${cleaned} archivos temporales limpiados`);
        }
      } catch (error) {
        logger.error('Error en tarea de limpieza de archivos:', error);
     }
   }, 6 * 60 * 60 * 1000); // Cada 6 horas

   // Log de estadísticas del sistema cada 30 minutos
   setInterval(async () => {
     try {
       const stats = {
         uptime: process.uptime(),
         memory: process.memoryUsage(),
         cpu: process.cpuUsage(),
         timestamp: new Date().toISOString()
       };

       logger.info('Estadísticas del sistema:', {
         uptime: `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`,
         memoryUsed: `${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`,
         memoryTotal: `${Math.round(stats.memory.heapTotal / 1024 / 1024)}MB`
       });

     } catch (error) {
       logger.error('Error en tarea de estadísticas:', error);
     }
   }, 30 * 60 * 1000); // Cada 30 minutos

   logger.info('Tareas recurrentes programadas');
 }

 /**
  * Cargar base de conocimiento inicial (opcional)
  */
 async loadInitialKnowledgeBase() {
   try {
     const { default: ragService } = await import('./services/ragService.js');
     
     // Datos iniciales básicos sobre el proceso inmobiliario
     const initialKnowledge = [
       {
         title: "Tiempo de proceso",
         content: "El proceso completo de registro y verificación toma entre 3-5 días hábiles: Revisión de documentos (24 horas), Verificación de antecedentes (2-3 días), Publicación una vez aprobado.",
         category: "proceso",
         tags: ["tiempo", "proceso", "verificacion"],
         source: "manual"
       },
       {
         title: "Documentos requeridos",
         content: "Se requieren los siguientes documentos: Certificado de Existencia y Representación Legal (obligatorio), Escritura Pública, Paz y Salvo de Administración (si aplica), Recibo de Servicios Públicos, Certificado de Tradición y Libertad, y mínimo 5 fotos del inmueble.",
         category: "documentos",
         tags: ["documentos", "requisitos", "certificados"],
         source: "manual"
       },
       {
         title: "Información requerida",
         content: "Necesitamos información completa sobre: características físicas (tipo, área, habitaciones, baños, parqueaderos, piso, estrato), información comercial (precio, negociabilidad, motivo de venta), y descripción detallada de mínimo 50 palabras.",
         category: "informacion",
         tags: ["informacion", "caracteristicas", "descripcion"],
         source: "manual"
       },
       {
         title: "Precios y costos",
         content: "El registro en nuestra plataforma no tiene costo inicial. Las comisiones se aplican únicamente cuando se concrete la venta de la propiedad. Los precios deben estar en pesos colombianos.",
         category: "precios",
         tags: ["precios", "costos", "comisiones"],
         source: "manual"
       },
       {
         title: "Soporte y contacto",
         content: "Nuestro equipo de soporte está disponible de lunes a viernes de 8:00 AM a 6:00 PM. Puedes contactarnos por WhatsApp durante el proceso de registro o por email para consultas adicionales.",
         category: "soporte",
         tags: ["soporte", "contacto", "horarios"],
         source: "manual"
       }
     ];

     await ragService.loadKnowledgeBase(initialKnowledge);
     logger.info('Base de conocimiento inicial cargada exitosamente');

   } catch (error) {
     logger.error('Error al cargar base de conocimiento inicial:', error);
   }
 }

 /**
  * Detener servidor gracefully
  */
 async stop() {
   return new Promise((resolve) => {
     if (this.server) {
       this.server.close(resolve);
     } else {
       resolve();
     }
   });
 }
}

// Función principal para iniciar el servidor
async function startServer() {
 try {
   const server = new Server();
   await server.start();
   
   return server;
 } catch (error) {
   logger.error('Error fatal al iniciar servidor:', error);
   process.exit(1);
 }
}

// Iniciar servidor solo si este archivo es ejecutado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
 startServer();
}

export default startServer;
export { Server };