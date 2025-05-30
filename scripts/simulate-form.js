#!/usr/bin/env node
/**
 * Script para simular envío de formulario
 * Uso: npm run simulate
 */
import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function simulateFormSubmission() {
  try {
    console.log('🚀 Simulando envío de formulario...');

    const formData = {
      nombre: "Carlos",
      apellido: "Martínez",
      tipo_documento: "CC",
      numero_documento: "98765432",
      pais: "Colombia",
      celular: "573157894561",
      email: "carlos.martinez@test.com",
      ciudad_inmueble: "Bogotá",
      direccion_inmueble: "Calle 100 # 15-30",
      matricula_inmobiliaria: `SCRIPT_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const response = await axios.post(`${BASE_URL}/api/simulator/submit`, formData);

    if (response.data.success) {
      console.log('✅ Formulario enviado exitosamente');
      console.log('📊 Datos:', response.data.data);
    } else {
      console.log('❌ Error:', response.data.error);
    }

  } catch (error) {
    console.error('❌ Error al enviar formulario:', error.response?.data || error.message);
  }
}

// Ejecutar simulación
simulateFormSubmission();