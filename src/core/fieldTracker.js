/**
 * Seguimiento de campos y completitud de propiedades
 * Gestiona qué información se ha recopilado y qué falta
 */
import createPrismaClient from '../config/database.js';
import logger from '../config/logger.js';
import { requiredFields, validation } from '../config/index.js';
import { ERROR_CODES } from '../utils/constants.js';

class FieldTracker {
  constructor() {
    this.prisma = createPrismaClient();
    this.requiredFields = requiredFields;
    this.validation = validation;
  }

  /**
   * Actualizar campos de la propiedad con nueva información
   * @param {string} propertyId - ID de la propiedad
   * @param {Object} fieldData - Datos de campos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updatePropertyFields(propertyId, fieldData) {
    try {
      // Validar que la propiedad existe
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId }
      });

      if (!property) {
        throw new Error('Propiedad no encontrada');
      }

      // Filtrar y validar campos
      const validatedData = await this.validateAndProcessFields(fieldData, property);

      if (Object.keys(validatedData.validFields).length === 0) {
        return {
          success: false,
          error: 'No hay campos válidos para actualizar',
          issues: validatedData.issues
        };
      }

      // Actualizar propiedad
      const updatedProperty = await this.prisma.property.update({
        where: { id: propertyId },
        data: {
          ...validatedData.validFields,
          updatedAt: new Date()
        }
      });

      // Calcular nuevo porcentaje de completitud
      const completeness = await this.calculateCompleteness(propertyId);
      
      // Actualizar porcentaje
      await this.prisma.property.update({
        where: { id: propertyId },
        data: {
          porcentaje_completitud: completeness.percentage,
          estado_recoleccion: completeness.percentage === 100 ? 'COMPLETADO' : 'EN_PROGRESO'
        }
      });

      logger.info('Campos de propiedad actualizados exitosamente', {
        propertyId,
        updatedFields: Object.keys(validatedData.validFields),
        newCompleteness: completeness.percentage,
        issues: validatedData.issues
      });

      return {
        success: true,
        updatedFields: Object.keys(validatedData.validFields),
        completeness,
        issues: validatedData.issues,
        property: updatedProperty
      };

    } catch (error) {
      logger.error('Error al actualizar campos de propiedad:', {
        propertyId,
        fieldData,
        error: error.message
      });

      return {
        success: false,
        error: ERROR_CODES.DATABASE_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Validar y procesar campos antes de actualizar
   * @param {Object} fieldData - Datos de campos
   * @param {Object} property - Propiedad actual
   * @returns {Promise<Object>} Campos validados y issues
   */
  async validateAndProcessFields(fieldData, property) {
    const validFields = {};
    const issues = [];

    for (const [field, value] of Object.entries(fieldData)) {
      try {
        // Verificar si el campo es válido
        if (!this.isValidPropertyField(field)) {
          issues.push(`Campo no reconocido: ${field}`);
          continue;
        }

        // Validar valor según tipo de campo
        const validation = await this.validateFieldValue(field, value, property);
        
        if (validation.valid) {
          validFields[field] = validation.processedValue || value;
        } else {
          issues.push(`${field}: ${validation.error}`);
        }

      } catch (error) {
        issues.push(`Error validando ${field}: ${error.message}`);
      }
    }

    return { validFields, issues };
  }

  /**
   * Validar valor de campo específico
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a validar
   * @param {Object} property - Propiedad actual
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateFieldValue(field, value, property) {
    // Validaciones específicas por campo
    switch (field) {
      case 'tipo_propiedad':
        return this.validatePropertyType(value);
      
      case 'area_construida':
        return this.validateArea(value);
      
      case 'habitaciones':
        return this.validateRooms(value);
      
      case 'banos':
        return this.validateBathrooms(value);
      
      case 'parqueaderos':
        return this.validateParking(value);
      
      case 'piso':
        return this.validateFloor(value, property.tipo_propiedad);
      
      case 'estrato':
        return this.validateStratum(value);
      
      case 'ano_construccion':
        return this.validateConstructionYear(value);
      
      case 'estado_propiedad':
        return this.validatePropertyCondition(value);
      
      case 'precio_venta':
        return this.validatePrice(value);
      
      case 'precio_negociable':
      case 'acepta_credito':
        return this.validateBoolean(value);
      
      case 'tiempo_estimado_venta':
        return this.validateSaleTime(value);
      
      case 'descripcion':
        return this.validateDescription(value);
      
      default:
        // Validación básica para otros campos
        return this.validateGenericField(value);
    }
  }

  /**
   * Validar tipo de propiedad
   * @param {string} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validatePropertyType(value) {
    const validTypes = ['apartamento', 'casa', 'oficina', 'lote', 'bodega'];
    const normalizedValue = value.toLowerCase().trim();
    
    if (validTypes.includes(normalizedValue)) {
      return { valid: true, processedValue: normalizedValue };
    }
    
    return {
      valid: false,
      error: `Tipo de propiedad debe ser uno de: ${validTypes.join(', ')}`
    };
  }

  /**
   * Validar área construida
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateArea(value) {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El área debe ser un número' };
    }
    
    if (numValue < 10 || numValue > 10000) {
      return {
        valid: false,
        error: `El área debe estar entre 10 y 10,000 m²`
      };
    }
    
    return { valid: true, processedValue: Math.round(numValue) };
  }

  /**
   * Validar número de habitaciones
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateRooms(value) {
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El número de habitaciones debe ser un número entero' };
    }
    
    if (numValue < 0 || numValue > 20) {
      return {
        valid: false,
        error: `Las habitaciones deben estar entre 0 y 20`
      };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar número de baños
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateBathrooms(value) {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El número de baños debe ser un número' };
    }
    
    if (numValue < 0.5 || numValue > 10) {
      return {
        valid: false,
        error: `Los baños deben estar entre 0.5 y 10`
      };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar número de parqueaderos
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateParking(value) {
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El número de parqueaderos debe ser un número entero' };
    }
    
    if (numValue < 0 || numValue > 10) {
      return {
        valid: false,
        error: `Los parqueaderos deben estar entre 0 y 10`
      };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar número de piso
   * @param {*} value - Valor a validar
   * @param {string} propertyType - Tipo de propiedad
   * @returns {Object} Resultado de validación
   */
  validateFloor(value, propertyType) {
    // Solo aplicable para apartamentos y oficinas
    if (propertyType && !['apartamento', 'oficina'].includes(propertyType)) {
      return { valid: false, error: 'El piso solo aplica para apartamentos y oficinas' };
    }
    
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El piso debe ser un número entero' };
    }
    
    if (numValue < -5 || numValue > 100) {
      return {
        valid: false,
        error: `El piso debe estar entre -5 y 100`
      };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar estrato
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateStratum(value) {
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El estrato debe ser un número entero' };
    }
    
    if (numValue < 1 || numValue > 6) {
      return { valid: false, error: 'El estrato debe estar entre 1 y 6' };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar año de construcción
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateConstructionYear(value) {
    const numValue = parseInt(value);
    const currentYear = new Date().getFullYear();
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El año de construcción debe ser un número' };
    }
    
    if (numValue < 1900 || numValue > currentYear + 1) {
      return {
        valid: false,
        error: `El año de construcción debe estar entre 1900 y ${currentYear + 1}`
      };
    }
    
    return { valid: true, processedValue: numValue };
  }

  /**
   * Validar estado de la propiedad
   * @param {string} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validatePropertyCondition(value) {
    const validConditions = ['nuevo', 'usado', 'remodelar'];
    const normalizedValue = value.toLowerCase().trim();
    
    if (validConditions.includes(normalizedValue)) {
      return { valid: true, processedValue: normalizedValue };
    }
    
    return {
      valid: false,
      error: `El estado debe ser uno de: ${validConditions.join(', ')}`
    };
  }

  /**
   * Validar precio de venta
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validatePrice(value) {
    // Limpiar formato de precio (remover símbolos y separadores)
    let cleanValue = value.toString().replace(/[$,.]/g, '');
    const numValue = parseFloat(cleanValue);
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'El precio debe ser un número válido' };
    }
    
    if (numValue < 50000000 || numValue > 50000000000) {
      return {
        valid: false,
        error: `El precio debe estar entre $50,000,000 y $50,000,000,000`
      };
    }
    
    return { valid: true, processedValue: Math.round(numValue) };
  }

  /**
   * Validar valor booleano
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateBoolean(value) {
    if (typeof value === 'boolean') {
      return { valid: true, processedValue: value };
    }
    
    const stringValue = value.toString().toLowerCase().trim();
    const trueValues = ['sí', 'si', 'yes', 'true', '1', 'verdadero'];
    const falseValues = ['no', 'false', '0', 'falso'];
    
    if (trueValues.includes(stringValue)) {
      return { valid: true, processedValue: true };
    }
    
    if (falseValues.includes(stringValue)) {
      return { valid: true, processedValue: false };
    }
    
    return {
      valid: false,
      error: 'Responde con "sí" o "no"'
    };
  }

  /**
   * Validar tiempo estimado de venta
   * @param {string} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateSaleTime(value) {
    const validTimes = ['1-3 meses', '3-6 meses', '6-12 meses', 'más de 1 año'];
    const normalizedValue = value.toLowerCase().trim();
    
    // Buscar coincidencia aproximada
    for (const validTime of validTimes) {
      if (normalizedValue.includes(validTime.toLowerCase()) || 
          validTime.toLowerCase().includes(normalizedValue)) {
        return { valid: true, processedValue: validTime };
      }
    }
    
    return {
      valid: false,
      error: `El tiempo debe ser uno de: ${validTimes.join(', ')}`
    };
  }

  /**
   * Validar descripción
   * @param {string} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateDescription(value) {
    const trimmedValue = value.trim();
    const wordCount = trimmedValue.split(/\s+/).length;
    
    if (wordCount < this.validation.minDescriptionWords) {
      return {
        valid: false,
        error: `La descripción debe tener al menos ${this.validation.minDescriptionWords} palabras (actual: ${wordCount})`
      };
    }
    
    return { valid: true, processedValue: trimmedValue };
  }

  /**
   * Validación genérica para otros campos
   * @param {*} value - Valor a validar
   * @returns {Object} Resultado de validación
   */
  validateGenericField(value) {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: 'El campo no puede estar vacío' };
    }
    
    const trimmedValue = typeof value === 'string' ? value.trim() : value;
    return { valid: true, processedValue: trimmedValue };
  }

  /**
   * Verificar si un campo es válido para propiedades
   * @param {string} field - Nombre del campo
   * @returns {boolean} True si es válido
   */
  isValidPropertyField(field) {
    const allRequiredFields = [
      ...this.requiredFields.physical,
      ...this.requiredFields.commercial,
      ...this.requiredFields.documentation,
      ...this.requiredFields.description
    ];
    
    return allRequiredFields.includes(field);
  }

  /**
   * Obtener campos faltantes para una propiedad
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Array>} Lista de campos faltantes
   */
  async getMissingFields(propertyId) {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: { documentos: true }
      });

      if (!property) {
        throw new Error('Propiedad no encontrada');
      }

      const missingFields = [];

      // Verificar campos físicos
      for (const field of this.requiredFields.physical) {
        if (!this.hasValidValue(property[field], field)) {
          missingFields.push(field);
        }
      }

      // Verificar campos comerciales
      for (const field of this.requiredFields.commercial) {
        if (!this.hasValidValue(property[field], field)) {
          missingFields.push(field);
        }
      }

      // Verificar descripción
      for (const field of this.requiredFields.description) {
        if (!this.hasValidValue(property[field], field)) {
          missingFields.push(field);
        }
      }

      // Verificar documentos
      const documentFields = this.requiredFields.documentation;
      for (const docField of documentFields) {
        if (docField === 'fotos_inmueble') {
          if ((property.fotos_inmueble || 0) < this.validation.minPhotos) {
            missingFields.push(docField);
          }
        } else {
          if (!property[docField]) {
            missingFields.push(docField);
          }
        }
      }

      return missingFields;

    } catch (error) {
      logger.error('Error al obtener campos faltantes:', error);
      return [];
    }
  }

  /**
   * Verificar si un campo tiene un valor válido
   * @param {*} value - Valor del campo
   * @param {string} field - Nombre del campo
   * @returns {boolean} True si tiene valor válido
   */
  hasValidValue(value, field) {
    if (value === null || value === undefined) {
      return false;
    }

    // Para campos booleanos, verificar explícitamente
    if (field.includes('negociable') || field.includes('acepta') || field.includes('certificado') || field.includes('escritura')) {
      return typeof value === 'boolean';
    }

    // Para campos numéricos
    if (['area_construida', 'habitaciones', 'banos', 'parqueaderos', 'piso', 'estrato', 'ano_construccion', 'precio_venta'].includes(field)) {
      return !isNaN(parseFloat(value)) && isFinite(value);
    }

    // Para campos de texto
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  }

  /**
   * Calcular porcentaje de completitud
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Object>} Información de completitud
   */
  async calculateCompleteness(propertyId) {
    try {
      const missingFields = await this.getMissingFields(propertyId);
      const totalRequiredFields = 
        this.requiredFields.physical.length +
        this.requiredFields.commercial.length +
        this.requiredFields.documentation.length +
        this.requiredFields.description.length;

      const completedFields = totalRequiredFields - missingFields.length;
      const percentage = Math.round((completedFields / totalRequiredFields) * 100);

      // Calcular completitud por categorías
      const categoryCompleteness = await this.calculateCategoryCompleteness(propertyId);

      return {
        percentage,
        completedFields,
        totalRequiredFields,
        missingFields,
        isComplete: percentage === 100,
        categories: categoryCompleteness
      };

    } catch (error) {
      logger.error('Error al calcular completitud:', error);
      return {
        percentage: 0,
        completedFields: 0,
        totalRequiredFields: 0,
        missingFields: [],
        isComplete: false,
        categories: {}
      };
    }
  }

  /**
   * Calcular completitud por categorías
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Object>} Completitud por categorías
   */
  async calculateCategoryCompleteness(propertyId) {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: { documentos: true }
      });

      if (!property) return {};

      const categories = {};

      // Calcular para cada categoría
      for (const [categoryName, fields] of Object.entries({
        physical: this.requiredFields.physical,
        commercial: this.requiredFields.commercial,
        documentation: this.requiredFields.documentation,
        description: this.requiredFields.description
      })) {
        let completed = 0;
        
        for (const field of fields) {
          if (field === 'fotos_inmueble') {
            if ((property.fotos_inmueble || 0) >= this.validation.minPhotos) {
              completed++;
            }
          } else if (this.hasValidValue(property[field], field)) {
            completed++;
          }
        }

        categories[categoryName] = {
          completed,
          total: fields.length,
          percentage: Math.round((completed / fields.length) * 100)
        };
      }

      return categories;

    } catch (error) {
      logger.error('Error al calcular completitud por categorías:', error);
      return {};
    }
  }

  /**
   * Obtener resumen de estado de la propiedad
   * @param {string} propertyId - ID de la propiedad
   * @returns {Promise<Object>} Resumen del estado
   */
  async getPropertyStatus(propertyId) {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          conversaciones: {
            where: { estado: 'ACTIVA' },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          documentos: true
        }
      });

      if (!property) {
        return { error: 'Propiedad no encontrada' };
      }

      const completeness = await this.calculateCompleteness(propertyId);
      const missingFields = await this.getMissingFields(propertyId);

      return {
        property: {
          id: property.id,
          direccion: property.direccion_inmueble,
          ciudad: property.ciudad_inmueble,
          estado: property.estado_recoleccion,
          porcentaje: property.porcentaje_completitud
        },
        completeness,
        missingFields,
        hasActiveConversation: property.conversaciones.length > 0,
        documentsCount: property.documentos.length,
        photosCount: property.fotos_inmueble || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      };

    } catch (error) {
      logger.error('Error al obtener estado de propiedad:', error);
      return { error: error.message };
    }
  }

  /**
   * Obtener estadísticas generales de seguimiento
   * @returns {Promise<Object>} Estadísticas
   */
  async getTrackingStats() {
    try {
      const totalProperties = await this.prisma.property.count();
      
      const completionStats = await this.prisma.property.groupBy({
        by: ['estado_recoleccion'],
        _count: { estado_recoleccion: true },
        _avg: { porcentaje_completitud: true }
      });

      const averageCompletion = await this.prisma.property.aggregate({
        _avg: { porcentaje_completitud: true }
      });

      const recentActivity = await this.prisma.property.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
          }
        }
      });

      return {
        totalProperties,
        averageCompletion: Math.round(averageCompletion._avg.porcentaje_completitud || 0),
        recentActivity,
        byStatus: completionStats.reduce((acc, stat) => {
          acc[stat.estado_recoleccion] = {
            count: stat._count.estado_recoleccion,
            avgCompletion: Math.round(stat._avg.porcentaje_completitud || 0)
          };
          return acc;
        }, {})
      };

    } catch (error) {
      logger.error('Error al obtener estadísticas de seguimiento:', error);
      return {
        totalProperties: 0,
        averageCompletion: 0,
        recentActivity: 0,
        byStatus: {}
      };
    }
  }
}

// Crear instancia singleton
const fieldTracker = new FieldTracker();

export default fieldTracker;