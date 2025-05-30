#!/usr/bin/env node
/**
 * Script para cargar base de conocimiento en RAG
 * Uso: npm run load-knowledge
 */
import ragService from '../src/services/ragService.js';
import logger from '../src/config/logger.js';

async function loadKnowledgeBase() {
  try {
    console.log('📚 Cargando base de conocimiento...');

    const knowledgeData = [
      {
        title: "Proceso de registro completo",
        content: "El proceso de registro incluye: 1) Envío del formulario inicial, 2) Conversación por WhatsApp para completar información, 3) Envío de documentos requeridos, 4) Verificación y validación, 5) Publicación de la propiedad. Todo el proceso toma entre 3-5 días hábiles.",
        category: "proceso",
        tags: ["registro", "proceso", "tiempo", "pasos"],
        source: "script"
      },
      {
        title: "Documentos obligatorios y opcionales",
        content: "Documentos OBLIGATORIOS: Certificado de Existencia y Representación Legal, mínimo 5 fotos del inmueble. Documentos ADICIONALES (mínimo 4 de 5): Escritura Pública, Paz y Salvo de Administración, Recibo de Servicios Públicos, Certificado de Tradición y Libertad.",
        category: "documentos",
        tags: ["documentos", "obligatorios", "opcionales", "certificados"],
        source: "script"
      },
      {
        title: "Tipos de propiedades aceptadas",
        content: "Aceptamos los siguientes tipos de propiedades: Apartamentos, Casas, Oficinas, Lotes, Bodegas. Cada tipo tiene requisitos específicos de información. Los apartamentos y oficinas requieren información de piso.",
        category: "propiedades",
        tags: ["tipos", "apartamento", "casa", "oficina", "lote", "bodega"],
        source: "script"
      },
      {
        title: "Información comercial requerida",
        content: "Se requiere: precio de venta en pesos colombianos, si el precio es negociable, motivo de la venta, tiempo estimado de venta (1-3 meses, 3-6 meses, 6-12 meses, más de 1 año), si acepta crédito hipotecario, información sobre deudas pendientes.",
        category: "comercial",
        tags: ["precio", "venta", "credito", "deudas", "tiempo"],
        source: "script"
      },
      {
        title: "Características físicas necesarias",
        content: "Información física requerida: tipo de propiedad, área construida en m², número de habitaciones, número de baños (puede ser decimal como 2.5), parqueaderos, piso (para apartamentos/oficinas), estrato (1-6), año de construcción aproximado, estado de la propiedad (nuevo/usado/remodelar).",
        category: "caracteristicas",
        tags: ["area", "habitaciones", "baños", "parqueaderos", "estrato", "construccion"],
        source: "script"
      },
      {
        title: "Descripciones y características especiales",
        content: "Se requiere una descripción detallada de mínimo 50 palabras, características especiales (vista, balcón, etc.), servicios incluidos (agua, luz, gas, internet, etc.), restricciones (mascotas, niños, etc.).",
        category: "descripcion",
        tags: ["descripcion", "caracteristicas", "servicios", "restricciones"],
        source: "script"
      },
      {
        title: "Soporte técnico y ayuda",
        content: "Nuestro bot está disponible 24/7 para responder preguntas durante el proceso. El equipo de soporte humano está disponible de lunes a viernes de 8:00 AM a 6:00 PM. En caso de problemas técnicos, el sistema notifica automáticamente al equipo.",
        category: "soporte",
        tags: ["soporte", "ayuda", "horarios", "tecnico"],
        source: "script"
      },
      {
        title: "Preguntas frecuentes sobre el proceso",
        content: "¿Cuánto cuesta? El registro es gratuito. ¿Cuánto demora? 3-5 días hábiles. ¿Qué pasa si faltan documentos? El bot te guiará para completar todo. ¿Puedo modificar información? Sí, durante el proceso de registro. ¿Cómo sé el estado? Recibes actualizaciones por WhatsApp.",
        category: "faq",
        tags: ["preguntas", "frecuentes", "costo", "tiempo", "modificar"],
        source: "script"
      }
    ];

    // Inicializar esquema
    await ragService.initializeSchema();

    // Cargar datos
    await ragService.loadKnowledgeBase(knowledgeData);

    // Obtener estadísticas
    const stats = await ragService.getKnowledgeStats();

    console.log('✅ Base de conocimiento cargada exitosamente');
    console.log(`📊 Total de documentos: ${stats.totalDocuments}`);

  } catch (error) {
    console.error('❌ Error al cargar base de conocimiento:', error);
    process.exit(1);
  }
}

// Ejecutar carga
loadKnowledgeBase();