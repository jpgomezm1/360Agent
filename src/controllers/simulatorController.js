/**
 * Controlador para simular datos del formulario web
 * FASE 1: Solo simulación, no webhook real
 */
import conversationManager from '../core/conversationManager.js';
import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class SimulatorController {
  /**
   * Simular envío de formulario web
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async simulateFormSubmission(req, res) {
    try {
      const formData = req.body;
      
      // Validar datos requeridos del formulario
      const validation = this.validateFormData(formData);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Datos del formulario inválidos',
          issues: validation.issues
        });
      }

      // Preparar datos para el sistema
      const propertyData = this.preparePropertyData(formData);

      // Iniciar conversación automáticamente
      const result = await conversationManager.initializeConversation(propertyData);

      if (!result.success) {
        logger.error('Error al inicializar conversación desde simulador:', result);
        return res.status(500).json({
          success: false,
          error: 'Error al procesar el formulario',
          details: result
        });
      }

      logger.info('Formulario simulado procesado exitosamente', {
        propertyId: result.propertyId,
        conversationId: result.conversationId,
        whatsappNumber: propertyData.celular
      });

      return res.status(201).json({
        success: true,
        message: 'Formulario procesado exitosamente',
        data: {
          propertyId: result.propertyId,
          conversationId: result.conversationId,
          whatsappNumber: propertyData.celular,
          nextStep: 'WhatsApp conversation initiated'
        }
      });

    } catch (error) {
      logger.error('Error en simulador de formulario:', {
        error: error.message,
        body: req.body
      });

      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * Usar datos de ejemplo predefinidos
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async useExampleData(req, res) {
    try {
      const exampleData = this.getExampleFormData();
      
      // Procesar datos de ejemplo
      const result = await conversationManager.initializeConversation(exampleData);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: 'Error al procesar datos de ejemplo',
          details: result
        });
      }

      logger.info('Datos de ejemplo procesados exitosamente', {
        propertyId: result.propertyId,
        whatsappNumber: exampleData.celular
      });

      return res.status(201).json({
        success: true,
        message: 'Datos de ejemplo procesados exitosamente',
        data: {
          propertyId: result.propertyId,
          conversationId: result.conversationId,
          whatsappNumber: exampleData.celular,
          exampleData
        }
      });

    } catch (error) {
      logger.error('Error al procesar datos de ejemplo:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener datos de ejemplo predefinidos
   * @returns {Object} Datos de ejemplo del formulario
   */
  getExampleFormData() {
    return {
      nombre: "Juan Pablo",
      apellido: "Gómez",
      tipo_documento: "CC",
      numero_documento: "1006972309",
      pais: "Colombia", 
      celular: "573183351733",
      email: "juanpablog857@gmail.com",
      ciudad_inmueble: "Medellín",
      direccion_inmueble: "Carrera 70 # 45-32",
      matricula_inmobiliaria: `MAT${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtener múltiples conjuntos de datos de prueba
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getTestDataSets(req, res) {
    try {
      const testSets = [
        {
          id: 'test1',
          name: 'Apartamento Medellín',
          data: {
            nombre: "Juan Pablo",
            apellido: "Gómez", 
            tipo_documento: "CC",
            numero_documento: "1006972309",
            pais: "Colombia",
            celular: "573183351733",
            email: "juanpablog857@gmail.com",
            ciudad_inmueble: "Medellín",
            direccion_inmueble: "Carrera 70 # 45-32",
            matricula_inmobiliaria: `MAT${Date.now()}_1`
          }
        },
        {
          id: 'test2', 
          name: 'Casa Bogotá',
          data: {
            nombre: "María",
            apellido: "Rodríguez",
            tipo_documento: "CC", 
            numero_documento: "52789456",
            pais: "Colombia",
            celular: "573201234567",
            email: "maria.rodriguez@email.com",
            ciudad_inmueble: "Bogotá",
            direccion_inmueble: "Calle 85 # 15-20",
            matricula_inmobiliaria: `MAT${Date.now()}_2`
          }
        },
        {
          id: 'test3',
          name: 'Oficina Cali',
          data: {
            nombre: "Carlos",
            apellido: "Martínez",
            tipo_documento: "CC",
            numero_documento: "98765432", 
            pais: "Colombia",
            celular: "573157894561",
            email: "carlos.martinez@empresa.com",
            ciudad_inmueble: "Cali",
            direccion_inmueble: "Avenida 6N # 25-40",
            matricula_inmobiliaria: `MAT${Date.now()}_3`
          }
        }
      ];

      return res.status(200).json({
        success: true,
        testSets
      });

    } catch (error) {
      logger.error('Error al obtener conjuntos de prueba:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Procesar conjunto de datos de prueba específico
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async processTestDataSet(req, res) {
    try {
      const { testId } = req.params;
      const testSets = await this.getTestDataSets(req, res);
      
      if (!testSets.success) {
        return testSets; // Ya tiene formato de error
      }

      const testSet = testSets.testSets.find(set => set.id === testId);
      if (!testSet) {
        return res.status(404).json({
          success: false,
          error: 'Conjunto de datos de prueba no encontrado'
        });
      }

      // Procesar datos del conjunto de prueba
      const result = await conversationManager.initializeConversation(testSet.data);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: 'Error al procesar conjunto de prueba',
          details: result
        });
      }

      return res.status(201).json({
        success: true,
        message: `Conjunto de prueba "${testSet.name}" procesado exitosamente`,
        data: {
          testSet: testSet.name,
          propertyId: result.propertyId,
          conversationId: result.conversationId,
          whatsappNumber: testSet.data.celular
        }
      });

    } catch (error) {
      logger.error('Error al procesar conjunto de datos de prueba:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Validar datos del formulario simulado
   * @param {Object} formData - Datos del formulario
   * @returns {Object} Resultado de validación
   */
  validateFormData(formData) {
    const issues = [];
    const requiredFields = [
      'nombre', 'apellido', 'tipo_documento', 'numero_documento',
      'pais', 'celular', 'email', 'ciudad_inmueble', 
      'direccion_inmueble', 'matricula_inmobiliaria'
    ];

    // Verificar campos requeridos
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === '') {
        issues.push(`Campo requerido faltante: ${field}`);
      }
    }

    // Validaciones específicas
    if (formData.email && !this.isValidEmail(formData.email)) {
      issues.push('Email inválido');
    }

    if (formData.celular && !this.isValidPhone(formData.celular)) {
      issues.push('Número de celular inválido');
    }

    if (formData.numero_documento && !this.isValidDocument(formData.numero_documento)) {
      issues.push('Número de documento inválido');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Preparar datos de la propiedad para el sistema
   * @param {Object} formData - Datos del formulario
   * @returns {Object} Datos preparados para el sistema
   */
  preparePropertyData(formData) {
    return {
      // Información personal
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      tipo_documento: formData.tipo_documento.toUpperCase(),
      numero_documento: formData.numero_documento.trim(),
      pais: formData.pais.trim(),
      celular: this.formatPhoneNumber(formData.celular),
      email: formData.email.toLowerCase().trim(),
      
      // Información del inmueble
      ciudad_inmueble: formData.ciudad_inmueble.trim(),
      direccion_inmueble: formData.direccion_inmueble.trim(),
      matricula_inmobiliaria: formData.matricula_inmobiliaria.trim(),
      
      // Metadata
      timestamp: formData.timestamp || new Date().toISOString()
    };
  }

  /**
   * Formatear número de teléfono
   * @param {string} phone - Número de teléfono
   * @returns {string} Número formateado
   */
  formatPhoneNumber(phone) {
    // Remover caracteres no numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Si comienza con 57 y tiene 12 dígitos, mantener
    if (cleanPhone.startsWith('57') && cleanPhone.length === 12) {
      return cleanPhone;
    }
    
    // Si es número colombiano de 10 dígitos, agregar código de país
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      return `57${cleanPhone}`;
    }
    
    return cleanPhone;
  }

  /**
   * Validar email
   * @param {string} email - Email a validar
   * @returns {boolean} True si es válido
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validar número de teléfono
   * @param {string} phone - Número a validar
   * @returns {boolean} True si es válido
   */
  isValidPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Debe tener 10 dígitos (colombiano) o 12 (con código de país)
    if (cleanPhone.length === 10) {
      return cleanPhone.startsWith('3'); // Celulares colombianos empiezan con 3
    }
    
    if (cleanPhone.length === 12) {
        return cleanPhone.startsWith('573'); // Colombia + celular
    }
    
    return false;
  }
 
  /**
   * Validar número de documento
   * @param {string} document - Documento a validar
   * @returns {boolean} True si es válido
   */
  isValidDocument(document) {
    const cleanDoc = document.replace(/\D/g, '');
    return cleanDoc.length >= 6 && cleanDoc.length <= 12;
  }
 
  /**
   * Obtener estado del simulador
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getSimulatorStatus(req, res) {
    try {
      const conversationStats = await conversationManager.getConversationStats();
      
      const status = {
        active: true,
        mode: 'simulation',
        phase: 'FASE_1_CONVERSACIONAL',
        features: {
          formSimulation: true,
          whatsappIntegration: true,
          aiProcessing: true,
          ragSystem: true,
          documentProcessing: true,
          realWebhook: false // FASE 1 - solo simulación
        },
        statistics: conversationStats,
        timestamp: new Date().toISOString()
      };
 
      return res.status(200).json({
        success: true,
        status
      });
 
    } catch (error) {
      logger.error('Error al obtener estado del simulador:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
 
  /**
   * Limpiar datos de prueba
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async cleanupTestData(req, res) {
    try {
      const { confirm } = req.body;
      
      if (confirm !== 'DELETE_ALL_TEST_DATA') {
        return res.status(400).json({
          success: false,
          error: 'Confirmación requerida para eliminar datos de prueba',
          required: 'confirm: "DELETE_ALL_TEST_DATA"'
        });
      }
 
      const prisma = conversationManager.prisma;
      
      // Eliminar conversaciones de prueba (últimas 24 horas)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const deletedConversations = await prisma.conversation.deleteMany({
        where: {
          createdAt: { gte: cutoffDate }
        }
      });
 
      const deletedProperties = await prisma.property.deleteMany({
        where: {
          createdAt: { gte: cutoffDate }
        }
      });
 
      logger.info('Datos de prueba eliminados', {
        deletedConversations: deletedConversations.count,
        deletedProperties: deletedProperties.count
      });
 
      return res.status(200).json({
        success: true,
        message: 'Datos de prueba eliminados exitosamente',
        deleted: {
          conversations: deletedConversations.count,
          properties: deletedProperties.count
        }
      });
 
    } catch (error) {
      logger.error('Error al limpiar datos de prueba:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
 
  /**
   * Simular múltiples envíos para pruebas de carga
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async simulateMultipleSubmissions(req, res) {
    try {
      const { count = 5, delay = 1000 } = req.body;
      
      if (count > 20) {
        return res.status(400).json({
          success: false,
          error: 'Máximo 20 envíos simultáneos permitidos'
        });
      }
 
      const results = [];
      
      for (let i = 0; i < count; i++) {
        try {
          // Generar datos únicos para cada envío
          const testData = {
            ...this.getExampleFormData(),
            nombre: `Usuario${i + 1}`,
            numero_documento: `100000000${i}`,
            celular: `57300000000${i}`,
            email: `test${i + 1}@example.com`,
            matricula_inmobiliaria: `MAT${Date.now()}_${i}`
          };
 
          const result = await conversationManager.initializeConversation(testData);
          results.push({
            index: i + 1,
            success: result.success,
            propertyId: result.propertyId,
            conversationId: result.conversationId,
            data: testData
          });
 
          // Delay entre envíos si se especifica
          if (delay > 0 && i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
 
        } catch (error) {
          results.push({
            index: i + 1,
            success: false,
            error: error.message
          });
        }
      }
 
      const successCount = results.filter(r => r.success).length;
      
      logger.info('Simulación múltiple completada', {
        total: count,
        successful: successCount,
        failed: count - successCount
      });
 
      return res.status(200).json({
        success: true,
        message: `Simulación completada: ${successCount}/${count} exitosos`,
        results,
        summary: {
          total: count,
          successful: successCount,
          failed: count - successCount
        }
      });
 
    } catch (error) {
      logger.error('Error en simulación múltiple:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
 }
 
 // Crear instancia del controlador
 const simulatorController = new SimulatorController();
 
 export default simulatorController;