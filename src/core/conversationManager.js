/**
* Gestor central de conversaciones
* Orquesta toda la lógica de recolección de información
*/
import createPrismaClient from '../config/database.js';
import logger from '../config/logger.js';
import aiService from '../services/aiService.js';
import ragService from '../services/ragService.js';
import whatsappService from '../services/whatsappService.js';
import fieldTracker from './fieldTracker.js';
import completionChecker from './completionChecker.js';
import { 
 CONVERSATION_STATES, 
 MESSAGE_TYPES, 
 MESSAGE_DIRECTIONS,
 FIELD_COLLECTION_ORDER,
 FIELD_QUESTIONS,
 MESSAGE_TEMPLATES,
 ERROR_CODES,
 TIMEOUTS
} from '../utils/constants.js';

class ConversationManager {
 constructor() {
   this.prisma = createPrismaClient();
   this.activeConversations = new Map(); // Cache de conversaciones activas
   this.timeouts = new Map(); // Timeouts de conversaciones
 }

 /**
  * Iniciar nueva conversación para una propiedad
  * @param {Object} propertyData - Datos de la propiedad desde el formulario
  * @returns {Promise<Object>} Resultado de la inicialización
  */
 async initializeConversation(propertyData) {
   try {
     // Crear registro de propiedad - filtrar campos no válidos
     const { timestamp, ...validPropertyData } = propertyData;
     const property = await this.prisma.property.create({
       data: {
         ...validPropertyData,
         estado_recoleccion: 'INICIADO',
         porcentaje_completitud: 0
       }
     });

     // Crear conversación
     const conversation = await this.prisma.conversation.create({
       data: {
         property_id: property.id,
         whatsapp_number: propertyData.celular,
         estado: CONVERSATION_STATES.ACTIVA,
         contexto_actual: JSON.stringify({
           step: 'welcome',
           currentField: null,
           collectedFields: []
         })
       }
     });

     // Agregar a cache
     this.activeConversations.set(propertyData.celular, {
       conversationId: conversation.id,
       propertyId: property.id,
       state: 'welcome'
     });

     // Configurar timeout de inactividad
     this.setupConversationTimeout(propertyData.celular);

     // Enviar mensaje de bienvenida
     const welcomeMessage = this.generateWelcomeMessage(propertyData);
     await this.sendMessage(propertyData.celular, welcomeMessage);

     // Registrar mensaje del sistema
     await this.saveMessage(conversation.id, welcomeMessage, MESSAGE_TYPES.BOT, MESSAGE_DIRECTIONS.ENVIADO);

     logger.conversation('Conversación inicializada exitosamente', {
       propertyId: property.id,
       conversationId: conversation.id,
       whatsappNumber: propertyData.celular
     });

     return {
       success: true,
       propertyId: property.id,
       conversationId: conversation.id,
       message: 'Conversación iniciada exitosamente'
     };

   } catch (error) {
     logger.error('Error al inicializar conversación:', {
       propertyData,
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
  * Procesar mensaje recibido del usuario
  * @param {string} whatsappNumber - Número de WhatsApp
  * @param {string} message - Mensaje del usuario
  * @param {Object} metadata - Metadata adicional (archivos, etc.)
  * @returns {Promise<Object>} Resultado del procesamiento
  */
 async processUserMessage(whatsappNumber, message, metadata = {}) {
   try {
     // Obtener conversación activa
     const conversation = await this.getActiveConversation(whatsappNumber);
     if (!conversation) {
       return await this.handleUnknownUser(whatsappNumber, message);
     }

     // Actualizar timestamp de última actividad
     await this.updateConversationActivity(conversation.id);

     // Reiniciar timeout
     this.resetConversationTimeout(whatsappNumber);

     // Guardar mensaje del usuario
     await this.saveMessage(conversation.id, message, MESSAGE_TYPES.USER, MESSAGE_DIRECTIONS.RECIBIDO, metadata);

     // Detectar intención del mensaje
     const intention = await aiService.detectIntention(message);

     let response;
     if (intention.type === 'pregunta') {
       // El usuario está haciendo una pregunta - usar RAG
       response = await this.handleUserQuestion(conversation, message);
     } else {
       // El usuario está respondiendo - procesar información
       response = await this.handleUserResponse(conversation, message, metadata);
     }

     // Enviar respuesta y guardarla
     if (response.message) {
       await this.sendMessage(whatsappNumber, response.message);
       await this.saveMessage(conversation.id, response.message, MESSAGE_TYPES.BOT, MESSAGE_DIRECTIONS.ENVIADO);
     }

     return response;

   } catch (error) {
     logger.error('Error al procesar mensaje del usuario:', {
       whatsappNumber,
       message,
       error: error.message
     });

     // Enviar mensaje de error al usuario
     const errorMessage = MESSAGE_TEMPLATES.ERROR_GENERIC;
     await this.sendMessage(whatsappNumber, errorMessage);

     return {
       success: false,
       error: ERROR_CODES.AI_ERROR,
       message: error.message
     };
   }
 }

 /**
  * Manejar pregunta del usuario usando RAG
  * @param {Object} conversation - Datos de la conversación
  * @param {string} question - Pregunta del usuario
  * @returns {Promise<Object>} Respuesta generada
  */
 async handleUserQuestion(conversation, question) {
   try {
     // Generar respuesta usando RAG
     const ragResponse = await ragService.generateRAGResponse(question, {
       propertyId: conversation.property_id,
       conversationState: conversation.contexto_actual
     });

     // Agregar sugerencia para continuar si es apropiado
     const context = JSON.parse(conversation.contexto_actual);
     let fullResponse = ragResponse;

     if (context.currentField) {
       fullResponse += `\n\n¿Te gustaría continuar con ${FIELD_QUESTIONS[context.currentField]}`;
     }

     logger.conversation('Pregunta del usuario respondida con RAG', {
       conversationId: conversation.id,
       question,
       responseLength: fullResponse.length
     });

     return {
       success: true,
       message: fullResponse,
       type: 'question_response'
     };

   } catch (error) {
     logger.error('Error al manejar pregunta del usuario:', error);
     return {
       success: false,
       message: "Disculpa, no pude procesar tu pregunta. ¿Podrías reformularla?",
       type: 'error'
     };
   }
 }

 /**
  * Manejar respuesta del usuario con información de la propiedad
  * @param {Object} conversation - Datos de la conversación
  * @param {string} response - Respuesta del usuario
  * @param {Object} metadata - Metadata adicional
  * @returns {Promise<Object>} Resultado del procesamiento
  */
 async handleUserResponse(conversation, response, metadata) {
   try {
     const context = JSON.parse(conversation.contexto_actual);
     const property = await this.prisma.property.findUnique({
       where: { id: conversation.property_id }
     });

     if (!property) {
       throw new Error('Propiedad no encontrada');
     }

     // Interpretar respuesta usando AI (NO regex)
     const interpretation = await aiService.interpretUserResponse(
       response, 
       context.currentField,
       { 
         propertyType: property.tipo_propiedad,
         currentStep: context.step
       }
     );

     if (!interpretation.success) {
       return {
         success: false,
         message: "No pude entender tu respuesta. ¿Podrías ser más específico?",
         type: 'clarification_needed'
       };
     }

     // Actualizar información de la propiedad
     const updateResult = await fieldTracker.updatePropertyFields(
       property.id, 
       interpretation.data
     );

     if (!updateResult.success) {
       throw new Error('Error al actualizar campos de la propiedad');
     }

     // Determinar siguiente campo a recopilar
     const nextField = await this.getNextFieldToCollect(property.id);

     // Actualizar contexto de la conversación
     const updatedContext = {
       ...context,
       currentField: nextField,
       collectedFields: [...(context.collectedFields || []), ...Object.keys(interpretation.data)],
       lastUpdate: new Date().toISOString()
     };

     await this.prisma.conversation.update({
       where: { id: conversation.id },
       data: {
         contexto_actual: JSON.stringify(updatedContext),
         campo_actual: nextField
       }
     });

     // Verificar si está completo
     const completionStatus = await completionChecker.checkCompleteness(property.id);

     if (completionStatus.isComplete) {
       return await this.handleCompletedProperty(conversation, property);
     }

     // Generar respuesta para el siguiente campo
     const botResponse = await this.generateNextFieldResponse(interpretation.data, nextField, property);

     // Actualizar conversación en cache
     this.activeConversations.set(conversation.whatsapp_number, {
       conversationId: conversation.id,
       propertyId: property.id,
       state: 'collecting',
       currentField: nextField
     });

     logger.conversation('Respuesta del usuario procesada exitosamente', {
       conversationId: conversation.id,
       extractedFields: Object.keys(interpretation.data),
       nextField,
       completionPercentage: completionStatus.percentage
     });

     return {
       success: true,
       message: botResponse,
       type: 'field_collection',
       extractedData: interpretation.data,
       nextField,
       completionPercentage: completionStatus.percentage
     };

   } catch (error) {
     logger.error('Error al manejar respuesta del usuario:', error);
     return {
       success: false,
       message: "Hubo un error al procesar tu respuesta. ¿Puedes intentar de nuevo?",
       type: 'error'
     };
   }
 }

 /**
  * Manejar propiedad completada
  * @param {Object} conversation - Datos de la conversación
  * @param {Object} property - Datos de la propiedad
  * @returns {Promise<Object>} Resultado del procesamiento
  */
 async handleCompletedProperty(conversation, property) {
   try {
     // Marcar como completada
     await this.prisma.property.update({
       where: { id: property.id },
       data: {
         estado_recoleccion: 'COMPLETADO',
         fecha_completado: new Date(),
         porcentaje_completitud: 100
       }
     });

     // Cerrar conversación
     await this.prisma.conversation.update({
       where: { id: conversation.id },
       data: { estado: CONVERSATION_STATES.COMPLETADA }
     });

     // Remover de cache y cancelar timeout
     this.activeConversations.delete(conversation.whatsapp_number);
     this.clearConversationTimeout(conversation.whatsapp_number);

     // Exportar a Google Sheets y enviar notificación
     // (esto se ejecutará en background)
     this.processCompletedProperty(property.id).catch(error => {
       logger.error('Error en procesamiento de propiedad completada:', error);
     });

     logger.conversation('Propiedad completada exitosamente', {
       propertyId: property.id,
       conversationId: conversation.id
     });

     return {
       success: true,
       message: MESSAGE_TEMPLATES.COMPLETION,
       type: 'completion',
       propertyId: property.id
     };

   } catch (error) {
     logger.error('Error al manejar propiedad completada:', error);
     return {
       success: false,
       message: "¡Felicitaciones! Tu propiedad está completa. Nuestro equipo te contactará pronto.",
       type: 'completion'
     };
   }
 }

 /**
  * Procesar propiedad completada en background
  * @param {string} propertyId - ID de la propiedad
  */
 async processCompletedProperty(propertyId) {
   try {
     const property = await this.prisma.property.findUnique({
       where: { id: propertyId },
       include: {
         documentos: true
       }
     });

     if (!property) {
       throw new Error('Propiedad no encontrada para procesamiento');
     }

     // Importar servicios aquí para evitar dependencias circulares
     const { default: sheetsService } = await import('../services/sheetsService.js');
     const { default: emailService } = await import('../services/emailService.js');

     // Exportar a Google Sheets
     const sheetsResult = await sheetsService.exportPropertyData(property);
     if (!sheetsResult.success) {
       logger.error('Error al exportar a Google Sheets:', sheetsResult);
     }

     // Enviar notificación por email
     const emailResult = await emailService.sendCompletionNotification(property);
     if (!emailResult.success) {
       logger.error('Error al enviar notificación por email:', emailResult);
     }

     logger.info('Propiedad completada procesada exitosamente', {
       propertyId,
       sheetsExported: sheetsResult.success,
       emailSent: emailResult.success
     });

   } catch (error) {
     logger.error('Error al procesar propiedad completada:', {
       propertyId,
       error: error.message
     });
   }
 }

 /**
  * Generar mensaje de bienvenida personalizado
  * @param {Object} propertyData - Datos de la propiedad
  * @returns {string} Mensaje de bienvenida
  */
 generateWelcomeMessage(propertyData) {
   return MESSAGE_TEMPLATES.WELCOME
     .replace('{nombre}', propertyData.nombre)
     .replace('{direccion}', propertyData.direccion_inmueble)
     .replace('{ciudad}', propertyData.ciudad_inmueble);
 }

 /**
  * Generar respuesta para el siguiente campo
  * @param {Object} extractedData - Datos extraídos en esta iteración
  * @param {string} nextField - Siguiente campo a recopilar
  * @param {Object} property - Datos actuales de la propiedad
  * @returns {Promise<string>} Respuesta del bot
  */
 async generateNextFieldResponse(extractedData, nextField, property) {
   try {
     // Confirmar información recibida
     const confirmationParts = Object.entries(extractedData)
       .map(([field, value]) => this.formatFieldConfirmation(field, value))
       .filter(Boolean);

     let confirmation = '';
     if (confirmationParts.length > 0) {
       confirmation = `Perfecto, he registrado:\n${confirmationParts.join('\n')}\n\n`;
     }

     // Pregunta para el siguiente campo
     if (!nextField) {
       return confirmation + "¡Excelente! Vamos muy bien con la información. 👍";
     }

     // Verificar si necesita contexto especial (ej: piso solo para apartamentos)
     if (nextField === 'piso' && property.tipo_propiedad !== 'apartamento') {
       // Saltar este campo para casas/lotes/etc
       const subsequentField = await this.getNextFieldToCollect(property.id, [nextField]);
       if (subsequentField) {
         return confirmation + FIELD_QUESTIONS[subsequentField];
       }
     }

     return confirmation + FIELD_QUESTIONS[nextField];

   } catch (error) {
     logger.error('Error al generar respuesta del siguiente campo:', error);
     return `Perfecto. ${FIELD_QUESTIONS[nextField] || 'Continuemos con la siguiente información.'}`;
   }
 }

 /**
  * Formatear confirmación de campo
  * @param {string} field - Nombre del campo
  * @param {*} value - Valor del campo
  * @returns {string} Confirmación formateada
  */
 formatFieldConfirmation(field, value) {
   const fieldLabels = {
     tipo_propiedad: 'Tipo',
     area_construida: 'Área',
     habitaciones: 'Habitaciones',
     banos: 'Baños',
     parqueaderos: 'Parqueaderos',
     piso: 'Piso',
     estrato: 'Estrato',
     precio_venta: 'Precio'
   };

   const label = fieldLabels[field] || field;
   
   if (field === 'area_construida') {
     return `• ${label}: ${value} m²`;
   } else if (field === 'precio_venta') {
     return `• ${label}: $${new Intl.NumberFormat('es-CO').format(value)}`;
   } else if (typeof value === 'boolean') {
     return `• ${label}: ${value ? 'Sí' : 'No'}`;
   } else {
     return `• ${label}: ${value}`;
   }
 }

 /**
  * Obtener siguiente campo a recopilar
  * @param {string} propertyId - ID de la propiedad
  * @param {Array} skipFields - Campos a omitir
  * @returns {Promise<string|null>} Siguiente campo o null si está completo
  */
 async getNextFieldToCollect(propertyId, skipFields = []) {
   try {
     const property = await this.prisma.property.findUnique({
       where: { id: propertyId }
     });

     if (!property) return null;

     // Usar fieldTracker para determinar siguiente campo
     const missingFields = await fieldTracker.getMissingFields(propertyId);
     
     // Filtrar campos que se deben omitir
     const availableFields = missingFields.filter(field => !skipFields.includes(field));

     // Buscar el primer campo disponible en el orden de recolección
     for (const field of FIELD_COLLECTION_ORDER) {
       if (availableFields.includes(field)) {
         // Verificar contexto especial
         if (field === 'piso' && property.tipo_propiedad !== 'apartamento') {
           continue; // Saltar piso para no-apartamentos
         }
         return field;
       }
     }

     return null; // No hay más campos que recopilar

   } catch (error) {
     logger.error('Error al obtener siguiente campo:', error);
     return null;
   }
 }

 /**
  * Obtener conversación activa por número de WhatsApp
  * @param {string} whatsappNumber - Número de WhatsApp
  * @returns {Promise<Object|null>} Datos de la conversación
  */
 async getActiveConversation(whatsappNumber) {
   try {
     // Verificar cache primero
     const cached = this.activeConversations.get(whatsappNumber);
     if (cached) {
       // Verificar que la conversación sigue activa en BD
       const conversation = await this.prisma.conversation.findUnique({
         where: { id: cached.conversationId },
         include: { property: true }
       });

       if (conversation && conversation.estado === CONVERSATION_STATES.ACTIVA) {
         return conversation;
       } else {
         // Limpiar cache si ya no es válida
         this.activeConversations.delete(whatsappNumber);
       }
     }

     // Buscar en base de datos
     const conversation = await this.prisma.conversation.findFirst({
       where: {
         whatsapp_number: whatsappNumber,
         estado: CONVERSATION_STATES.ACTIVA
       },
       include: { property: true },
       orderBy: { createdAt: 'desc' }
     });

     if (conversation) {
       // Agregar a cache
       this.activeConversations.set(whatsappNumber, {
         conversationId: conversation.id,
         propertyId: conversation.property_id,
         state: 'active'
       });
     }

     return conversation;

   } catch (error) {
     logger.error('Error al obtener conversación activa:', error);
     return null;
   }
 }

 /**
  * Manejar usuario desconocido
  * @param {string} whatsappNumber - Número de WhatsApp
  * @param {string} message - Mensaje del usuario
  * @returns {Promise<Object>} Respuesta para usuario desconocido
  */
 async handleUnknownUser(whatsappNumber, message) {
   const unknownUserMessage = `Hola! 👋 

No tengo registro de una propiedad asociada a este número.

Si acabas de registrar una propiedad en nuestro formulario, por favor espera unos minutos mientras procesamos tu información.

Si necesitas ayuda, puedes contactar a nuestro equipo de soporte.`;

   await this.sendMessage(whatsappNumber, unknownUserMessage);

   logger.conversation('Mensaje de usuario desconocido', {
     whatsappNumber,
     message
   });

   return {
     success: true,
     message: unknownUserMessage,
     type: 'unknown_user'
   };
 }

 /**
  * Configurar timeout de conversación por inactividad
  * @param {string} whatsappNumber - Número de WhatsApp
  */
 setupConversationTimeout(whatsappNumber) {
   // Limpiar timeout existente si existe
   this.clearConversationTimeout(whatsappNumber);

   // Configurar nuevo timeout
   const timeoutId = setTimeout(async () => {
     await this.handleConversationTimeout(whatsappNumber);
   }, TIMEOUTS.CONVERSATION_INACTIVE);

   this.timeouts.set(whatsappNumber, timeoutId);
 }

 /**
  * Reiniciar timeout de conversación
  * @param {string} whatsappNumber - Número de WhatsApp
  */
 resetConversationTimeout(whatsappNumber) {
   this.setupConversationTimeout(whatsappNumber);
 }

 /**
  * Limpiar timeout de conversación
  * @param {string} whatsappNumber - Número de WhatsApp
  */
 clearConversationTimeout(whatsappNumber) {
   const timeoutId = this.timeouts.get(whatsappNumber);
   if (timeoutId) {
     clearTimeout(timeoutId);
     this.timeouts.delete(whatsappNumber);
   }
 }

 /**
  * Manejar timeout de conversación
  * @param {string} whatsappNumber - Número de WhatsApp
  */
 async handleConversationTimeout(whatsappNumber) {
   try {
     const conversation = await this.getActiveConversation(whatsappNumber);
     if (!conversation) return;

     // Marcar conversación como timeout
     await this.prisma.conversation.update({
       where: { id: conversation.id },
       data: { estado: CONVERSATION_STATES.TIMEOUT }
     });

     // Enviar mensaje de timeout
     const timeoutMessage = MESSAGE_TEMPLATES.TIMEOUT_WARNING
       .replace('{nombre}', conversation.property.nombre);

     await this.sendMessage(whatsappNumber, timeoutMessage);

     // Limpiar cache
     this.activeConversations.delete(whatsappNumber);
     this.timeouts.delete(whatsappNumber);

     logger.conversation('Conversación marcada como timeout', {
       conversationId: conversation.id,
       whatsappNumber
     });

   } catch (error) {
     logger.error('Error al manejar timeout de conversación:', error);
   }
 }

 /**
  * Actualizar actividad de conversación
  * @param {string} conversationId - ID de la conversación
  */
 async updateConversationActivity(conversationId) {
   try {
     await this.prisma.conversation.update({
       where: { id: conversationId },
       data: { ultimo_mensaje: new Date() }
     });
   } catch (error) {
     logger.error('Error al actualizar actividad de conversación:', error);
   }
 }

 /**
  * Guardar mensaje en base de datos
  * @param {string} conversationId - ID de la conversación
  * @param {string} content - Contenido del mensaje
  * @param {string} type - Tipo de mensaje
  * @param {string} direction - Dirección del mensaje
  * @param {Object} metadata - Metadata adicional
  */
 async saveMessage(conversationId, content, type, direction, metadata = {}) {
   try {
     await this.prisma.message.create({
       data: {
         conversation_id: conversationId,
         contenido: content,
         tipo: type,
         direccion: direction,
         metadata: metadata,
         procesado: false
       }
     });
   } catch (error) {
     logger.error('Error al guardar mensaje:', error);
   }
 }

 /**
  * Enviar mensaje por WhatsApp
  * @param {string} whatsappNumber - Número de WhatsApp
  * @param {string} message - Mensaje a enviar
  * @returns {Promise<Object>} Resultado del envío
  */
 async sendMessage(whatsappNumber, message) {
   try {
     return await whatsappService.sendMessageWithRetry(whatsappNumber, message);
   } catch (error) {
     logger.error('Error al enviar mensaje:', error);
     return { success: false, error: error.message };
   }
 }

 /**
  * Obtener estadísticas de conversaciones
  * @returns {Promise<Object>} Estadísticas
  */
 async getConversationStats() {
   try {
     const stats = await this.prisma.conversation.groupBy({
       by: ['estado'],
       _count: { estado: true }
     });

     const result = {
       total: 0,
       activas: 0,
       completadas: 0,
       timeout: 0
     };

     stats.forEach(stat => {
       result.total += stat._count.estado;
       switch (stat.estado) {
         case CONVERSATION_STATES.ACTIVA:
           result.activas = stat._count.estado;
           break;
         case CONVERSATION_STATES.COMPLETADA:
           result.completadas = stat._count.estado;
           break;
         case CONVERSATION_STATES.TIMEOUT:
           result.timeout = stat._count.estado;
           break;
       }
     });

     result.cacheSize = this.activeConversations.size;
     result.activeTimeouts = this.timeouts.size;

     return result;

   } catch (error) {
     logger.error('Error al obtener estadísticas de conversaciones:', error);
     return { total: 0, activas: 0, completadas: 0, timeout: 0, cacheSize: 0, activeTimeouts: 0 };
   }
 }

 /**
  * Limpiar conversaciones expiradas
  * @returns {Promise<number>} Número de conversaciones limpiadas
  */
 async cleanupExpiredConversations() {
   try {
     const expiredDate = new Date(Date.now() - TIMEOUTS.CONVERSATION_INACTIVE);
     
     const result = await this.prisma.conversation.updateMany({
       where: {
         estado: CONVERSATION_STATES.ACTIVA,
         ultimo_mensaje: {
           lt: expiredDate
         }
       },
       data: {
         estado: CONVERSATION_STATES.TIMEOUT
       }
     });

     logger.info('Conversaciones expiradas limpiadas', {
       cleanedCount: result.count
     });

     return result.count;

   } catch (error) {
     logger.error('Error al limpiar conversaciones expiradas:', error);
     return 0;
   }
 }
}

// Crear instancia singleton
const conversationManager = new ConversationManager();

export default conversationManager;