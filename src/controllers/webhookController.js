/**
 * Controlador para webhooks de UltraMSG (WhatsApp)
 * Procesa mensajes entrantes y archivos recibidos
 */
import conversationManager from '../core/conversationManager.js';
import documentService from '../services/documentService.js';
import logger from '../config/logger.js';
import { MESSAGE_TYPES, ERROR_CODES, DOCUMENT_TYPES } from '../utils/constants.js';

class WebhookController {
  /**
   * Manejar webhook de UltraMSG
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async handleUltraMSGWebhook(req, res) {
    try {
      logger.whatsapp('Webhook recibido de UltraMSG', {
        body: req.body,
        headers: req.headers
      });

      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Datos de webhook inválidos'
        });
      }

      // Verificar que es un mensaje entrante (no enviado por el bot)
      if (data.type === 'sent') {
        logger.whatsapp('Mensaje enviado por el bot, ignorando webhook');
        return res.status(200).json({ success: true, message: 'Mensaje enviado ignorado' });
      }

      // Extraer información del mensaje
      const messageData = this.extractMessageData(data);
      
      if (!messageData) {
        logger.whatsapp('Tipo de mensaje no soportado', { type: data.type });
        return res.status(200).json({ success: true, message: 'Tipo de mensaje no soportado' });
      }

      // Procesar mensaje según su tipo
      let result;
      switch (messageData.type) {
        case 'text':
          result = await this.processTextMessage(messageData);
          break;
        case 'document':
        case 'image':
          result = await this.processDocumentMessage(messageData);
          break;
        case 'audio':
        case 'video':
          result = await this.processMediaMessage(messageData);
          break;
        default:
          logger.whatsapp('Tipo de mensaje no manejado', { type: messageData.type });
          return res.status(200).json({ success: true, message: 'Tipo de mensaje no manejado' });
      }

      logger.whatsapp('Mensaje procesado exitosamente', {
        whatsappNumber: messageData.from,
        type: messageData.type,
        result: result.success
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook procesado exitosamente',
        result
      });

    } catch (error) {
      logger.error('Error al procesar webhook de UltraMSG:', {
        error: error.message,
        body: req.body
      });

      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Extraer datos del mensaje desde el webhook
   * @param {Object} data - Datos del webhook
   * @returns {Object|null} Datos del mensaje extraídos
   */
  extractMessageData(data) {
    try {
      // Estructura común para todos los tipos de mensaje
      const baseData = {
        id: data.id,
        from: data.from,
        timestamp: data.timestamp || Date.now(),
        chatId: data.chatId
      };

      switch (data.type) {
        case 'text':
          return {
            ...baseData,
            type: 'text',
            message: data.body || data.text,
            metadata: {}
          };

        case 'document':
          return {
            ...baseData,
            type: 'document',
            message: data.caption || 'Documento recibido',
            metadata: {
              filename: data.filename,
              url: data.body,
              mimeType: data.mimetype,
              size: data.size
            }
          };

        case 'image':
          return {
            ...baseData,
            type: 'image',
            message: data.caption || 'Imagen recibida',
            metadata: {
              filename: data.filename || `image_${Date.now()}.jpg`,
              url: data.body,
              mimeType: data.mimetype || 'image/jpeg',
              size: data.size
            }
          };

        case 'audio':
          return {
            ...baseData,
            type: 'audio',
            message: 'Audio recibido (no procesado automáticamente)',
            metadata: {
              filename: data.filename || `audio_${Date.now()}.ogg`,
              url: data.body,
              mimeType: data.mimetype,
              duration: data.duration,
              size: data.size
            }
          };

        case 'video':
          return {
            ...baseData,
            type: 'video',
            message: data.caption || 'Video recibido (no procesado automáticamente)',
            metadata: {
              filename: data.filename || `video_${Date.now()}.mp4`,
              url: data.body,
              mimeType: data.mimetype,
              duration: data.duration,
              size: data.size
            }
          };

        default:
          return null;
      }

    } catch (error) {
      logger.error('Error al extraer datos del mensaje:', error);
      return null;
    }
  }

  /**
   * Procesar mensaje de texto
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processTextMessage(messageData) {
    try {
      const result = await conversationManager.processUserMessage(
        messageData.from,
        messageData.message,
        messageData.metadata
      );

      return {
        success: true,
        type: 'text_processed',
        result
      };

    } catch (error) {
      logger.error('Error al procesar mensaje de texto:', error);
      return {
        success: false,
        error: ERROR_CODES.AI_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Procesar mensaje con documento o imagen
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processDocumentMessage(messageData) {
    try {
      // Obtener conversación activa para determinar el contexto
      const conversation = await conversationManager.getActiveConversation(messageData.from);
      
      if (!conversation) {
        // Si no hay conversación activa, informar al usuario
        await conversationManager.handleUnknownUser(messageData.from, 'Documento recibido');
        return {
          success: false,
          error: 'No hay conversación activa para procesar el documento'
        };
      }

      // Determinar tipo de documento basado en el contexto
      const documentType = this.detectDocumentType(messageData, conversation);

      // Procesar documento
      const documentResult = await documentService.processDocument(
        {
          filename: messageData.metadata.filename,
          url: messageData.metadata.url,
          size: messageData.metadata.size,
          mimeType: messageData.metadata.mimeType
        },
        conversation.property_id,
        documentType
      );

      if (!documentResult.success) {
        // Informar al usuario sobre el error
        await conversationManager.sendMessage(
          messageData.from,
          `❌ No pude procesar el documento: ${documentResult.message}`
        );
        
        return documentResult;
      }

      // Actualizar registro del documento en la propiedad
      await this.updatePropertyDocument(conversation.property_id, documentType, documentResult);

      // Confirmar recepción al usuario
      const confirmationMessage = this.generateDocumentConfirmation(documentType, documentResult);
      await conversationManager.sendMessage(messageData.from, confirmationMessage);

      // Si es una imagen/foto, procesar como respuesta de conversación también
      if (messageData.type === 'image') {
        await conversationManager.processUserMessage(
          messageData.from,
          messageData.message,
          {
            ...messageData.metadata,
            documentProcessed: true,
            documentType
          }
        );
      }

      return {
        success: true,
        type: 'document_processed',
        documentType,
        documentResult
      };

    } catch (error) {
      logger.error('Error al procesar documento:', error);
      return {
        success: false,
        error: ERROR_CODES.FILE_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Procesar mensaje de audio/video
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processMediaMessage(messageData) {
    try {
      // Por ahora, solo informar que se recibió el medio
      const mediaType = messageData.type === 'audio' ? 'audio' : 'video';
      const message = `He recibido tu ${mediaType}. Por el momento no puedo procesar archivos de ${mediaType} automáticamente. 

¿Podrías enviar la información por texto o como documento/imagen?`;

      await conversationManager.sendMessage(messageData.from, message);

      return {
        success: true,
        type: 'media_received',
        mediaType,
        message: 'Medio recibido pero no procesado'
      };

    } catch (error) {
      logger.error('Error al procesar mensaje multimedia:', error);
      return {
        success: false,
        error: ERROR_CODES.FILE_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Detectar tipo de documento basado en contexto
   * @param {Object} messageData - Datos del mensaje
   * @param {Object} conversation - Conversación activa
   * @returns {string} Tipo de documento detectado
   */
  detectDocumentType(messageData, conversation) {
    const filename = messageData.metadata.filename?.toLowerCase() || '';
    const caption = messageData.message?.toLowerCase() || '';
    const context = JSON.parse(conversation.contexto_actual || '{}');

    // Detectar por nombre de archivo o caption
    if (filename.includes('existencia') || caption.includes('existencia')) {
      return DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA;
    }
    if (filename.includes('escritura') || caption.includes('escritura')) {
      return DOCUMENT_TYPES.ESCRITURA_PUBLICA;
    }
    if (filename.includes('paz') || caption.includes('paz') || caption.includes('salvo')) {
      return DOCUMENT_TYPES.PAZ_SALVO_ADMIN;
    }
    if (filename.includes('servicio') || caption.includes('servicio') || caption.includes('recibo')) {
      return DOCUMENT_TYPES.RECIBO_SERVICIOS;
    }
    if (filename.includes('predial') || caption.includes('predial') || caption.includes('tradicion')) {
      return DOCUMENT_TYPES.CERTIFICADO_PREDIAL;
    }

    // Si es imagen y no se detectó otro tipo, asumir que es foto del inmueble
    if (messageData.type === 'image') {
      return DOCUMENT_TYPES.FOTOS_INMUEBLE;
    }

    // Detectar por contexto de conversación
    if (context.currentField && context.currentField.includes('certificado')) {
      return DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA;
    }

    // Por defecto, tratar como documento general
    return DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA;
  }

  /**
   * Actualizar registro de documento en la propiedad
   * @param {string} propertyId - ID de la propiedad
   * @param {string} documentType - Tipo de documento
   * @param {Object} documentResult - Resultado del procesamiento
   */
  async updatePropertyDocument(propertyId, documentType, documentResult) {
    try {
      const prisma = conversationManager.prisma;

      // Crear registro del documento
      await prisma.document.create({
        data: {
          property_id: propertyId,
          nombre: documentResult.filename,
          tipo: documentType,
          ruta: documentResult.path,
          tamano: documentResult.fileSize,
          procesado: true,
          ocr_texto: documentResult.extractedText || null
        }
      });

      // Actualizar campo correspondiente en la propiedad
      const updateData = {};
      
      if (documentType === DOCUMENT_TYPES.FOTOS_INMUEBLE) {
        // Incrementar contador de fotos
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
          select: { fotos_inmueble: true }
        });
        
        updateData.fotos_inmueble = (property.fotos_inmueble || 0) + 1;
      } else {
        // Marcar documento como recibido
        updateData[documentType] = true;
      }

      await prisma.property.update({
        where: { id: propertyId },
        data: updateData
      });

      logger.info('Documento registrado exitosamente', {
        propertyId,
        documentType,
        filename: documentResult.filename
      });

    } catch (error) {
      logger.error('Error al actualizar registro de documento:', error);
    }
  }

  /**
   * Generar mensaje de confirmación de documento
   * @param {string} documentType - Tipo de documento
   * @param {Object} documentResult - Resultado del procesamiento
   * @returns {string} Mensaje de confirmación
   */
  generateDocumentConfirmation(documentType, documentResult) {
    const documentLabels = {
      [DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA]: 'Certificado de Existencia y Representación Legal',
      [DOCUMENT_TYPES.ESCRITURA_PUBLICA]: 'Escritura Pública',
      [DOCUMENT_TYPES.PAZ_SALVO_ADMIN]: 'Paz y Salvo de Administración',
      [DOCUMENT_TYPES.RECIBO_SERVICIOS]: 'Recibo de Servicios Públicos',
      [DOCUMENT_TYPES.CERTIFICADO_PREDIAL]: 'Certificado de Tradición y Libertad',
      [DOCUMENT_TYPES.FOTOS_INMUEBLE]: 'Foto del inmueble'
    };

    const label = documentLabels[documentType] || 'Documento';
    
    let message = `✅ **${label}** recibido exitosamente.`;

    // Agregar información de validación si está disponible
    if (documentResult.validation) {
      if (documentResult.validation.isValid) {
        message += '\n✅ El documento parece ser correcto.';
      } else if (documentResult.validation.issues.length > 0) {
        message += '\n⚠️ Por favor verifica que sea el documento correcto.';
      }
    }

    // Agregar información sobre texto extraído
    if (documentResult.extractedText && documentResult.extractedText.length > 50) {
      message += '\n📄 Información extraída y procesada correctamente.';
    }

    return message;
  }

  /**
   * Validar webhook de UltraMSG (opcional)
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   * @param {Function} next - Next middleware
   */
  async validateUltraMSGWebhook(req, res, next) {
    try {
      // Validar que el webhook viene de UltraMSG
      const userAgent = req.headers['user-agent'];
      if (!userAgent || !userAgent.includes('UltraMsg')) {
        logger.whatsapp('Webhook con User-Agent sospechoso', { userAgent });
      }

      // Validar estructura básica del body
      if (!req.body || !req.body.data) {
        return res.status(400).json({
          success: false,
          error: 'Estructura de webhook inválida'
        });
      }

      next();

    } catch (error) {
      logger.error('Error al validar webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Error de validación'
      });
    }
  }

  /**
   * Endpoint de test para webhook
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async testWebhook(req, res) {
    try {
      logger.whatsapp('Test de webhook ejecutado', {
        method: req.method,
        headers: req.headers,
        body: req.body
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook funcionando correctamente',
        timestamp: new Date().toISOString(),
        data: req.body
      });

    } catch (error) {
      logger.error('Error en test de webhook:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas de webhooks
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async getWebhookStats(req, res) {
    try {
      // Obtener estadísticas de mensajes procesados
      const conversationStats = await conversationManager.getConversationStats();
      
      const stats = {
        conversaciones: conversationStats,
        ultimoWebhook: new Date().toISOString(),
        estado: 'activo'
      };

      return res.status(200).json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas de webhook:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

// Crear instancia del controlador
const webhookController = new WebhookController();

export default webhookController;