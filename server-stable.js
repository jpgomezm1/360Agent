// server-stable.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(helmet());

// Logging básico
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  next();
});

// Función para interpretar respuestas con OpenAI (NO regex)
async function interpretUserResponse(userMessage, currentField = null) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente que extrae información de propiedades inmobiliarias de respuestas en lenguaje natural.
          
INSTRUCCIONES:
- Analiza la respuesta del usuario y extrae información específica
- Si menciona tipo de propiedad: apartamento, casa, oficina, lote, bodega
- Si menciona números: área, habitaciones, baños, parqueaderos, piso, estrato, año, precio
- Si menciona estado: nuevo, usado, remodelar
- Responde SOLO con un JSON válido con los campos encontrados
- Si no encuentras información, responde con {}

CAMPO ACTUAL: ${currentField || 'ninguno'}
RESPUESTA USUARIO: "${userMessage}"`
        }
      ],
      functions: [{
        name: "extract_property_info",
        description: "Extraer información de propiedades",
        parameters: {
          type: "object",
          properties: {
            tipo_propiedad: { type: "string", enum: ["apartamento", "casa", "oficina", "lote", "bodega"] },
            area_construida: { type: "number" },
            habitaciones: { type: "integer" },
            banos: { type: "number" },
            parqueaderos: { type: "integer" },
            piso: { type: "integer" },
            estrato: { type: "integer", minimum: 1, maximum: 6 },
            ano_construccion: { type: "integer" },
            estado_propiedad: { type: "string", enum: ["nuevo", "usado", "remodelar"] },
            precio_venta: { type: "number" },
            precio_negociable: { type: "boolean" },
            acepta_credito: { type: "boolean" }
          }
        }
      }],
      function_call: { name: "extract_property_info" },
      temperature: 0.3
    });

    const functionCall = response.choices[0]?.message?.function_call;
    if (functionCall) {
      const extractedData = JSON.parse(functionCall.arguments);
      console.log('🧠 IA extrajo:', extractedData);
      return { success: true, data: extractedData };
    }

    return { success: false, data: {} };
  } catch (error) {
    console.error('❌ Error en IA:', error.message);
    return { success: false, data: {} };
  }
}

// Rutas principales
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bot WhatsApp Inmobiliario - FASE 1',
    version: '1.0.0-STABLE',
    status: 'operational',
    features: {
      formSimulation: true,
      aiInterpretation: true,
      database: true,
      conversationTracking: true
    },
    endpoints: {
      health: '/api/health',
      simulator: '/api/simulator/submit',
      conversation: '/api/conversation/message',
      properties: '/api/admin/properties'
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      health: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0-STABLE',
        database: 'connected',
        ai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        services: {
          api: 'operational',
          database: 'operational',
          ai: 'operational'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      health: { status: 'unhealthy', error: error.message }
    });
  }
});

app.post('/api/simulator/submit', async (req, res) => {
  try {
    console.log('📝 Formulario recibido:', req.body);
    
    // Validación básica
    const required = ['nombre', 'apellido', 'celular', 'email', 'direccion_inmueble'];
    const missing = required.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Campos faltantes',
        missing
      });
    }

    // Crear propiedad
    const property = await prisma.property.create({
      data: {
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        tipo_documento: req.body.tipo_documento || 'CC',
        numero_documento: req.body.numero_documento || '12345678',
        pais: req.body.pais || 'Colombia',
        celular: req.body.celular,
        email: req.body.email,
        ciudad_inmueble: req.body.ciudad_inmueble || 'Medellín',
        direccion_inmueble: req.body.direccion_inmueble,
        matricula_inmobiliaria: req.body.matricula_inmobiliaria || `MAT${Date.now()}`,
        estado_recoleccion: 'INICIADO',
        porcentaje_completitud: 0
      }
    });

    // Crear conversación
    const conversation = await prisma.conversation.create({
      data: {
        property_id: property.id,
        whatsapp_number: req.body.celular,
        estado: 'ACTIVA',
        contexto_actual: JSON.stringify({
          step: 'welcome',
          currentField: 'tipo_propiedad',
          collectedFields: []
        })
      }
    });

    console.log('✅ Propiedad creada:', property.id);
    console.log('✅ Conversación iniciada:', conversation.id);

    const welcomeMessage = `¡Hola ${req.body.nombre}! 👋

Vi que registraste tu propiedad en ${req.body.direccion_inmueble}, ${req.body.ciudad_inmueble || 'Medellín'}.
Te voy a ayudar a completar toda la información para publicarla.

¿Es un apartamento, casa, oficina o qué tipo de inmueble?`;

    res.json({
      success: true,
      message: 'Formulario procesado exitosamente',
      data: {
        propertyId: property.id,
        conversationId: conversation.id,
        whatsappNumber: req.body.celular,
        welcomeMessage,
        nextStep: 'WhatsApp conversation initiated'
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/conversation/message', async (req, res) => {
  try {
    const { whatsappNumber, message } = req.body;
    
    console.log(`📱 Mensaje de ${whatsappNumber}: "${message}"`);
    
    // Buscar conversación activa
    const conversation = await prisma.conversation.findFirst({
      where: { 
        whatsapp_number: whatsappNumber,
        estado: 'ACTIVA'
      },
      include: { property: true }
    });

    if (!conversation) {
      return res.json({
        success: false,
        error: 'No hay conversación activa para este número'
      });
    }

    const context = JSON.parse(conversation.contexto_actual || '{}');
    
    // Interpretar respuesta con IA (NO regex)
    const interpretation = await interpretUserResponse(message, context.currentField);
    
    let botResponse = "Entiendo. ";
    let nextField = context.currentField;
    const newCollectedFields = [...(context.collectedFields || [])];

    // Actualizar propiedad si se extrajo información
    if (interpretation.success && Object.keys(interpretation.data).length > 0) {
      await prisma.property.update({
        where: { id: conversation.property_id },
        data: interpretation.data
      });

      // Confirmar información recibida
      const confirmations = Object.entries(interpretation.data)
        .map(([field, value]) => {
          if (field === 'tipo_propiedad') return `Tipo: ${value}`;
          if (field === 'area_construida') return `Área: ${value} m²`;
          if (field === 'habitaciones') return `Habitaciones: ${value}`;
          if (field === 'banos') return `Baños: ${value}`;
          if (field === 'precio_venta') return `Precio: $${new Intl.NumberFormat('es-CO').format(value)}`;
          return `${field}: ${value}`;
        });

      if (confirmations.length > 0) {
        botResponse = `Perfecto! He registrado: ${confirmations.join(', ')}\n\n`;
      }

      // Marcar campos como recopilados
      Object.keys(interpretation.data).forEach(field => {
        if (!newCollectedFields.includes(field)) {
          newCollectedFields.push(field);
        }
      });
    }

    // Determinar siguiente campo
    const fieldOrder = [
      'tipo_propiedad', 'area_construida', 'habitaciones', 'banos',
      'parqueaderos', 'piso', 'estrato', 'ano_construccion', 'estado_propiedad',
      'precio_venta', 'precio_negociable', 'acepta_credito'
    ];
    
    // Buscar siguiente campo no recopilado
    nextField = fieldOrder.find(field => !newCollectedFields.includes(field));

    const fieldQuestions = {
      area_construida: "¿Cuántos metros cuadrados tiene?",
      habitaciones: "¿Cuántas habitaciones tiene?",
      banos: "¿Cuántos baños tiene?",
      parqueaderos: "¿Tiene parqueadero? ¿Cuántos?",
      piso: "¿En qué piso está ubicado?",
      estrato: "¿Cuál es el estrato socioeconómico? (1 al 6)",
      ano_construccion: "¿En qué año aproximadamente fue construido?",
      estado_propiedad: "¿Está nuevo, usado o necesita remodelación?",
      precio_venta: "¿Cuál es el precio de venta?",
      precio_negociable: "¿El precio es negociable?",
      acepta_credito: "¿Aceptas crédito hipotecario?"
    };

    if (nextField && fieldQuestions[nextField]) {
      botResponse += fieldQuestions[nextField];
    } else {
      botResponse += "¡Excelente! Hemos recopilado información importante de tu propiedad. El proceso continúa...";
    }

    // Actualizar contexto
    const newContext = {
      ...context,
      currentField: nextField,
      collectedFields: newCollectedFields,
      lastUpdate: new Date().toISOString()
    };

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        contexto_actual: JSON.stringify(newContext),
        campo_actual: nextField,
        ultimo_mensaje: new Date()
      }
    });

    // Calcular completitud
    const completeness = Math.round((newCollectedFields.length / fieldOrder.length) * 100);

    // Guardar mensajes
    await prisma.message.createMany({
      data: [
        {
          conversation_id: conversation.id,
          contenido: message,
          tipo: 'USER',
          direccion: 'RECIBIDO'
        },
        {
          conversation_id: conversation.id,
          contenido: botResponse,
          tipo: 'BOT',
          direccion: 'ENVIADO'
        }
      ]
    });

    console.log(`🤖 Respuesta: "${botResponse}"`);
    console.log(`📊 Completitud: ${completeness}% (${newCollectedFields.length}/${fieldOrder.length})`);

    res.json({
      success: true,
      message: botResponse,
      data: {
        extractedInfo: interpretation.data,
        nextField,
        completeness,
        collectedFields: newCollectedFields,
        totalFields: fieldOrder.length,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        conversaciones: {
          where: { estado: 'ACTIVA' },
          take: 1
        }
      }
    });

    res.json({
      success: true,
      data: { properties, total: properties.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const [totalProperties, activeConversations] = await Promise.all([
      prisma.property.count(),
      prisma.conversation.count({ where: { estado: 'ACTIVA' } })
    ]);

    res.json({
      success: true,
      dashboard: {
        totalProperties,
        activeConversations,
        timestamp: new Date().toISOString(),
        phase: 'FASE_1_STABLE',
        features: {
          formSimulation: true,
          aiInterpretation: true,
          database: true,
          conversationTracking: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log('✅ Conectado a base de datos Neon');
    
    console.log(`🚀 SERVIDOR INICIADO EXITOSAMENTE`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URLs importantes:`);
    console.log(`  • Home: http://localhost:${PORT}`);
    console.log(`  • Health: http://localhost:${PORT}/api/health`);
    console.log(`  • Simulator: http://localhost:${PORT}/api/simulator/submit`);
    console.log(`  • Conversation: http://localhost:${PORT}/api/conversation/message`);
    console.log(`  • Properties: http://localhost:${PORT}/api/admin/properties`);
    console.log(`  • Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
    
    console.log(`\n🎯 FUNCIONALIDADES ACTIVAS:`);
    console.log(`  ✅ Simulación de formulario`);
    console.log(`  ✅ Interpretación con GPT-4 (NO regex)`);
    console.log(`  ✅ Base de datos Neon PostgreSQL`);
    console.log(`  ✅ Seguimiento de conversaciones`);
    console.log(`  ✅ Cálculo de completitud`);
    
    console.log(`\n🧪 LISTO PARA PRUEBAS DEL SISTEMA`);
    
  } catch (error) {
    console.error('❌ Error conectando a base de datos:', error);
  }
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});