/**
 * Servicio RAG (Retrieval Augmented Generation) con Weaviate
 * Base de conocimiento para responder preguntas contextuales
 */
import weaviate from 'weaviate-ts-client';
import OpenAI from 'openai';
import { weaviate as weaviateConfig, openai as openaiConfig } from '../config/index.js';
import logger from '../config/logger.js';
import { ERROR_CODES } from '../utils/constants.js';

class RAGService {
  constructor() {
    // Cliente Weaviate
    this.weaviateClient = weaviate.client({
      scheme: 'https',
      host: weaviateConfig.url.replace('https://', ''),
      apiKey: weaviateConfig.apiKey,
      headers: {
        'X-OpenAI-Api-Key': openaiConfig.apiKey
      }
    });

    // Cliente OpenAI para embeddings y generación
    this.openaiClient = new OpenAI({
      apiKey: openaiConfig.apiKey
    });

    this.className = weaviateConfig.className;
  }

  /**
   * Inicializar el esquema de Weaviate si no existe
   */
  async initializeSchema() {
    try {
      // Verificar si la clase ya existe
      const classExists = await this.weaviateClient.schema
        .classGetter()
        .withClassName(this.className)
        .do()
        .then(() => true)
        .catch(() => false);

      if (!classExists) {
        // Crear el esquema
        const classDefinition = {
          class: this.className,
          description: 'Base de conocimiento inmobiliario para RAG',
          vectorizer: 'text2vec-openai',
          moduleConfig: {
            'text2vec-openai': {
              model: 'ada',
              modelVersion: '002',
              type: 'text'
            }
          },
          properties: [
            {
              name: 'content',
              dataType: ['text'],
              description: 'Contenido del documento'
            },
            {
              name: 'title',
              dataType: ['string'],
              description: 'Título del documento'
            },
            {
              name: 'category',
              dataType: ['string'],
              description: 'Categoría del conocimiento'
            },
            {
              name: 'tags',
              dataType: ['string[]'],
              description: 'Etiquetas para clasificación'
            },
            {
              name: 'source',
              dataType: ['string'],
              description: 'Fuente del conocimiento'
            }
          ]
        };

        await this.weaviateClient.schema
          .classCreator()
          .withClass(classDefinition)
          .do();

        logger.rag('Esquema de Weaviate creado exitosamente', {
          className: this.className
        });
      } else {
        logger.rag('Esquema de Weaviate ya existe', {
          className: this.className
        });
      }

      return true;
    } catch (error) {
      logger.error('Error al inicializar esquema de Weaviate:', error);
      throw error;
    }
  }

  /**
   * Cargar documentos de conocimiento en Weaviate
   * @param {Array} documents - Array de documentos a cargar
   */
  async loadKnowledgeBase(documents) {
    try {
      await this.initializeSchema();

      // Preparar documentos para carga batch
      const objects = documents.map(doc => ({
        class: this.className,
        properties: {
          content: doc.content,
          title: doc.title,
          category: doc.category || 'general',
          tags: doc.tags || [],
          source: doc.source || 'manual'
        }
      }));

      // Cargar en batches para mejor rendimiento
      const batchSize = 10;
      for (let i = 0; i < objects.length; i += batchSize) {
        const batch = objects.slice(i, i + batchSize);
        
        const batcher = this.weaviateClient.batch.objectsBatcher();
        batch.forEach(obj => batcher.withObject(obj));
        
        await batcher.do();
        
        logger.rag(`Cargado batch ${Math.floor(i/batchSize) + 1}`, {
          startIndex: i,
          endIndex: Math.min(i + batchSize, objects.length),
          total: objects.length
        });
      }

      logger.rag('Base de conocimiento cargada exitosamente', {
        totalDocuments: documents.length
      });

      return true;
    } catch (error) {
      logger.error('Error al cargar base de conocimiento:', error);
      throw error;
    }
  }

  /**
   * Buscar información relevante en la base de conocimiento
   * @param {string} query - Consulta del usuario
   * @param {number} limit - Número máximo de resultados
   * @returns {Promise<Array>} Documentos relevantes
   */
  async searchKnowledge(query, limit = 3) {
    try {
      const response = await this.weaviateClient.graphql
        .get()
        .withClassName(this.className)
       .withFields('content title category tags source _additional { certainty }')
       .withNearText({ concepts: [query] })
       .withLimit(limit)
       .withWhere({
         path: ['content'],
         operator: 'isNull',
         valueBoolean: false
       })
       .do();

     const results = response.data?.Get?.[this.className] || [];
     
     logger.rag('Búsqueda en base de conocimiento completada', {
       query,
       resultsCount: results.length,
       results: results.map(r => ({ title: r.title, certainty: r._additional?.certainty }))
     });

     return results.map(result => ({
       content: result.content,
       title: result.title,
       category: result.category,
       tags: result.tags,
       source: result.source,
       relevance: result._additional?.certainty || 0
     }));

   } catch (error) {
     logger.error('Error al buscar en base de conocimiento:', {
       query,
       error: error.message
     });
     return [];
   }
 }

 /**
  * Generar respuesta usando RAG
  * @param {string} userQuestion - Pregunta del usuario
  * @param {Object} context - Contexto adicional
  * @returns {Promise<string>} Respuesta generada
  */
 async generateRAGResponse(userQuestion, context = {}) {
   try {
     // 1. Buscar información relevante
     const relevantDocs = await this.searchKnowledge(userQuestion, 3);
     
     if (relevantDocs.length === 0) {
       return this.getFallbackResponse(userQuestion);
     }

     // 2. Construir contexto para GPT-4
     const knowledgeContext = relevantDocs
       .map(doc => `**${doc.title}**\n${doc.content}`)
       .join('\n\n---\n\n');

     // 3. Generar respuesta con GPT-4
     const systemPrompt = `
Eres un asistente inmobiliario experto que ayuda con preguntas sobre el proceso de venta de propiedades.

CONTEXTO DE CONOCIMIENTO:
${knowledgeContext}

INSTRUCCIONES:
- Responde basándote ÚNICAMENTE en la información proporcionada
- Si la información no está disponible, dilo claramente
- Mantén un tono amigable y profesional
- Usa emojis apropiados para hacer la respuesta más amigable
- Si es relevante, menciona que pueden continuar con el registro de su propiedad

CONTEXTO ADICIONAL:
- Usuario está registrando una propiedad inmobiliaria
- Proceso incluye recolección de documentos y información
- Es un proceso digital por WhatsApp
`;

     const response = await this.openaiClient.chat.completions.create({
       model: openaiConfig.model,
       messages: [
         { role: "system", content: systemPrompt },
         { role: "user", content: userQuestion }
       ],
       temperature: 0.7,
       max_tokens: 300
     });

     const answer = response.choices[0]?.message?.content || this.getFallbackResponse(userQuestion);
     
     logger.rag('Respuesta RAG generada exitosamente', {
       userQuestion,
       relevantDocsCount: relevantDocs.length,
       answerLength: answer.length
     });

     return answer;

   } catch (error) {
     logger.error('Error al generar respuesta RAG:', {
       userQuestion,
       error: error.message
     });
     
     return this.getFallbackResponse(userQuestion);
   }
 }

 /**
  * Respuesta de respaldo cuando no se puede generar una respuesta RAG
  * @param {string} question - Pregunta del usuario
  * @returns {string} Respuesta de respaldo
  */
 getFallbackResponse(question) {
   return `Entiendo tu pregunta sobre "${question}". 🤔

Por el momento no tengo información específica sobre ese tema, pero nuestro equipo estará encantado de ayudarte.

¿Te gustaría continuar completando la información de tu propiedad? Así podremos procesar tu solicitud más rápidamente. 📝`;
 }

 /**
  * Detectar si un mensaje es una pregunta
  * @param {string} message - Mensaje del usuario
  * @returns {boolean} True si es una pregunta
  */
 isQuestion(message) {
   // Indicadores comunes de preguntas
   const questionIndicators = [
     '¿', '?', 'cuánto', 'cuándo', 'cómo', 'qué', 'quién', 'dónde', 'por qué',
     'tiempo', 'demora', 'costo', 'precio', 'documento', 'necesito', 'requiere'
   ];

   const lowerMessage = message.toLowerCase();
   return questionIndicators.some(indicator => lowerMessage.includes(indicator));
 }

 /**
  * Obtener estadísticas de la base de conocimiento
  * @returns {Promise<Object>} Estadísticas
  */
 async getKnowledgeStats() {
   try {
     const response = await this.weaviateClient.graphql
       .aggregate()
       .withClassName(this.className)
       .withFields('meta { count }')
       .do();

     const count = response.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0;
     
     return {
       totalDocuments: count,
       className: this.className,
       status: 'active'
     };

   } catch (error) {
     logger.error('Error al obtener estadísticas de conocimiento:', error);
     return {
       totalDocuments: 0,
       className: this.className,
       status: 'error'
     };
   }
 }

 /**
  * Eliminar toda la base de conocimiento (útil para pruebas)
  */
 async clearKnowledgeBase() {
   try {
     await this.weaviateClient.schema
       .classDeleter()
       .withClassName(this.className)
       .do();

     logger.rag('Base de conocimiento eliminada', {
       className: this.className
     });

     return true;
   } catch (error) {
     logger.error('Error al eliminar base de conocimiento:', error);
     return false;
   }
 }

 /**
  * Verificar conectividad con Weaviate
  * @returns {Promise<boolean>} Estado de conexión
  */
 async checkConnection() {
   try {
     await this.weaviateClient.misc.metaGetter().do();
     logger.rag('Conexión con Weaviate verificada exitosamente');
     return true;
   } catch (error) {
     logger.error('Error de conexión con Weaviate:', error);
     return false;
   }
 }
}

// Crear instancia singleton
const ragService = new RAGService();

export default ragService;