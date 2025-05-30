/**
 * Verificador de completitud de propiedades
 * Determina cuándo una propiedad está lista para exportar
 */
import createPrismaClient from '../config/database.js';
import logger from '../config/logger.js';
import fieldTracker from './fieldTracker.js';
import { requiredFields, validation } from '../config/index.js';
import { PROPERTY_STATES } from '../utils/constants.js';

class CompletionChecker {
  constructor() {
    this.prisma = createPrismaClient();
    this.requiredFields = requiredFields;
    this.validation = validation;
  }

  /**
   * Verificar completitud de una propiedad
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Object>} Estado de completitud
   */
  async checkCompleteness(propertyId) {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: { documentos: true }
      });

      if (!property) {
        throw new Error('Propiedad no encontrada');
      }

      // Verificar cada categoría de campos
      const physicalComplete = await this.checkPhysicalFields(property);
      const commercialComplete = await this.checkCommercialFields(property);
      const documentationComplete = await this.checkDocumentationFields(property);
      const descriptionComplete = await this.checkDescriptionFields(property);

      // Verificar criterios específicos de completitud
      const meetsMinimumRequirements = await this.checkMinimumRequirements(property);

      const isComplete = 
        physicalComplete.isComplete &&
        commercialComplete.isComplete &&
        documentationComplete.isComplete &&
        descriptionComplete.isComplete &&
        meetsMinimumRequirements.isValid;

      // Calcular porcentaje total
      const totalIssues = [
        ...physicalComplete.issues,
        ...commercialComplete.issues,
        ...documentationComplete.issues,
        ...descriptionComplete.issues,
        ...meetsMinimumRequirements.issues
      ];

      const totalRequiredItems = 
        physicalComplete.required +
        commercialComplete.required +
        documentationComplete.required +
        descriptionComplete.required;

      const completedItems = totalRequiredItems - totalIssues.length;
      const percentage = Math.round((completedItems / totalRequiredItems) * 100);

      logger.info('Verificación de completitud realizada', {
        propertyId,
        isComplete,
        percentage,
        totalIssues: totalIssues.length
      });

      return {
        isComplete,
        percentage,
        categories: {
          physical: physicalComplete,
          commercial: commercialComplete,
          documentation: documentationComplete,
          description: descriptionComplete
        },
        minimumRequirements: meetsMinimumRequirements,
        totalIssues,
        summary: this.generateCompletionSummary(property, isComplete, percentage)
      };

    } catch (error) {
      logger.error('Error al verificar completitud:', {
        propertyId,
        error: error.message
      });

      return {
        isComplete: false,
        percentage: 0,
        error: error.message
      };
    }
  }

  /**
   * Verificar campos físicos de la propiedad
   * @param {Object} property - Datos de la propiedad
   * @returns {Promise<Object>} Estado de campos físicos
   */
  async checkPhysicalFields(property) {
    const requiredPhysical = this.requiredFields.physical;
    const issues = [];
    
    for (const field of requiredPhysical) {
      // Verificar si el campo tiene valor
      if (!this.hasValidValue(property[field], field)) {
        issues.push(`Falta: ${this.getFieldLabel(field)}`);
        continue;
      }

      // Validación específica por campo
      const validation = await this.validateSpecificField(field, property[field], property);
      if (!validation.valid) {
        issues.push(`${this.getFieldLabel(field)}: ${validation.error}`);
      }
    }

    return {
      isComplete: issues.length === 0,
      required: requiredPhysical.length,
      completed: requiredPhysical.length - issues.length,
      issues,
      percentage: Math.round(((requiredPhysical.length - issues.length) / requiredPhysical.length) * 100)
    };
  }

  /**
   * Verificar campos comerciales
   * @param {Object} property - Datos de la propiedad
   * @returns {Promise<Object>} Estado de campos comerciales
   */
  async checkCommercialFields(property) {
    const requiredCommercial = this.requiredFields.commercial;
    const issues = [];
    
    for (const field of requiredCommercial) {
      if (!this.hasValidValue(property[field], field)) {
        issues.push(`Falta: ${this.getFieldLabel(field)}`);
        continue;
      }

      const validation = await this.validateSpecificField(field, property[field], property);
      if (!validation.valid) {
        issues.push(`${this.getFieldLabel(field)}: ${validation.error}`);
      }
    }

    return {
      isComplete: issues.length === 0,
      required: requiredCommercial.length,
      completed: requiredCommercial.length - issues.length,
      issues,
      percentage: Math.round(((requiredCommercial.length - issues.length) / requiredCommercial.length) * 100)
    };
  }

 /**
 * Verificar documentación
 * @param {Object} property - Datos de la propiedad
 * @returns {Promise<Object>} Estado de documentación
 */
async checkDocumentationFields(property) {
  const requiredDocs = this.requiredFields.documentation;
  const issues = [];
  
  // Verificar documentos obligatorios
  for (const docField of requiredDocs) {
    if (docField === 'fotos_inmueble') {
      const photosCount = property.fotos_inmueble || 0;
      if (photosCount < this.validation.minPhotos) {
        issues.push(`Faltan fotos: ${photosCount}/${this.validation.minPhotos} mínimo`);
      }
    } else {
      if (!property[docField]) {
        issues.push(`Falta documento: ${this.getFieldLabel(docField)}`);
      }
    }
  }

  // Verificar criterio de documentos mínimos
  const documentsReceived = requiredDocs.filter(doc => {
    if (doc === 'fotos_inmueble') {
      return (property.fotos_inmueble || 0) >= this.validation.minPhotos;
    }
    return property[doc];
  }).length;

  // FIX: usar this.validation en lugar de this.validationConfig
  if (documentsReceived < this.validation.minDocuments) {
    issues.push(`Documentos insuficientes: ${documentsReceived}/${this.validation.minDocuments} mínimo`);
  }

  return {
    isComplete: issues.length === 0,
    required: requiredDocs.length,
    completed: documentsReceived,
    issues,
    percentage: Math.round((documentsReceived / requiredDocs.length) * 100),
    documentsReceived,
    minRequired: this.validation.minDocuments
  };
}
 
  /**
   * Verificar campos de descripción
   * @param {Object} property - Datos de la propiedad
   * @returns {Promise<Object>} Estado de descripción
   */
  async checkDescriptionFields(property) {
    const requiredDescription = this.requiredFields.description;
    const issues = [];
    
    for (const field of requiredDescription) {
      if (!this.hasValidValue(property[field], field)) {
        issues.push(`Falta: ${this.getFieldLabel(field)}`);
        continue;
      }
 
      // Validación especial para descripción
      if (field === 'descripcion') {
        const wordCount = property[field].trim().split(/\s+/).length;
        if (wordCount < this.validationConfig.minDescriptionWords) {
          issues.push(`Descripción muy corta: ${wordCount}/${this.validationConfig.minDescriptionWords} palabras mínimo`);
        }
      }
    }
 
    return {
      isComplete: issues.length === 0,
      required: requiredDescription.length,
      completed: requiredDescription.length - issues.length,
      issues,
      percentage: Math.round(((requiredDescription.length - issues.length) / requiredDescription.length) * 100)
    };
  }
 
  /**
   * Verificar requisitos mínimos especiales
   * @param {Object} property - Datos de la propiedad
   * @returns {Promise<Object>} Estado de requisitos mínimos
   */
  async checkMinimumRequirements(property) {
    const issues = [];
 
    // Certificado de existencia es OBLIGATORIO
    if (!property.certificado_existencia) {
      issues.push('Certificado de Existencia y Representación Legal es obligatorio');
    }
 
    // Al menos 4 documentos adicionales
    const additionalDocs = [
      'escritura_publica',
      'paz_salvo_admin', 
      'recibo_servicios',
      'certificado_predial'
    ].filter(doc => property[doc]).length;
 
    if (additionalDocs < 4) {
      issues.push(`Documentos adicionales insuficientes: ${additionalDocs}/4 mínimo`);
    }
 
    // Mínimo de fotos
    const photosCount = property.fotos_inmueble || 0;
    if (photosCount < this.validationConfig.minPhotos) {
      issues.push(`Fotos insuficientes: ${photosCount}/${this.validationConfig.minPhotos} mínimo`);
    }
 
    // Descripción con mínimo de palabras
    if (property.descripcion) {
      const wordCount = property.descripcion.trim().split(/\s+/).length;
      if (wordCount < this.validationConfig.minDescriptionWords) {
        issues.push(`Descripción insuficiente: ${wordCount}/${this.validationConfig.minDescriptionWords} palabras mínimo`);
      }
    }
 
    // Validaciones de coherencia
    const coherenceIssues = await this.checkDataCoherence(property);
    issues.push(...coherenceIssues);
 
    return {
      isValid: issues.length === 0,
      issues,
      certificadoExistencia: !!property.certificado_existencia,
      documentosAdicionales: additionalDocs,
      fotosCount: photosCount,
      descripcionWords: property.descripcion ? property.descripcion.trim().split(/\s+/).length : 0
    };
  }
 
  /**
   * Verificar coherencia de datos
   * @param {Object} property - Datos de la propiedad
   * @returns {Promise<Array>} Lista de issues de coherencia
   */
  async checkDataCoherence(property) {
    const issues = [];
 
    // Verificar piso vs tipo de propiedad
    if (property.piso && !['apartamento', 'oficina'].includes(property.tipo_propiedad)) {
      issues.push('El piso solo aplica para apartamentos y oficinas');
    }
 
    // Verificar año de construcción vs estado
    if (property.ano_construccion && property.estado_propiedad) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - property.ano_construccion;
      
      if (property.estado_propiedad === 'nuevo' && age > 5) {
        issues.push('Una propiedad de más de 5 años no puede estar marcada como nueva');
      }
    }
 
    // Verificar área vs habitaciones (lógica básica)
    if (property.area_construida && property.habitaciones) {
      const areaPerRoom = property.area_construida / property.habitaciones;
      if (areaPerRoom < 8) { // Menos de 8m² por habitación es poco realista
        issues.push('El área por habitación parece muy pequeña, verificar datos');
      }
    }
 
    // Verificar precio vs área (precio por m²)
    if (property.precio_venta && property.area_construida) {
      const pricePerSqm = property.precio_venta / property.area_construida;
      if (pricePerSqm < 1000000) { // Menos de $1M por m² es sospechoso
        issues.push('El precio por metro cuadrado parece muy bajo, verificar');
      }
      if (pricePerSqm > 20000000) { // Más de $20M por m² es sospechoso
        issues.push('El precio por metro cuadrado parece muy alto, verificar');
      }
    }
 
    return issues;
  }
 
  /**
   * Validar campo específico
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor del campo
   * @param {Object} property - Datos completos de la propiedad
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateSpecificField(field, value, property) {
    // Reutilizar validaciones del fieldTracker
    try {
      return await fieldTracker.validateFieldValue(field, value, property);
    } catch (error) {
      return {
        valid: false,
        error: `Error al validar ${field}: ${error.message}`
      };
    }
  }
 
  /**
   * Verificar si un campo tiene valor válido
   * @param {*} value - Valor del campo
   * @param {string} field - Nombre del campo
   * @returns {boolean} True si tiene valor válido
   */
  hasValidValue(value, field) {
    return fieldTracker.hasValidValue(value, field);
  }
 
  /**
   * Obtener etiqueta amigable para un campo
   * @param {string} field - Nombre del campo
   * @returns {string} Etiqueta amigable
   */
  getFieldLabel(field) {
    const labels = {
      // Campos físicos
      tipo_propiedad: 'Tipo de propiedad',
      area_construida: 'Área construida',
      habitaciones: 'Habitaciones',
      banos: 'Baños',
      parqueaderos: 'Parqueaderos',
      piso: 'Piso',
      estrato: 'Estrato',
      ano_construccion: 'Año de construcción',
      estado_propiedad: 'Estado de la propiedad',
      
      // Campos comerciales
      precio_venta: 'Precio de venta',
      precio_negociable: 'Precio negociable',
      motivo_venta: 'Motivo de venta',
      tiempo_estimado_venta: 'Tiempo estimado de venta',
      acepta_credito: 'Acepta crédito',
      deudas_pendientes: 'Deudas pendientes',
      
      // Documentación
      certificado_existencia: 'Certificado de Existencia',
      escritura_publica: 'Escritura Pública',
      paz_salvo_admin: 'Paz y Salvo de Administración',
      recibo_servicios: 'Recibo de Servicios',
      certificado_predial: 'Certificado de Tradición y Libertad',
      fotos_inmueble: 'Fotos del inmueble',
      
      // Descripción
      descripcion: 'Descripción',
      caracteristicas_especiales: 'Características especiales',
      servicios_incluidos: 'Servicios incluidos',
      restricciones: 'Restricciones'
    };
 
    return labels[field] || field;
  }
 
  /**
   * Generar resumen de completitud
   * @param {Object} property - Datos de la propiedad
   * @param {boolean} isComplete - Si está completa
   * @param {number} percentage - Porcentaje de completitud
   * @returns {Object} Resumen
   */
  generateCompletionSummary(property, isComplete, percentage) {
    const summary = {
      propertyId: property.id,
      direccion: property.direccion_inmueble,
      ciudad: property.ciudad_inmueble,
      estado: property.estado_recoleccion,
      porcentaje: percentage,
      isComplete,
      timestamp: new Date().toISOString()
    };
 
    if (isComplete) {
      summary.message = '🎉 Propiedad completada exitosamente';
      summary.nextActions = [
        'Exportar a Google Sheets',
        'Enviar notificación por email',
        'Marcar conversación como completada',
        'Iniciar proceso de verificación'
      ];
    } else {
      summary.message = `📋 Completitud: ${percentage}%`;
      summary.nextActions = [
        'Continuar recolección de información',
        'Revisar campos faltantes',
        'Mantener conversación activa'
      ];
    }
 
    return summary;
  }
 
  /**
   * Verificar propiedades listas para completar
   * @returns {Promise<Array>} Lista de propiedades listas
   */
  async getPropertiesReadyToComplete() {
    try {
      const properties = await this.prisma.property.findMany({
        where: {
          estado_recoleccion: 'EN_PROGRESO',
          porcentaje_completitud: {
            gte: 95 // 95% o más de completitud
          }
        },
        include: {
          conversaciones: {
            where: { estado: 'ACTIVA' },
            take: 1
          }
        }
      });
 
      const readyProperties = [];
 
      for (const property of properties) {
        const completeness = await this.checkCompleteness(property.id);
        if (completeness.isComplete || completeness.percentage >= 98) {
          readyProperties.push({
            ...property,
            completeness
          });
        }
      }
 
      return readyProperties;
 
    } catch (error) {
      logger.error('Error al buscar propiedades listas para completar:', error);
      return [];
    }
  }
 
  /**
   * Marcar propiedad como completada
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Object>} Resultado de la operación
   */
  async markAsCompleted(propertyId) {
    try {
      // Verificar que realmente esté completa
      const completeness = await this.checkCompleteness(propertyId);
      
      if (!completeness.isComplete) {
        return {
          success: false,
          error: 'La propiedad no cumple con todos los requisitos de completitud',
          completeness
        };
      }
 
      // Marcar como completada
      const updatedProperty = await this.prisma.property.update({
        where: { id: propertyId },
        data: {
          estado_recoleccion: PROPERTY_STATES.COMPLETADO,
          porcentaje_completitud: 100,
          fecha_completado: new Date()
        }
      });
 
      // Cerrar conversaciones activas
      await this.prisma.conversation.updateMany({
        where: {
          property_id: propertyId,
          estado: 'ACTIVA'
        },
        data: {
          estado: 'COMPLETADA'
        }
      });
 
      logger.info('Propiedad marcada como completada', {
        propertyId,
        completeness: completeness.percentage
      });
 
      return {
        success: true,
        property: updatedProperty,
        completeness
      };
 
    } catch (error) {
      logger.error('Error al marcar propiedad como completada:', {
        propertyId,
        error: error.message
      });
 
      return {
        success: false,
        error: error.message
      };
    }
  }
 
  /**
   * Obtener estadísticas de completitud
   * @returns {Promise<Object>} Estadísticas
   */
  async getCompletionStats() {
    try {
      const totalProperties = await this.prisma.property.count();
      
      const completionDistribution = await this.prisma.property.groupBy({
        by: ['estado_recoleccion'],
        _count: { estado_recoleccion: true },
        _avg: { porcentaje_completitud: true }
      });
 
      const completedToday = await this.prisma.property.count({
        where: {
          estado_recoleccion: PROPERTY_STATES.COMPLETADO,
          fecha_completado: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
 
      const averageCompletionTime = await this.calculateAverageCompletionTime();
 
      return {
        totalProperties,
        completedToday,
        averageCompletionTime,
        distribution: completionDistribution.reduce((acc, item) => {
          acc[item.estado_recoleccion] = {
            count: item._count.estado_recoleccion,
            avgCompletion: Math.round(item._avg.porcentaje_completitud || 0)
          };
          return acc;
        }, {}),
        readyToComplete: (await this.getPropertiesReadyToComplete()).length
      };
 
    } catch (error) {
      logger.error('Error al obtener estadísticas de completitud:', error);
      return {
        totalProperties: 0,
        completedToday: 0,
        averageCompletionTime: 0,
        distribution: {},
        readyToComplete: 0
      };
    }
  }
 
  /**
   * Calcular tiempo promedio de completitud
   * @returns {Promise<number>} Tiempo promedio en horas
   */
  async calculateAverageCompletionTime() {
    try {
      const completedProperties = await this.prisma.property.findMany({
        where: {
          estado_recoleccion: PROPERTY_STATES.COMPLETADO,
          fecha_completado: { not: null }
        },
        select: {
          createdAt: true,
          fecha_completado: true
        },
        take: 100 // Últimas 100 para calcular promedio
      });
 
      if (completedProperties.length === 0) return 0;
 
      const totalTime = completedProperties.reduce((sum, property) => {
        const timeDiff = new Date(property.fecha_completado) - new Date(property.createdAt);
        return sum + timeDiff;
      }, 0);
 
      const averageMs = totalTime / completedProperties.length;
      const averageHours = averageMs / (1000 * 60 * 60);
 
      return Math.round(averageHours * 100) / 100; // Redondear a 2 decimales
 
    } catch (error) {
      logger.error('Error al calcular tiempo promedio de completitud:', error);
      return 0;
    }
  }
 
  /**
   * Generar reporte de completitud detallado
   * @param {string} propertyId - ID de la propiedad (opcional)
   * @returns {Promise<Object>} Reporte detallado
   */
  async generateCompletionReport(propertyId = null) {
    try {
      if (propertyId) {
        // Reporte para una propiedad específica
        const completeness = await this.checkCompleteness(propertyId);
        const property = await this.prisma.property.findUnique({
          where: { id: propertyId },
          include: {
            conversaciones: true,
            documentos: true
          }
        });
 
        return {
          type: 'individual',
          property,
          completeness,
          generatedAt: new Date().toISOString()
        };
      } else {
        // Reporte general
        const stats = await this.getCompletionStats();
        const readyProperties = await this.getPropertiesReadyToComplete();
        
        return {
          type: 'general',
          stats,
          readyProperties: readyProperties.length,
          generatedAt: new Date().toISOString()
        };
      }
 
    } catch (error) {
      logger.error('Error al generar reporte de completitud:', error);
      return {
        error: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }
 }
 
 // Crear instancia singleton
 const completionChecker = new CompletionChecker();
 
 export default completionChecker;