/**
 * Servicio de Inteligencia Artificial con OpenAI
 * Interpretación inteligente de respuestas (NO regex)
 */
import OpenAI from 'openai';
import { openai as openaiConfig } from '../config/index.js';
import logger from '../config/logger.js';
import { ERROR_CODES, FIELD_QUESTIONS, PROPERTY_TYPES, PROPERTY_CONDITIONS } from '../utils/constants.js';

class AIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: openaiConfig.apiKey,
      timeout: openaiConfig.timeout
    });
    
    this.model = openaiConfig.model;
  }

  /**
   * Función para extraer información de propiedades de respuestas del usuario
   * REGLA CRÍTICA: Usar GPT-4 con function calling, NUNCA regex
   */
  get extractPropertyInfoFunction() {
    return {
      name: "extract_property_info",
      description: "Extraer información de propiedades inmobiliarias de la respuesta del usuario",
      parameters: {
        type: "object",
        properties: {
          tipo_propiedad: {
            type: "string",
            enum: ["apartamento", "casa", "oficina", "lote", "bodega"],
            description: "Tipo de propiedad inmobiliaria"
          },
          area_construida: {
            type: "number",
            description: "Área construida en metros cuadrados"
          },
          habitaciones: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description: "Número de habitaciones/cuartos/alcobas"
          },
          banos: {
            type: "number",
            minimum: 0.5,
            maximum: 10,
            description: "Número de baños (puede ser decimal como 2.5)"
          },
          parqueaderos: {
            type: "integer",
            minimum: 0,
            maximum: 10,
            description: "Número de parqueaderos/garajes"
          },
          piso: {
            type: "integer",
            minimum: -5,
            maximum: 100,
            description: "Número de piso (solo para apartamentos)"
          },
          estrato: {
            type: "integer",
            minimum: 1,
            maximum: 6,
            description: "Estrato socioeconómico"
          },
          ano_construccion: {
            type: "integer",
            minimum: 1900,
            maximum: new Date().getFullYear() + 1,
            description: "Año de construcción aproximado"
          },
          estado_propiedad: {
            type: "string",
            enum: ["nuevo", "usado", "remodelar"],
            description: "Estado actual de la propiedad"
          },
          precio_venta: {
            type: "number",
            minimum: 50000000,
            description: "Precio de venta en pesos colombianos"
          },
          precio_negociable: {
            type: "boolean",
            description: "Si el precio es negociable"
          },
          motivo_venta: {
            type: "string",
            description: "Motivo por el cual se vende la propiedad"
          },
          tiempo_estimado_venta: {
            type: "string",
            enum: ["1-3 meses", "3-6 meses", "6-12 meses", "más de 1 año"],
            description: "Tiempo estimado para vender"
          },
          acepta_credito: {
            type: "boolean",
            description: "Si acepta crédito hipotecario"
          },
          deudas_pendientes: {
            type: "string",
            description: "Información sobre deudas pendientes"
          },
          descripcion: {
            type: "string",
            description: "Descripción detallada del inmueble"
          },
          caracteristicas_especiales: {
            type: "string",
            description: "Características especiales del inmueble"
          },
          servicios_incluidos: {
            type: "string",
            description: "Servicios públicos o amenidades incluidos"
          },
          restricciones: {
            type: "string",
            description: "Restricciones del inmueble"
          },
          documento_confirmado: {
            type: "boolean",
            description: "Si el usuario confirma tener un documento"
          },
          documento_tipo: {
            type: "string",
            enum: ["certificado_existencia", "escritura_publica", "paz_salvo_admin", "recibo_servicios", "certificado_predial"],
            description: "Tipo de documento mencionado"
          }
        }
      }
    };
  }

  /**
   * Interpretar respuesta del usuario usando GPT-4
   * @param {string} userMessage - Mensaje del usuario
   * @param {string} currentField - Campo que se está recolectando
   * @param {Object} context - Contexto adicional
   * @returns {Promise<Object>} Información extraída
   */
  async interpretUserResponse(userMessage, currentField = null, context = {}) {
    try {
      // Construir prompt contextual
      const systemPrompt = this.buildSystemPrompt(currentField, context);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        functions: [this.extractPropertyInfoFunction],
        function_call: { name: "extract_property_info" },
        temperature: 0.3, // Más determinístico para extracción
        max_tokens: 1000
      });

      const functionCall = response.choices[0]?.message?.function_call;
      
      if (!functionCall) {
        logger.ai('No se pudo extraer información de la respuesta', {
          userMessage,
          currentField
        });
        return { success: false, error: 'No se pudo interpretar la respuesta' };
      }

      const extractedData = JSON.parse(functionCall.arguments);
      
      logger.ai('Información extraída exitosamente', {
        userMessage,
        currentField,
        extractedData
      });

      return {
        success: true,
        data: extractedData,
        confidence: this.calculateConfidence(extractedData, currentField)
      };

    } catch (error) {
      logger.error('Error al interpretar respuesta del usuario:', {
        error: error.message,
        userMessage,
        currentField
      });

      return {
        success: false,
        error: ERROR_CODES.AI_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Construir prompt del sistema basado en el contexto
   * @param {string} currentField - Campo actual
   * @param {Object} context - Contexto adicional
   * @returns {string} Prompt del sistema
   */
  buildSystemPrompt(currentField, context) {
    let basePrompt = `
Eres un asistente especializado en extraer información de propiedades inmobiliarias de respuestas en lenguaje natural.

INSTRUCCIONES IMPORTANTES:
- Analiza cuidadosamente la respuesta del usuario
- Extrae SOLO la información que esté explícitamente mencionada
- Si no estás seguro, NO inventes información
- Respeta las unidades mencionadas (metros, millones, etc.)
- Maneja variaciones de lenguaje natural (cuartos=habitaciones, baños completos, etc.)

CONTEXTO COLOMBIANO:
- Los precios están en pesos colombianos
- Los estratos van del 1 al 6
- Es común decir "cuartos" en lugar de "habitaciones"
- Los baños pueden ser decimales (2.5 = 2 baños completos + 1 medio baño)
`;

    // Agregar contexto específico del campo actual
    if (currentField && FIELD_QUESTIONS[currentField]) {
      basePrompt += `\n\nCAMPO ACTUAL: ${currentField}
PREGUNTA REALIZADA: ${FIELD_QUESTIONS[currentField]}
Enfócate especialmente en extraer información relacionada con este campo.`;
    }

    // Agregar contexto de la propiedad si está disponible
    if (context.propertyType) {
      basePrompt += `\n\nTIPO DE PROPIEDAD: ${context.propertyType}
Ten en cuenta el tipo de propiedad al interpretar la respuesta.`;
    }

    return basePrompt;
  }

  /**
   * Calcular confianza en la extracción
   * @param {Object} extractedData - Datos extraídos
   * @param {string} currentField - Campo actual
   * @returns {number} Nivel de confianza (0-1)
   */
  calculateConfidence(extractedData, currentField) {
    let confidence = 0.5; // Base
    
    // Si se extrajo información del campo actual, aumentar confianza
    if (currentField && extractedData[currentField] !== undefined) {
      confidence += 0.3;
    }
    
    // Si se extrajeron múltiples campos, aumentar confianza
    const extractedFields = Object.keys(extractedData).filter(
      key => extractedData[key] !== undefined && extractedData[key] !== null
    );
    
    if (extractedFields.length > 1) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generar respuesta contextual del bot
   * @param {Object} extractedInfo - Información extraída
   * @param {string} nextField - Siguiente campo a preguntar
   * @param {Object} propertyData - Datos actuales de la propiedad
   * @returns {Promise<string>} Respuesta del bot
   */
  async generateBotResponse(extractedInfo, nextField, propertyData = {}) {
    try {
      const systemPrompt = `
Eres un asistente inmobiliario amigable que ayuda a recopilar información de propiedades.

PERSONALIDAD:
- Amigable y profesional
- Usa emojis apropiados
- Confirma la información recibida
- Pregunta por el siguiente campo de forma natural

INFORMACIÓN RECIBIDA: ${JSON.stringify(extractedInfo)}
SIGUIENTE CAMPO: ${nextField}
PREGUNTA PARA EL SIGUIENTE CAMPO: ${FIELD_QUESTIONS[nextField] || ''}

Genera una respuesta que:
1. Confirme brevemente la información recibida
2. Haga la pregunta del siguiente campo de forma natural
3. Sea concisa pero amigable
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera la respuesta apropiada" }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0]?.message?.content || this.getFallbackResponse(nextField);

    } catch (error) {
      logger.error('Error al generar respuesta del bot:', error);
      return this.getFallbackResponse(nextField);
    }
  }

  /**
   * Respuesta de respaldo si falla la generación
   * @param {string} nextField - Siguiente campo
   * @returns {string} Respuesta de respaldo
   */
  getFallbackResponse(nextField) {
    if (!nextField || !FIELD_QUESTIONS[nextField]) {
      return "Perfecto, continuemos con la siguiente información. 👍";
    }
    
    return `Perfecto. ${FIELD_QUESTIONS[nextField]}`;
  }

  /**
   * Detectar intención del usuario (pregunta vs respuesta)
   * @param {string} message - Mensaje del usuario
   * @returns {Promise<Object>} Tipo de intención
   */
  async detectIntention(message) {
    try {
      const systemPrompt = `
Analiza si el usuario está:
1. RESPONDIENDO a una pregunta sobre su propiedad
2. HACIENDO UNA PREGUNTA sobre el proceso
3. SALUDANDO o iniciando conversación
4. EXPRESANDO CONFUSION o pidiendo clarificación

Responde con un JSON: {"type": "respuesta|pregunta|saludo|confusion", "confidence": 0.0-1.0}
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"type": "respuesta", "confidence": 0.5}');
      
      logger.ai('Intención detectada', {
        message,
        intention: result
      });

      return result;

    } catch (error) {
      logger.error('Error al detectar intención:', error);
      return { type: 'respuesta', confidence: 0.5 };
    }
  }

  /**
   * Validar que la respuesta sea apropiada para el campo
   * @param {Object} extractedData - Datos extraídos
   * @param {string} field - Campo esperado
   * @returns {Object} Resultado de validación
   */
  validateFieldResponse(extractedData, field) {
    const value = extractedData[field];
    
    if (value === undefined || value === null) {
      return {
        valid: false,
        error: 'No se encontró información para este campo'
      };
    }

    // Validaciones específicas por campo
    switch (field) {
      case 'tipo_propiedad':
        return {
          valid: Object.values(PROPERTY_TYPES).includes(value),
          error: valid ? null : 'Tipo de propiedad no válido'
        };
      
      case 'area_construida':
        return {
          valid: typeof value === 'number' && value > 10 && value < 10000,
          error: valid ? null : 'El área debe estar entre 10 y 10,000 m²'
        };
      
      case 'habitaciones':
        return {
          valid: Number.isInteger(value) && value >= 0 && value <= 20,
          error: valid ? null : 'Las habitaciones deben ser un número entre 0 y 20'
        };
      
      case 'estrato':
        return {
          valid: Number.isInteger(value) && value >= 1 && value <= 6,
          error: valid ? null : 'El estrato debe ser un número entre 1 y 6'
        };
      
      default:
        return { valid: true, error: null };
    }
  }
}

// Crear instancia singleton
const aiService = new AIService();

export default aiService;