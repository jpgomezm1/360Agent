/**
* Servicio para integración con UltraMSG API (WhatsApp)
* Maneja envío de mensajes, imágenes y documentos
*/
import axios from 'axios';
import { whatsapp, app } from '../config/index.js';
import logger from '../config/logger.js';
import { ERROR_CODES, TIMEOUTS } from '../utils/constants.js';

class WhatsAppService {
 constructor() {
   this.baseUrl = whatsapp.baseUrl;
   this.token = whatsapp.token;
   this.instanceId = whatsapp.instanceId;
   
   // Configurar cliente axios
   this.client = axios.create({
     baseURL: this.baseUrl,
     timeout: TIMEOUTS.WHATSAPP_REQUEST,
     headers: {
       'Content-Type': 'application/json'
     }
   });
   
   // Interceptors para logging
   this.setupInterceptors();
 }

 /**
  * Configurar interceptors para logging y manejo de errores
  */
 setupInterceptors() {
   this.client.interceptors.request.use(
     (config) => {
       logger.whatsapp('Enviando request a UltraMSG', {
         url: config.url,
         method: config.method,
         data: config.data
       });
       return config;
     },
     (error) => {
       logger.error('Error en request a UltraMSG:', error);
       return Promise.reject(error);
     }
   );

   this.client.interceptors.response.use(
     (response) => {
       logger.whatsapp('Respuesta recibida de UltraMSG', {
         status: response.status,
         data: response.data
       });
       return response;
     },
     (error) => {
       logger.error('Error en respuesta de UltraMSG:', {
         status: error.response?.status,
         data: error.response?.data,
         message: error.message
       });
       return Promise.reject(error);
     }
   );
 }

 /**
  * Enviar mensaje de texto
  * @param {string} to - Número de teléfono en formato internacional
  * @param {string} message - Contenido del mensaje
  * @returns {Promise<Object>} Respuesta de UltraMSG
  */
 async sendMessage(to, message) {
   try {
     // Validar parámetros
     if (!to || !message) {
       throw new Error('Número de teléfono y mensaje son requeridos');
     }

     // Limpiar y formatear número
     const cleanPhone = this.formatPhoneNumber(to);
     
     const payload = {
       token: this.token,
       to: cleanPhone,
       body: message,
       priority: 1,
       referenceId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
     };

     const response = await this.client.post('/messages/chat', payload);
     
     logger.whatsapp('Mensaje enviado exitosamente', {
       to: cleanPhone,
       messageLength: message.length,
       referenceId: payload.referenceId,
       response: response.data
     });

     return {
       success: true,
       data: response.data,
       referenceId: payload.referenceId
     };

   } catch (error) {
     logger.error('Error al enviar mensaje por WhatsApp:', {
       to,
       error: error.message,
       response: error.response?.data
     });

     return {
       success: false,
       error: ERROR_CODES.WHATSAPP_ERROR,
       message: error.message,
       details: error.response?.data
     };
   }
 }

 /**
  * Enviar imagen
  * @param {string} to - Número de teléfono
  * @param {string} imageUrl - URL de la imagen o base64
  * @param {string} caption - Descripción de la imagen
  * @returns {Promise<Object>} Respuesta de UltraMSG
  */
 async sendImage(to, imageUrl, caption = '') {
   try {
     const cleanPhone = this.formatPhoneNumber(to);
     
     const payload = {
       token: this.token,
       to: cleanPhone,
       image: imageUrl,
       caption: caption,
       referenceId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
     };

     const response = await this.client.post('/messages/image', payload);
     
     logger.whatsapp('Imagen enviada exitosamente', {
       to: cleanPhone,
       caption,
       referenceId: payload.referenceId
     });

     return {
       success: true,
       data: response.data,
       referenceId: payload.referenceId
     };

   } catch (error) {
     logger.error('Error al enviar imagen por WhatsApp:', {
       to,
       error: error.message
     });

     return {
       success: false,
       error: ERROR_CODES.WHATSAPP_ERROR,
       message: error.message
     };
   }
 }

 /**
  * Enviar documento
  * @param {string} to - Número de teléfono
  * @param {string} documentUrl - URL del documento
  * @param {string} filename - Nombre del archivo
  * @param {string} caption - Descripción del documento
  * @returns {Promise<Object>} Respuesta de UltraMSG
  */
 async sendDocument(to, documentUrl, filename, caption = '') {
   try {
     const cleanPhone = this.formatPhoneNumber(to);
     
     const payload = {
       token: this.token,
       to: cleanPhone,
       document: documentUrl,
       filename: filename,
       caption: caption,
       referenceId: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
     };

     const response = await this.client.post('/messages/document', payload);
     
     logger.whatsapp('Documento enviado exitosamente', {
       to: cleanPhone,
       filename,
       referenceId: payload.referenceId
     });

     return {
       success: true,
       data: response.data,
       referenceId: payload.referenceId
     };

   } catch (error) {
     logger.error('Error al enviar documento por WhatsApp:', {
       to,
       filename,
       error: error.message
     });

     return {
       success: false,
       error: ERROR_CODES.WHATSAPP_ERROR,
       message: error.message
     };
   }
 }

 /**
  * Formatear número de teléfono a formato internacional
  * @param {string} phone - Número de teléfono
  * @returns {string} Número formateado
  */
 formatPhoneNumber(phone) {
   // Remover espacios y caracteres especiales
   let cleanPhone = phone.replace(/\D/g, '');
   
   // Si comienza con 57 (código de Colombia), mantenerlo
   if (cleanPhone.startsWith('57') && cleanPhone.length === 12) {
     return cleanPhone;
   }
   
   // Si comienza con +57, remover el +
   if (phone.startsWith('+57')) {
     return cleanPhone;
   }
   
   // Si es un número colombiano de 10 dígitos, agregar 57
   if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
     return `57${cleanPhone}`;
   }
   
   // Si no tiene código de país, asumir Colombia
   if (cleanPhone.length === 10) {
     return `57${cleanPhone}`;
   }
   
   return cleanPhone;
 }

 /**
  * Validar que el servicio esté funcionando
  * @returns {Promise<boolean>} Estado del servicio
  */
 async validateService() {
   try {
     // Intentar obtener información de la instancia
     const response = await this.client.get('/instance/status', {
       params: { token: this.token }
     });
     
     logger.whatsapp('Servicio WhatsApp validado exitosamente', {
       status: response.data
     });
     
     // RETORNAR BOOLEAN, no el objeto - CAMBIO AQUÍ
     return response.data?.status?.accountStatus?.status === 'authenticated';
   } catch (error) {
     logger.error('Error al validar servicio WhatsApp:', error);
     return false;
   }
 }

 /**
  * Obtener información de la instancia
  * @returns {Promise<Object>} Información de la instancia
  */
 async getInstanceInfo() {
   try {
     const response = await this.client.get('/instance/status', {
       params: { token: this.token }
     });
     
     return {
       success: true,
       data: response.data
     };
   } catch (error) {
     logger.error('Error al obtener información de instancia:', error);
     return {
       success: false,
       error: error.message
     };
   }
 }

 /**
  * Reenviar mensaje con reintentos
  * @param {string} to - Número de teléfono
  * @param {string} message - Mensaje
  * @param {number} maxRetries - Máximo número de reintentos
  * @returns {Promise<Object>} Resultado del envío
  */
 async sendMessageWithRetry(to, message, maxRetries = whatsapp.maxRetries) {
   let lastError = null;
   
   for (let attempt = 1; attempt <= maxRetries; attempt++) {
     try {
       const result = await this.sendMessage(to, message);
       
       if (result.success) {
         if (attempt > 1) {
           logger.whatsapp(`Mensaje enviado exitosamente en intento ${attempt}`, {
             to,
             attempts: attempt
           });
         }
         return result;
       }
       
       lastError = result;
       
       // Esperar antes del siguiente intento
       if (attempt < maxRetries) {
         await this.delay(whatsapp.retryDelay * attempt);
       }
       
     } catch (error) {
       lastError = { success: false, error: error.message };
       
       if (attempt < maxRetries) {
         await this.delay(whatsapp.retryDelay * attempt);
       }
     }
   }
   
   logger.error(`Falló envío de mensaje después de ${maxRetries} intentos`, {
     to,
     lastError
   });
   
   return lastError;
 }

 /**
  * Función de utilidad para delay
  * @param {number} ms - Milisegundos a esperar
  * @returns {Promise} Promise que se resuelve después del delay
  */
 delay(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
 }
}

// Crear instancia singleton
const whatsappService = new WhatsAppService();

export default whatsappService;