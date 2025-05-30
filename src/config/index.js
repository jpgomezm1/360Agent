/**
 * Configuración principal del sistema
 * Centraliza todas las variables de entorno y configuraciones
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Configuración de la base de datos
 */
export const database = {
  url: process.env.DATABASE_URL,
  // Configuración específica para Neon DB
  connection: {
    ssl: process.env.NODE_ENV === 'production',
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000
  }
};

/**
 * Configuración de Weaviate (RAG)
 */
export const weaviate = {
  url: process.env.WEAVIATE_URL,
  apiKey: process.env.WEAVIATE_API_KEY,
  className: 'RealEstateKnowledge',
  // Configuración para embeddings
  vectorizer: 'text2vec-openai',
  embeddingModel: 'text-embedding-ada-002'
};

/**
 * Configuración de OpenAI
 */
export const openai = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-1106-preview',
  embeddingModel: 'text-embedding-ada-002',
  // Configuración específica para interpretación de respuestas
  maxTokens: 2000,
  temperature: 0.7,
  // Tiempo máximo de espera para respuestas
  timeout: 30000
};

/**
 * Configuración de UltraMSG (WhatsApp)
 */
export const whatsapp = {
  instanceId: process.env.ULTRAMSG_INSTANCE_ID,
  token: process.env.ULTRAMSG_TOKEN,
  baseUrl: `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}`,
  // Configuración de timeouts y reintentos
  timeout: 15000,
  maxRetries: 3,
  retryDelay: 2000
};

/**
 * Configuración de Resend (Email)
 */
export const email = {
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.FROM_EMAIL,
  notificationEmail: process.env.NOTIFICATION_EMAIL,
  // Templates de email
  templates: {
    completionNotification: 'completion-notification',
    errorNotification: 'error-notification'
  }
};

/**
 * Configuración de Google Sheets
 */
export const googleSheets = {
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  // Nombre de la hoja donde se exportarán los datos
  sheetName: 'Propiedades_Completadas',
  // Rango donde se insertarán los datos
  range: 'A:Z'
};

/**
 * Configuración de la aplicación
 */
export const app = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  // Timeout para conversaciones (24 horas)
  maxConversationTimeout: parseInt(process.env.MAX_CONVERSATION_TIMEOUT) || 86400000,
  // Límites de rate limiting
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100 // máximo 100 requests por ventana
  }
};

/**
 * Configuración de campos requeridos
 */
export const requiredFields = {
  // Campos que vienen del formulario simulado
  fromForm: [
    'nombre', 'apellido', 'tipo_documento', 'numero_documento',
    'pais', 'celular', 'email', 'ciudad_inmueble', 
    'direccion_inmueble', 'matricula_inmobiliaria'
  ],
  
  // Campos que debe recopilar el bot conversacionalmente
  physical: [
    'tipo_propiedad', 'area_construida', 'habitaciones', 'banos',
    'parqueaderos', 'piso', 'estrato', 'ano_construccion', 'estado_propiedad'
  ],
  
  commercial: [
    'precio_venta', 'precio_negociable', 'motivo_venta',
    'tiempo_estimado_venta', 'acepta_credito', 'deudas_pendientes'
  ],
  
  documentation: [
    'certificado_existencia', 'escritura_publica', 'paz_salvo_admin',
    'recibo_servicios', 'certificado_predial', 'fotos_inmueble'
  ],
  
  description: [
    'descripcion', 'caracteristicas_especiales', 
    'servicios_incluidos', 'restricciones'
  ]
};

/**
 * Configuración de validación
 */
export const validation = {
  // Mínimo de palabras para descripción
  minDescriptionWords: 50,
  // Mínimo de fotos requeridas
  minPhotos: 5,
  // Documentos mínimos requeridos (certificado_existencia + 4 adicionales)
  minDocuments: 5,
  // Formatos de archivo permitidos
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  // Tamaño máximo de archivo (5MB)
  maxFileSize: 5 * 1024 * 1024
};

/**
 * Mensajes del sistema
 */
export const messages = {
  welcome: "¡Hola {nombre}! 👋\n\nVi que registraste tu propiedad en {direccion}, {ciudad}.\nTe voy a ayudar a completar toda la información para publicarla.\n\n¿Es un apartamento, casa, oficina o qué tipo de inmueble?",
  
  completion: "¡Perfecto! 🎉 Ya tengo toda la información necesaria.\n\n✅ Características físicas: Completas\n✅ Información comercial: Completa\n✅ Documentos: Todos recibidos\n✅ Descripción: Completa\n\nHe enviado toda la información a nuestro equipo. Te contactaremos pronto para los siguientes pasos.",
  
  error: "Lo siento, ha ocurrido un error. Nuestro equipo ha sido notificado y te contactaremos pronto."
};

/**
 * Validar configuración al inicio
 */
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'WEAVIATE_URL', 'WEAVIATE_API_KEY',
    'OPENAI_API_KEY',
    'ULTRAMSG_INSTANCE_ID', 'ULTRAMSG_TOKEN',
    'RESEND_API_KEY', 'FROM_EMAIL', 'NOTIFICATION_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEETS_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }
}

// Configuración por defecto
export default {
  database,
  weaviate,
  openai,
  whatsapp,
  email,
  googleSheets,
  app,
  requiredFields,
  validation,
  messages,
  validateConfig
};