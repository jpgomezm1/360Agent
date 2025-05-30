// server-test.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(helmet());

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas básicas
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bot WhatsApp Inmobiliario - Testing Mode',
    version: '1.0.0-TEST',
    status: 'operational',
    endpoints: {
      health: '/api/health',
      simulator: '/api/simulator/submit',
      properties: '/api/admin/properties'
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    // Test de conexión a BD
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      health: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0-TEST',
        database: 'connected',
        services: {
          api: 'operational',
          database: 'operational'
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      health: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
});

app.post('/api/simulator/submit', async (req, res) => {
  try {
    console.log('📝 Formulario recibido:', JSON.stringify(req.body, null, 2));
    
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

    // Crear propiedad en la base de datos
    const property = await prisma.property.create({
      data: {
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        tipo_documento: req.body.tipo_documento || 'CC',
        numero_documento: req.body.numero_documento,
        pais: req.body.pais || 'Colombia',
        celular: req.body.celular,
        email: req.body.email,
        ciudad_inmueble: req.body.ciudad_inmueble,
        direccion_inmueble: req.body.direccion_inmueble,
        matricula_inmobiliaria: req.body.matricula_inmobiliaria,
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

    res.json({
      success: true,
      message: 'Formulario procesado exitosamente',
      data: {
        propertyId: property.id,
        conversationId: conversation.id,
        whatsappNumber: req.body.celular,
        nextStep: 'WhatsApp conversation initiated',
        welcomeMessage: `¡Hola ${req.body.nombre}! Vi que registraste tu propiedad en ${req.body.direccion_inmueble}, ${req.body.ciudad_inmueble}. Te voy a ayudar a completar toda la información para publicarla.`
      }
    });

  } catch (error) {
    console.error('❌ Error creando propiedad:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
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
      data: {
        properties,
        total: properties.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
        phase: 'FASE_1_TESTING',
        features: {
          formSimulation: true,
          database: true,
          basicAPI: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    // Test de conexión a BD
    await prisma.$connect();
    console.log('✅ Conectado a base de datos');
    
    console.log(`🚀 Servidor iniciado en modo testing`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URLs importantes:`);
    console.log(`  • Home: http://localhost:${PORT}`);
    console.log(`  • Health: http://localhost:${PORT}/api/health`);
    console.log(`  • Simulator: http://localhost:${PORT}/api/simulator/submit`);
    console.log(`  • Properties: http://localhost:${PORT}/api/admin/properties`);
    console.log(`  • Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
    console.log(`\n✅ Sistema listo para pruebas`);
    
  } catch (error) {
    console.error('❌ Error conectando a base de datos:', error);
  }
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});