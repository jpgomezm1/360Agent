/**
 * Constantes utilizadas en todo el sistema
 */

// Estados de recolección de propiedades
export const PROPERTY_STATES = {
    INICIADO: 'INICIADO',
    EN_PROGRESO: 'EN_PROGRESO',
    COMPLETADO: 'COMPLETADO'
  };
  
  // Estados de conversación
  export const CONVERSATION_STATES = {
    ACTIVA: 'ACTIVA',
    COMPLETADA: 'COMPLETADA',
    TIMEOUT: 'TIMEOUT'
  };
  
  // Tipos de mensaje
  export const MESSAGE_TYPES = {
    USER: 'USER',
    BOT: 'BOT',
    SYSTEM: 'SYSTEM'
  };
  
  // Dirección de mensajes
  export const MESSAGE_DIRECTIONS = {
    ENVIADO: 'ENVIADO',
    RECIBIDO: 'RECIBIDO'
  };
  
  // Tipos de propiedad válidos
  export const PROPERTY_TYPES = {
    APARTAMENTO: 'apartamento',
    CASA: 'casa',
    OFICINA: 'oficina',
    LOTE: 'lote',
    BODEGA: 'bodega'
  };
  
  // Estados de propiedad válidos
  export const PROPERTY_CONDITIONS = {
    NUEVO: 'nuevo',
    USADO: 'usado',
    REMODELAR: 'remodelar'
  };
  
  // Opciones de tiempo estimado de venta
  export const SALE_TIME_OPTIONS = {
    SHORT: '1-3 meses',
    MEDIUM: '3-6 meses',
    LONG: '6-12 meses',
    VERY_LONG: 'más de 1 año'
  };
  
  // Tipos de documentos requeridos
  export const DOCUMENT_TYPES = {
    CERTIFICADO_EXISTENCIA: 'certificado_existencia',
    ESCRITURA_PUBLICA: 'escritura_publica',
    PAZ_SALVO_ADMIN: 'paz_salvo_admin',
    RECIBO_SERVICIOS: 'recibo_servicios',
    CERTIFICADO_PREDIAL: 'certificado_predial',
    FOTOS_INMUEBLE: 'fotos_inmueble'
  };
  
  // Labels amigables para documentos
  export const DOCUMENT_LABELS = {
    [DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA]: 'Certificado de Existencia y Representación Legal',
    [DOCUMENT_TYPES.ESCRITURA_PUBLICA]: 'Escritura Pública',
    [DOCUMENT_TYPES.PAZ_SALVO_ADMIN]: 'Paz y Salvo de Administración',
    [DOCUMENT_TYPES.RECIBO_SERVICIOS]: 'Recibo de Servicios Públicos',
    [DOCUMENT_TYPES.CERTIFICADO_PREDIAL]: 'Certificado de Tradición y Libertad',
    [DOCUMENT_TYPES.FOTOS_INMUEBLE]: 'Fotos del Inmueble'
  };
  
  // Estratos válidos en Colombia
  export const VALID_STRATA = [1, 2, 3, 4, 5, 6];
  
  // Rangos de años de construcción válidos
  export const CONSTRUCTION_YEAR_RANGE = {
    MIN: 1900,
    MAX: new Date().getFullYear() + 1
  };
  
  // Configuración de archivos
  // Configuración de archivos
export const FILE_CONFIG = {
    ALLOWED_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png', 
      'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
   };
   
   // Configuración de validación
   export const VALIDATION_CONFIG = {
    MIN_DESCRIPTION_WORDS: 50,
    MIN_PHOTOS: 5,
    MIN_DOCUMENTS: 5, // certificado_existencia + 4 adicionales
    MIN_AREA: 10, // metros cuadrados mínimos
    MAX_AREA: 10000, // metros cuadrados máximos
    MIN_ROOMS: 0,
    MAX_ROOMS: 20,
    MIN_BATHROOMS: 0.5,
    MAX_BATHROOMS: 10,
    MIN_PARKING: 0,
    MAX_PARKING: 10,
    MIN_FLOOR: -5, // sótanos
    MAX_FLOOR: 100,
    MIN_PRICE: 50000000, // 50 millones mínimo
    MAX_PRICE: 50000000000 // 50 mil millones máximo
   };
   
   // Categorías de campos para recolección
   export const FIELD_CATEGORIES = {
    PHYSICAL: 'physical',
    COMMERCIAL: 'commercial', 
    DOCUMENTATION: 'documentation',
    DESCRIPTION: 'description'
   };
   
   // Prioridad de recolección de campos
   export const FIELD_COLLECTION_ORDER = [
    // Primero características físicas básicas
    'tipo_propiedad',
    'area_construida', 
    'habitaciones',
    'banos',
    'parqueaderos',
    'piso', // solo si es apartamento
    'estrato',
    'ano_construccion',
    'estado_propiedad',
    
    // Luego información comercial
    'precio_venta',
    'precio_negociable',
    'motivo_venta',
    'tiempo_estimado_venta',
    'acepta_credito',
    'deudas_pendientes',
    
    // Después descripción
    'descripcion',
    'caracteristicas_especiales',
    'servicios_incluidos', 
    'restricciones',
    
    // Finalmente documentos
    'certificado_existencia',
    'escritura_publica',
    'paz_salvo_admin',
    'recibo_servicios',
    'certificado_predial',
    'fotos_inmueble'
   ];
   
   // Preguntas para cada campo
   export const FIELD_QUESTIONS = {
    tipo_propiedad: "¿Es un apartamento, casa, oficina, lote o bodega?",
    area_construida: "¿Cuántos metros cuadrados tiene el inmueble?",
    habitaciones: "¿Cuántas habitaciones tiene?",
    banos: "¿Cuántos baños tiene? (puedes decir 2.5 si tiene medio baño)",
    parqueaderos: "¿Tiene parqueadero? ¿Cuántos?",
    piso: "¿En qué piso está ubicado?",
    estrato: "¿Cuál es el estrato socioeconómico? (1 al 6)",
    ano_construccion: "¿En qué año aproximadamente fue construido?",
    estado_propiedad: "¿Está nuevo, usado o necesita remodelación?",
    precio_venta: "¿Cuál es el precio de venta?",
    precio_negociable: "¿El precio es negociable?",
    motivo_venta: "¿Cuál es el motivo de la venta?",
    tiempo_estimado_venta: "¿En cuánto tiempo esperas vender? (1-3 meses, 3-6 meses, 6-12 meses, más de 1 año)",
    acepta_credito: "¿Aceptas crédito hipotecario?",
    deudas_pendientes: "¿Tiene deudas pendientes la propiedad? (administración, predial, etc.)",
    descripcion: "Cuéntame una descripción detallada del inmueble (mínimo 50 palabras)",
    caracteristicas_especiales: "¿Qué características especiales tiene? (vista, balcón, etc.)",
    servicios_incluidos: "¿Qué servicios incluye? (agua, luz, gas, internet, etc.)",
    restricciones: "¿Tiene alguna restricción? (mascotas, niños, etc.)",
    certificado_existencia: "Necesito el Certificado de Existencia y Representación Legal. ¿Lo tienes?",
    escritura_publica: "¿Tienes la Escritura Pública del inmueble?",
    paz_salvo_admin: "¿Tienes el Paz y Salvo de Administración? (si aplica)",
    recibo_servicios: "¿Puedes enviar un recibo de servicios públicos reciente?",
    certificado_predial: "¿Tienes el Certificado de Tradición y Libertad?",
    fotos_inmueble: "Necesito mínimo 5 fotos del inmueble. ¿Las puedes enviar?"
   };
   
   // Expresiones regulares para validación (solo para validación, NO para interpretación)
   export const VALIDATION_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^(\+57|57)?[0-9]{10}$/,
    DOCUMENT: /^[0-9]{6,12}$/,
    YEAR: /^(19|20)[0-9]{2}$/
   };
   
   // Códigos de error
   export const ERROR_CODES = {
    // Errores de validación
    INVALID_PHONE: 'INVALID_PHONE',
    INVALID_EMAIL: 'INVALID_EMAIL', 
    INVALID_DOCUMENT: 'INVALID_DOCUMENT',
    FIELD_REQUIRED: 'FIELD_REQUIRED',
    INVALID_FORMAT: 'INVALID_FORMAT',
    
    // Errores de sistema
    DATABASE_ERROR: 'DATABASE_ERROR',
    WHATSAPP_ERROR: 'WHATSAPP_ERROR',
    AI_ERROR: 'AI_ERROR',
    RAG_ERROR: 'RAG_ERROR',
    FILE_ERROR: 'FILE_ERROR',
    
    // Errores de conversación
    CONVERSATION_TIMEOUT: 'CONVERSATION_TIMEOUT',
    CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
    PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND'
   };
   
   // Mensajes de error amigables
   export const ERROR_MESSAGES = {
    [ERROR_CODES.INVALID_PHONE]: 'El número de teléfono no es válido. Debe tener 10 dígitos.',
    [ERROR_CODES.INVALID_EMAIL]: 'El email no tiene un formato válido.',
    [ERROR_CODES.INVALID_DOCUMENT]: 'El número de documento debe tener entre 6 y 12 dígitos.',
    [ERROR_CODES.FIELD_REQUIRED]: 'Este campo es obligatorio.',
    [ERROR_CODES.INVALID_FORMAT]: 'El formato ingresado no es válido.',
    [ERROR_CODES.DATABASE_ERROR]: 'Error en la base de datos. Intenta de nuevo.',
    [ERROR_CODES.WHATSAPP_ERROR]: 'Error al enviar mensaje por WhatsApp.',
    [ERROR_CODES.AI_ERROR]: 'Error en el procesamiento inteligente.',
    [ERROR_CODES.RAG_ERROR]: 'Error al buscar información.',
    [ERROR_CODES.FILE_ERROR]: 'Error al procesar el archivo.',
    [ERROR_CODES.CONVERSATION_TIMEOUT]: 'La conversación ha expirado por inactividad.',
    [ERROR_CODES.CONVERSATION_NOT_FOUND]: 'No se encontró la conversación.',
    [ERROR_CODES.PROPERTY_NOT_FOUND]: 'No se encontró la propiedad.'
   };
   
   // URLs y endpoints
   export const ENDPOINTS = {
    ULTRAMSG: {
      SEND_MESSAGE: '/messages/chat',
      SEND_IMAGE: '/messages/image',
      SEND_DOCUMENT: '/messages/document',
      WEBHOOK: '/webhook'
    }
   };
   
   // Configuración de timeouts
   export const TIMEOUTS = {
    WHATSAPP_REQUEST: 15000, // 15 segundos
    AI_REQUEST: 30000, // 30 segundos
    DATABASE_QUERY: 10000, // 10 segundos
    FILE_UPLOAD: 60000, // 1 minuto
    CONVERSATION_INACTIVE: 86400000 // 24 horas
   };
   
   // Templates de mensajes
   export const MESSAGE_TEMPLATES = {
    WELCOME: "¡Hola {nombre}! 👋\n\nVi que registraste tu propiedad en {direccion}, {ciudad}.\nTe voy a ayudar a completar toda la información para publicarla.\n\n¿Es un apartamento, casa, oficina o qué tipo de inmueble?",
    
    PROGRESS_UPDATE: "📋 **Estado actual:**\n\n✅ Características físicas: {physical}%\n✅ Información comercial: {commercial}%\n✅ Documentos: {documentation}%\n✅ Descripción: {description}%\n\n**Total: {total}% completado**",
    
    COMPLETION: "¡Perfecto! 🎉 Ya tengo toda la información necesaria.\n\n✅ Características físicas: Completas\n✅ Información comercial: Completa\n✅ Documentos: Todos recibidos\n✅ Descripción: Completa\n\nHe enviado toda la información a nuestro equipo. Te contactaremos pronto para los siguientes pasos.",
    
    ERROR_GENERIC: "Lo siento, ha ocurrido un error. Nuestro equipo ha sido notificado y te contactaremos pronto.",
    
    TIMEOUT_WARNING: "⏰ Hola {nombre}, veo que no hemos continuado con el registro de tu propiedad.\n\n¿Te gustaría continuar donde lo dejamos?",
    
    DOCUMENT_RECEIVED: "✅ Documento recibido: {document_type}\n\n{remaining > 0 ? `Faltan ${remaining} documentos más.` : '¡Todos los documentos están completos!'}"
   };
   
   export default {
    PROPERTY_STATES,
    CONVERSATION_STATES,
    MESSAGE_TYPES,
    MESSAGE_DIRECTIONS,
    PROPERTY_TYPES,
    PROPERTY_CONDITIONS,
    SALE_TIME_OPTIONS,
    DOCUMENT_TYPES,
    DOCUMENT_LABELS,
    VALID_STRATA,
    CONSTRUCTION_YEAR_RANGE,
    FILE_CONFIG,
    VALIDATION_CONFIG,
    FIELD_CATEGORIES,
    FIELD_COLLECTION_ORDER,
    FIELD_QUESTIONS,
    VALIDATION_PATTERNS,
    ERROR_CODES,
    ERROR_MESSAGES,
    ENDPOINTS,
    TIMEOUTS,
    MESSAGE_TEMPLATES
   };