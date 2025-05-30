import weaviate from 'weaviate-ts-client';

console.log('🧪 PRUEBA DE CONEXIÓN WEAVIATE (CREDENCIALES DIRECTAS)');
console.log('====================================================');

// Credenciales directas
const WEAVIATE_URL = "1m2nyjhrqrqytkz3hlqe0q.c0.us-west3.gcp.weaviate.cloud";
const WEAVIATE_API_KEY = "HhA9j0Mgd8g8jlj94mMOHZBHOeSyVvUS1puC";
const OPENAI_API_KEY = "sk-proj-DhOcNQ6y7Y2H5jjWjdKhIZWfJh3xCOIuTGYTK2HEehE1wO8USDnGnN0-TbZOzVQQOPaHxBLnQ8T3BlbkFJONu-pZfJV5D2iy-lJlVqVUvCAgEtLuaJHLQFHCN9pjnYW9_X-g5Hbt8aKxKGdBKK6JoJ5cA4A";

// Mostrar configuración
console.log('📋 Configuración:');
console.log(`URL: ${WEAVIATE_URL}`);
console.log(`API Key: ${WEAVIATE_API_KEY.substring(0, 8)}...`);
console.log(`Host procesado: ${WEAVIATE_URL.replace('https://', '')}`);

// Probar diferentes configuraciones de cliente
console.log('\n🔍 Prueba 1: Cliente básico con scheme y host separados...');

const client1 = weaviate.client({
  scheme: 'https',
  host: WEAVIATE_URL.replace('https://', ''),
  apiKey: WEAVIATE_API_KEY,
  headers: {
    'X-OpenAI-Api-Key': OPENAI_API_KEY
  }
});

console.log('\n🔍 Prueba 2: Cliente con configuración alternativa...');

const client2 = weaviate.client({
  scheme: 'https',
  host: WEAVIATE_URL.replace('https://', ''),
  apiKey: WEAVIATE_API_KEY,
  headers: {
    'Authorization': `Bearer ${WEAVIATE_API_KEY}`,
    'X-OpenAI-Api-Key': OPENAI_API_KEY
  }
});

console.log('\n🔍 Prueba 3: Cliente con URL completa...');

const client3 = weaviate.client({
  scheme: 'https',
  host: '1m2nyjhrqrqytkz3hlqe0q.c0.us-west3.gcp.weaviate.cloud',
  apiKey: WEAVIATE_API_KEY
});

async function testClient(client, clientName) {
  try {
    console.log(`\n🧪 Probando ${clientName}...`);
    const meta = await client.misc.metaGetter().do();
    console.log(`✅ ${clientName} - Conexión exitosa`);
    console.log(`📊 Versión: ${meta.version}`);
    console.log(`📊 Hostname: ${meta.hostname}`);
    return true;
  } catch (error) {
    console.error(`❌ ${clientName} - Error:`, error.message);
    
    if (error.message.includes('401')) {
      console.error(`🔑 ${clientName} - Problema de autenticación`);
    }
    if (error.message.includes('403')) {
      console.error(`🚫 ${clientName} - Problema de permisos`);
    }
    if (error.message.includes('ENOTFOUND')) {
      console.error(`🌐 ${clientName} - Problema de DNS/conectividad`);
    }
    
    return false;
  }
}

async function testAllClients() {
  console.log('\n🚀 Iniciando pruebas de conectividad...');
  
  const results = {
    client1: await testClient(client1, 'Cliente 1 (Configuración actual)'),
    client2: await testClient(client2, 'Cliente 2 (Con Authorization header)'),
    client3: await testClient(client3, 'Cliente 3 (Sin OpenAI headers)')
  };
  
  console.log('\n📊 RESUMEN DE RESULTADOS:');
  Object.entries(results).forEach(([name, success]) => {
    console.log(`${success ? '✅' : '❌'} ${name}: ${success ? 'EXITOSO' : 'FALLÓ'}`);
  });
  
  const successfulClient = results.client1 ? client1 : 
                          results.client2 ? client2 : 
                          results.client3 ? client3 : null;
  
  if (successfulClient) {
    console.log('\n🔍 Probando operaciones avanzadas con cliente exitoso...');
    await testAdvancedOperations(successfulClient);
  } else {
    console.log('\n❌ Ningún cliente funcionó. Revisando configuración...');
    await debugConfiguration();
  }
}

async function testAdvancedOperations(client) {
  try {
    console.log('\n🔍 Paso A: Obteniendo esquemas...');
    const schema = await client.schema.getter().do();
    console.log(`✅ Esquemas obtenidos: ${schema.classes?.length || 0} clases`);
    
    console.log('\n🔍 Paso B: Probando crear clase...');
    const testClassName = 'TestClass' + Date.now();
    
    await client.schema.classCreator().withClass({
      class: testClassName,
      description: 'Clase de prueba',
      properties: [{
        name: 'content',
        dataType: ['text'],
        description: 'Contenido de prueba'
      }]
    }).do();
    
    console.log('✅ Clase creada exitosamente');
    
    console.log('\n🔍 Paso C: Limpiando...');
    await client.schema.classDeleter().withClassName(testClassName).do();
    console.log('✅ Clase eliminada exitosamente');
    
    console.log('\n🎉 TODAS LAS OPERACIONES EXITOSAS');
    
  } catch (error) {
    console.error('\n❌ Error en operaciones avanzadas:', error.message);
  }
}

async function debugConfiguration() {
  console.log('\n🔍 DEBUG DE CONFIGURACIÓN:');
  console.log(`URL original: ${WEAVIATE_URL}`);
  console.log(`Host procesado: ${WEAVIATE_URL.replace('https://', '')}`);
  console.log(`API Key length: ${WEAVIATE_API_KEY.length}`);
  console.log(`API Key starts with: ${WEAVIATE_API_KEY.substring(0, 4)}`);
  
  // Probar conectividad básica
  console.log('\n🔍 Probando conectividad básica con fetch...');
  try {
    const response = await fetch(`${WEAVIATE_URL}/v1/meta`, {
      headers: {
        'Authorization': `Bearer ${WEAVIATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📊 Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Conectividad básica OK');
      console.log('📊 Meta data:', data);
    } else {
      const error = await response.text();
      console.error('❌ Error en respuesta:', error);
    }
    
  } catch (fetchError) {
    console.error('❌ Error en fetch:', fetchError.message);
  }
}

// Ejecutar todas las pruebas
testAllClients().then(() => {
  console.log('\n✅ Pruebas completadas');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Error fatal:', error);
  process.exit(1);
});