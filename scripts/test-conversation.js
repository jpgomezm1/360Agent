#!/usr/bin/env node
/**
 * Script para probar conversación completa
 * Uso: npm run test-conversation
 */
import conversationManager from '../src/core/conversationManager.js';

async function testConversation() {
  try {
    console.log('🤖 Probando conversación completa...');

    // Datos de prueba
    const testProperty = {
      nombre: "Test",
      apellido: "Usuario",
      tipo_documento: "CC",
      numero_documento: "123456789",
      pais: "Colombia",
      celular: "573000000000",
      email: "test@example.com",
      ciudad_inmueble: "Medellín",
      direccion_inmueble: "Calle Test # 123",
      matricula_inmobiliaria: `TEST_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    // Inicializar conversación
    console.log('📞 Inicializando conversación...');
    const initResult = await conversationManager.initializeConversation(testProperty);
    
    if (!initResult.success) {
      throw new Error(`Error al inicializar: ${initResult.message}`);
    }

    console.log('✅ Conversación inicializada:', initResult.propertyId);

    // Simular respuestas del usuario
    const responses = [
      "Es un apartamento",
      "Está en el piso 5 y tiene 80 metros cuadrados",
      "Tiene 3 habitaciones y 2 baños",
      "Sí, tiene 1 parqueadero",
      "Es estrato 4",
      "Fue construido en 2015",
      "Está usado pero en buen estado",
      "El precio es 350 millones de pesos",
      "Sí, el precio es negociable",
      "Nos mudamos por trabajo",
      "Esperamos venderlo en 3-6 meses",
      "Sí, aceptamos crédito hipotecario",
      "No tiene deudas pendientes"
    ];

    // Procesar cada respuesta
    for (let i = 0; i < responses.length; i++) {
      console.log(`\n📝 Procesando respuesta ${i + 1}: "${responses[i]}"`);
      
      const result = await conversationManager.processUserMessage(
        testProperty.celular,
        responses[i]
      );

      if (result.success) {
        console.log(`✅ Respuesta procesada. Completitud: ${result.completionPercentage || 'N/A'}%`);
        if (result.nextField) {
          console.log(`🔄 Siguiente campo: ${result.nextField}`);
        }
        if (result.type === 'completion') {
          console.log('🎉 ¡Conversación completada!');
          break;
        }
      } else {
        console.log(`❌ Error: ${result.message}`);
      }

      // Pequeña pausa entre mensajes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ Test de conversación completado');

  } catch (error) {
    console.error('❌ Error en test de conversación:', error);
    process.exit(1);
  }
}

// Ejecutar test
testConversation();