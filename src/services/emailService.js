/**
 * Servicio de notificaciones por email usando Resend
 * NO usar Gmail/SMTP, solo Resend como especificado
 */
import { Resend } from 'resend';
import { email as emailConfig } from '../config/index.js';
import logger from '../config/logger.js';
import { ERROR_CODES } from '../utils/constants.js';

class EmailService {
  constructor() {
    this.resend = new Resend(emailConfig.apiKey);
    this.fromEmail = emailConfig.fromEmail;
    this.notificationEmail = emailConfig.notificationEmail;
  }

  /**
   * Enviar notificación de completitud de recolección
   * @param {Object} propertyData - Datos de la propiedad completada
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendCompletionNotification(propertyData) {
    try {
      const emailData = {
        from: this.fromEmail,
        to: [this.notificationEmail],
        subject: `🎉 Nueva propiedad completada - ${propertyData.direccion_inmueble}`,
        html: this.generateCompletionEmailHTML(propertyData),
        text: this.generateCompletionEmailText(propertyData)
      };

      const response = await this.resend.emails.send(emailData);
      
      logger.info('Email de completitud enviado exitosamente', {
        propertyId: propertyData.id,
        emailId: response.data?.id,
        to: this.notificationEmail
      });

      return {
        success: true,
        emailId: response.data?.id,
        message: 'Email enviado exitosamente'
      };

    } catch (error) {
      logger.error('Error al enviar email de completitud:', {
        propertyId: propertyData.id,
        error: error.message
      });

      return {
        success: false,
        error: ERROR_CODES.EMAIL_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Enviar notificación de error del sistema
   * @param {Object} errorData - Información del error
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendErrorNotification(errorData) {
    try {
      const emailData = {
        from: this.fromEmail,
        to: [this.notificationEmail],
        subject: `🚨 Error en Bot Inmobiliario - ${errorData.type}`,
        html: this.generateErrorEmailHTML(errorData),
        text: this.generateErrorEmailText(errorData)
      };

      const response = await this.resend.emails.send(emailData);
      
      logger.info('Email de error enviado exitosamente', {
        errorType: errorData.type,
        emailId: response.data?.id
      });

      return {
        success: true,
        emailId: response.data?.id
      };

    } catch (error) {
      logger.error('Error al enviar email de error:', {
        originalError: errorData,
        emailError: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar HTML para email de completitud
   * @param {Object} propertyData - Datos de la propiedad
   * @returns {string} HTML del email
   */
  generateCompletionEmailHTML(propertyData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Propiedad Completada</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .property-info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
        .field-group { margin: 15px 0; }
        .field-label { font-weight: bold; color: #555; }
        .field-value { color: #333; margin-left: 10px; }
        .completion-badge { background: #4CAF50; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
        .footer { text-align: center; margin-top: 20px; padding: 10px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Nueva Propiedad Completada</h1>
            <p>Se ha completado exitosamente la recolección de información</p>
        </div>
        
        <div class="content">
            <div class="property-info">
                <h2>📍 Información de la Propiedad</h2>
                
                <div class="field-group">
                    <span class="field-label">Dirección:</span>
                    <span class="field-value">${propertyData.direccion_inmueble}, ${propertyData.ciudad_inmueble}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Tipo:</span>
                    <span class="field-value">${propertyData.tipo_propiedad || 'No especificado'}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Área:</span>
                    <span class="field-value">${propertyData.area_construida || 'No especificado'} m²</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Precio:</span>
                    <span class="field-value">$${propertyData.precio_venta ? new Intl.NumberFormat('es-CO').format(propertyData.precio_venta) : 'No especificado'}</span>
                </div>
            </div>
            
            <div class="property-info">
                <h2>👤 Información del Cliente</h2>
                
                <div class="field-group">
                    <span class="field-label">Nombre:</span>
                    <span class="field-value">${propertyData.nombre} ${propertyData.apellido}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Documento:</span>
                    <span class="field-value">${propertyData.tipo_documento} ${propertyData.numero_documento}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Celular:</span>
                    <span class="field-value">${propertyData.celular}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Email:</span>
                    <span class="field-value">${propertyData.email}</span>
                </div>
            </div>
            
            <div class="property-info">
                <h2>📊 Estado de Completitud</h2>
                <p><span class="completion-badge">100% COMPLETADO</span></p>
                
                <div class="field-group">
                    <span class="field-label">Fecha de completado:</span>
                    <span class="field-value">${new Date().toLocaleString('es-CO')}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">ID de propiedad:</span>
                    <span class="field-value">${propertyData.id}</span>
                </div>
            </div>
            
            <div class="property-info">
                <h2>📋 Próximos Pasos</h2>
                <ul>
                    <li>Revisar información exportada en Google Sheets</li>
                    <li>Validar documentos recibidos</li>
                    <li>Iniciar proceso de verificación</li>
                    <li>Contactar al cliente para siguientes pasos</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>Bot Inmobiliario - Sistema de Recolección Automatizada</p>
            <p>Generado automáticamente el ${new Date().toLocaleString('es-CO')}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generar texto plano para email de completitud
   * @param {Object} propertyData - Datos de la propiedad
   * @returns {string} Texto del email
   */
  generateCompletionEmailText(propertyData) {
    return `
🎉 NUEVA PROPIEDAD COMPLETADA

Se ha completado exitosamente la recolección de información para una nueva propiedad.

📍 INFORMACIÓN DE LA PROPIEDAD:
- Dirección: ${propertyData.direccion_inmueble}, ${propertyData.ciudad_inmueble}
- Tipo: ${propertyData.tipo_propiedad || 'No especificado'}
- Área: ${propertyData.area_construida || 'No especificado'} m²
- Precio: $${propertyData.precio_venta ? new Intl.NumberFormat('es-CO').format(propertyData.precio_venta) : 'No especificado'}

👤 INFORMACIÓN DEL CLIENTE:
- Nombre: ${propertyData.nombre} ${propertyData.apellido}
- Documento: ${propertyData.tipo_documento} ${propertyData.numero_documento}
- Celular: ${propertyData.celular}
- Email: ${propertyData.email}

📊 ESTADO: 100% COMPLETADO
- Fecha: ${new Date().toLocaleString('es-CO')}
- ID: ${propertyData.id}

📋 PRÓXIMOS PASOS:
1. Revisar información exportada en Google Sheets
2. Validar documentos recibidos
3. Iniciar proceso de verificación
4. Contactar al cliente para siguientes pasos

---
Bot Inmobiliario - Sistema de Recolección Automatizada
Generado automáticamente el ${new Date().toLocaleString('es-CO')}
`;
  }

  /**
   * Generar HTML para email de error
   * @param {Object} errorData - Datos del error
   * @returns {string} HTML del email
   */
  generateErrorEmailHTML(errorData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error en Bot Inmobiliario</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .error-info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #f44336; }
        .field-group { margin: 15px 0; }
        .field-label { font-weight: bold; color: #555; }
        .field-value { color: #333; margin-left: 10px; font-family: monospace; }
        .error-badge { background: #f44336; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Error en Bot Inmobiliario</h1>
            <p>Se ha detectado un error en el sistema</p>
        </div>
        
        <div class="content">
            <div class="error-info">
                <h2>⚠️ Detalles del Error</h2>
                
                <div class="field-group">
                    <span class="field-label">Tipo:</span>
                    <span class="field-value">${errorData.type}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Mensaje:</span>
                    <span class="field-value">${errorData.message}</span>
                </div>
                
                <div class="field-group">
                    <span class="field-label">Timestamp:</span>
                    <span class="field-value">${new Date().toISOString()}</span>
                </div>
                
                ${errorData.propertyId ? `
                <div class="field-group">
                    <span class="field-label">Property ID:</span>
                    <span class="field-value">${errorData.propertyId}</span>
                </div>
                ` : ''}
                
                ${errorData.userId ? `
                <div class="field-group">
                    <span class="field-label">User ID:</span>
                    <span class="field-value">${errorData.userId}</span>
                </div>
                ` : ''}
                
                ${errorData.stack ? `
                <div class="field-group">
                    <span class="field-label">Stack Trace:</span>
                    <span class="field-value">${errorData.stack}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="error-info">
                <h2>🔧 Acciones Recomendadas</h2>
                <ul>
                    <li>Revisar logs del sistema para más detalles</li>
                    <li>Verificar conectividad con servicios externos</li>
                    <li>Comprobar configuración de variables de entorno</li>
                    <li>Contactar al usuario afectado si es necesario</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generar texto plano para email de error
   * @param {Object} errorData - Datos del error
   * @returns {string} Texto del email
   */
  generateErrorEmailText(errorData) {
    return `
🚨 ERROR EN BOT INMOBILIARIO

Se ha detectado un error en el sistema que requiere atención.

⚠️ DETALLES DEL ERROR:
- Tipo: ${errorData.type}
- Mensaje: ${errorData.message}
- Timestamp: ${new Date().toISOString()}
${errorData.propertyId ? `- Property ID: ${errorData.propertyId}` : ''}
${errorData.userId ? `- User ID: ${errorData.userId}` : ''}

🔧 ACCIONES RECOMENDADAS:
1. Revisar logs del sistema para más detalles
2. Verificar conectividad con servicios externos
3. Comprobar configuración de variables de entorno
4. Contactar al usuario afectado si es necesario

${errorData.stack ? `
STACK TRACE:
${errorData.stack}
` : ''}

---
Bot Inmobiliario - Sistema de Notificación de Errores
Generado automáticamente el ${new Date().toISOString()}
`;
  }

  /**
   * Verificar configuración del servicio de email
   * @returns {Promise<boolean>} Estado de la configuración
   */
  async validateConfiguration() {
    try {
      // Intentar enviar un email de prueba (sin enviarlo realmente)
      const testData = {
        from: this.fromEmail,
        to: [this.notificationEmail],
        subject: 'Test de configuración',
        text: 'Este es un test de configuración'
      };

      // Solo validar que los datos estén bien formateados
      if (!this.fromEmail || !this.notificationEmail || !emailConfig.apiKey) {
        return false;
      }

      logger.info('Configuración de email validada exitosamente');
      return true;

    } catch (error) {
      logger.error('Error al validar configuración de email:', error);
      return false;
    }
  }

  /**
   * Enviar email de bienvenida al sistema (para uso futuro)
   * @param {string} recipientEmail - Email del destinatario
   * @param {string} recipientName - Nombre del destinatario
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendWelcomeEmail(recipientEmail, recipientName) {
    try {
      const emailData = {
        from: this.fromEmail,
        to: [recipientEmail],
        subject: '¡Bienvenido al sistema inmobiliario! 🏠',
        html: `
<h1>¡Hola ${recipientName}!</h1>
<p>Bienvenido a nuestro sistema de gestión inmobiliaria.</p>
<p>Pronto recibirás más información sobre el proceso de registro de tu propiedad.</p>
<br>
<p>Saludos,<br>El equipo inmobiliario</p>
        `,
        text: `¡Hola ${recipientName}!\n\nBienvenido a nuestro sistema de gestión inmobiliaria.\nPronto recibirás más información sobre el proceso de registro de tu propiedad.\n\nSaludos,\nEl equipo inmobiliario`
      };

      const response = await this.resend.emails.send(emailData);
      
      return {
        success: true,
        emailId: response.data?.id
      };

    } catch (error) {
      logger.error('Error al enviar email de bienvenida:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Crear instancia singleton
const emailService = new EmailService();

export default emailService;