# Bot WhatsApp Inmobiliario - Fase 1

Bot conversacional inteligente para recopilación de información de propiedades inmobiliarias a través de WhatsApp.

## 🚀 Características

- **Conversación Natural**: Usa GPT-4 para interpretar respuestas del usuario (NO regex)
- **Sistema RAG**: Base de conocimiento para responder preguntas contextuales
- **Seguimiento Inteligente**: Tracking en tiempo real de campos completados
- **Exportación Automática**: Google Sheets cuando esté completa la información
- **Notificaciones**: Email via Resend al completar recolección

## 🛠 Stack Tecnológico

- **Backend**: Node.js 18+ con ES6 modules, Express.js, TypeScript
- **Base de Datos**: Neon DB (PostgreSQL) con Prisma ORM
- **IA**: OpenAI GPT-4, LangChain.js, OpenAI Embeddings
- **RAG**: Weaviate Cloud
- **WhatsApp**: UltraMSG API
- **Email**: Resend (NO Gmail/SMTP)
- **Sheets**: Google Sheets API

## 📋 Información Recopilada

### Del Formulario (Simulado)
- Datos personales: nombre, apellido, documento, celular, email
- Ubicación: ciudad, dirección, matrícula inmobiliaria

### Por el Bot (Conversacional)
- **Características Físicas**: tipo, área, habitaciones, baños, parqueaderos, piso, estrato, año construcción, estado
- **Información Comercial**: precio, negociable, motivo venta, tiempo estimado, acepta crédito, deudas
- **Documentación**: certificados, escritura, paz y salvo, recibos, fotos (mín. 5)
- **Descripción**: descripción detallada (mín. 50 palabras), características especiales, servicios, restricciones

## 🚦 Instalación

```bash
# Clonar y configurar
git clone <repo>
cd real-estate-bot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Configurar base de datos
npx prisma generate
npx prisma db push

# Iniciar en desarrollo
npm run dev