/**
* Servicio de exportación a Google Sheets
* Exporta información completa cuando se termine la recolección
*/
import { google } from 'googleapis';
import { googleSheets } from '../config/index.js';
import logger from '../config/logger.js';
import { ERROR_CODES } from '../utils/constants.js';

class SheetsService {
 constructor() {
   this.credentials = googleSheets.credentials;
   this.spreadsheetId = '1QO_DzM1PjJYWreUox84eBGBAHObCPrFN1I0aFptqUrw'; // HARDCODEADO para debugging
   this.sheetName = googleSheets.sheetName;
   
   // Verificar que las credenciales estén disponibles
   if (!this.credentials) {
     logger.error('Credenciales de Google Sheets no disponibles');
     throw new Error('Credenciales de Google Sheets no configuradas');
   }
   
   // Inicializar cliente de autenticación usando las credenciales del archivo JSON
   this.auth = new google.auth.GoogleAuth({
     credentials: this.credentials,
     scopes: ['https://www.googleapis.com/auth/spreadsheets']
   });
   
   // Cliente de Google Sheets
   this.sheets = google.sheets({ version: 'v4', auth: this.auth });
 }

 /**
  * Inicializar la hoja de cálculo con headers si no existe
  */
 async initializeSheet() {
   try {
     // Verificar si la hoja existe
     const spreadsheet = await this.sheets.spreadsheets.get({
       spreadsheetId: this.spreadsheetId
     });

     const sheetExists = spreadsheet.data.sheets?.some(
       sheet => sheet.properties?.title === this.sheetName
     );

     if (!sheetExists) {
       // Crear la hoja
       await this.sheets.spreadsheets.batchUpdate({
         spreadsheetId: this.spreadsheetId,
         requestBody: {
           requests: [{
             addSheet: {
               properties: {
                 title: this.sheetName,
                 gridProperties: {
                   rowCount: 1000,
                   columnCount: 30
                 }
               }
             }
           }]
         }
       });

       logger.info('Hoja creada exitosamente', { sheetName: this.sheetName });
     }

     // Verificar si tiene headers
     const headerRange = `${this.sheetName}!A1:Z1`;
     const headerResponse = await this.sheets.spreadsheets.values.get({
       spreadsheetId: this.spreadsheetId,
       range: headerRange
     });

     if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
       // Agregar headers
       await this.addHeaders();
     }

     return true;
   } catch (error) {
     logger.error('Error al inicializar hoja de Google Sheets:', error);
     throw error;
   }
 }

 /**
  * Agregar headers a la hoja
  */
 async addHeaders() {
   const headers = [
     // Información básica
     'ID', 'Fecha Completado', 'Nombre', 'Apellido', 'Tipo Documento', 'Número Documento',
     'País', 'Celular', 'Email', 'Ciudad Inmueble', 'Dirección Inmueble', 'Matrícula Inmobiliaria',
     
     // Características físicas
     'Tipo Propiedad', 'Área Construida (m²)', 'Habitaciones', 'Baños', 'Parqueaderos',
     'Piso', 'Estrato', 'Año Construcción', 'Estado Propiedad',
     
     // Información comercial
     'Precio Venta', 'Precio Negociable', 'Motivo Venta', 'Tiempo Estimado Venta',
     'Acepta Crédito', 'Deudas Pendientes',
     
     // Documentación
     'Certificado Existencia', 'Escritura Pública', 'Paz y Salvo Admin',
     'Recibo Servicios', 'Certificado Predial', 'Fotos Inmueble',
     
     // Descripción
     'Descripción', 'Características Especiales', 'Servicios Incluidos', 'Restricciones',
     
     // Metadata
     'Porcentaje Completitud', 'Estado Recolección'
   ];

   try {
     await this.sheets.spreadsheets.values.update({
       spreadsheetId: this.spreadsheetId,
       range: `${this.sheetName}!A1:Z1`,
       valueInputOption: 'RAW',
       requestBody: {
         values: [headers]
       }
     });

     // Formatear headers
     await this.formatHeaders();
     
     logger.info('Headers agregados exitosamente a Google Sheets');
   } catch (error) {
     logger.error('Error al agregar headers:', error);
     throw error;
   }
 }

 /**
  * Formatear headers con estilo
  */
 async formatHeaders() {
   try {
     await this.sheets.spreadsheets.batchUpdate({
       spreadsheetId: this.spreadsheetId,
       requestBody: {
         requests: [
           {
             repeatCell: {
               range: {
                 sheetId: await this.getSheetId(),
                 startRowIndex: 0,
                 endRowIndex: 1,
                 startColumnIndex: 0,
                 endColumnIndex: 40
               },
               cell: {
                 userEnteredFormat: {
                   backgroundColor: { red: 0.2, green: 0.6, blue: 0.2 },
                   textFormat: {
                     foregroundColor: { red: 1, green: 1, blue: 1 },
                     bold: true
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Congelar primera fila
          {
            updateSheetProperties: {
              properties: {
                sheetId: await this.getSheetId(),
                gridProperties: {
                  frozenRowCount: 1
                }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Error al formatear headers:', error);
  }
}

/**
 * Obtener ID de la hoja específica
 * @returns {Promise<number>} ID de la hoja
 */
async getSheetId() {
  try {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === this.sheetName
    );

    return sheet?.properties?.sheetId || 0;
  } catch (error) {
    logger.error('Error al obtener ID de hoja:', error);
    return 0;
  }
}

/**
 * Exportar datos de propiedad completa a Google Sheets
 * @param {Object} propertyData - Datos completos de la propiedad
 * @returns {Promise<Object>} Resultado de la exportación
 */
async exportPropertyData(propertyData) {
  try {
    await this.initializeSheet();

    // Preparar datos para exportación
    const rowData = this.prepareRowData(propertyData);

    // Encontrar la siguiente fila vacía
    const nextRow = await this.findNextEmptyRow();

    // Insertar datos
    const range = `${this.sheetName}!A${nextRow}:Z${nextRow}`;
    
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });

    // Aplicar formato a la nueva fila
    await this.formatDataRow(nextRow);

    logger.info('Datos exportados exitosamente a Google Sheets', {
      propertyId: propertyData.id,
      row: nextRow,
      range: range
    });

    return {
      success: true,
      row: nextRow,
      range: range,
      spreadsheetId: this.spreadsheetId,
      sheetName: this.sheetName,
      url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=${await this.getSheetId()}`
    };

  } catch (error) {
    logger.error('Error al exportar datos a Google Sheets:', {
      propertyId: propertyData.id,
      error: error.message
    });

    return {
      success: false,
      error: ERROR_CODES.SHEETS_ERROR,
      message: error.message
    };
  }
}

/**
 * Preparar datos de la propiedad para inserción en la hoja
 * @param {Object} propertyData - Datos de la propiedad
 * @returns {Array} Array con los datos preparados
 */
prepareRowData(propertyData) {
  return [
    // Información básica
    propertyData.id || '',
    propertyData.fecha_completado ? new Date(propertyData.fecha_completado).toLocaleString('es-CO') : new Date().toLocaleString('es-CO'),
    propertyData.nombre || '',
    propertyData.apellido || '',
    propertyData.tipo_documento || '',
    propertyData.numero_documento || '',
    propertyData.pais || '',
    propertyData.celular || '',
    propertyData.email || '',
    propertyData.ciudad_inmueble || '',
    propertyData.direccion_inmueble || '',
    propertyData.matricula_inmobiliaria || '',
    
    // Características físicas
    propertyData.tipo_propiedad || '',
    propertyData.area_construida || '',
    propertyData.habitaciones || '',
    propertyData.banos || '',
    propertyData.parqueaderos || '',
    propertyData.piso || '',
    propertyData.estrato || '',
    propertyData.ano_construccion || '',
    propertyData.estado_propiedad || '',
    
    // Información comercial
    propertyData.precio_venta ? `$${new Intl.NumberFormat('es-CO').format(propertyData.precio_venta)}` : '',
    propertyData.precio_negociable ? (propertyData.precio_negociable ? 'Sí' : 'No') : '',
    propertyData.motivo_venta || '',
    propertyData.tiempo_estimado_venta || '',
    propertyData.acepta_credito ? (propertyData.acepta_credito ? 'Sí' : 'No') : '',
    propertyData.deudas_pendientes || '',
    
    // Documentación
    propertyData.certificado_existencia ? 'Recibido' : 'Pendiente',
    propertyData.escritura_publica ? 'Recibido' : 'Pendiente',
    propertyData.paz_salvo_admin ? 'Recibido' : 'Pendiente',
    propertyData.recibo_servicios ? 'Recibido' : 'Pendiente',
    propertyData.certificado_predial ? 'Recibido' : 'Pendiente',
    propertyData.fotos_inmueble || 0,
    
    // Descripción
    propertyData.descripcion || '',
    propertyData.caracteristicas_especiales || '',
    propertyData.servicios_incluidos || '',
    propertyData.restricciones || '',
    
    // Metadata
    `${propertyData.porcentaje_completitud || 0}%`,
    propertyData.estado_recoleccion || ''
  ];
}

/**
 * Encontrar la siguiente fila vacía en la hoja
 * @returns {Promise<number>} Número de la siguiente fila vacía
 */
async findNextEmptyRow() {
  try {
    const range = `${this.sheetName}!A:A`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: range
    });

    const values = response.data.values || [];
    return values.length + 1;
  } catch (error) {
    logger.error('Error al encontrar siguiente fila vacía:', error);
    return 2; // Comenzar en fila 2 si hay error
  }
}

/**
 * Aplicar formato a una fila de datos
 * @param {number} rowNumber - Número de fila a formatear
 */
async formatDataRow(rowNumber) {
  try {
    const sheetId = await this.getSheetId();
    
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          // Alternar color de fila para mejor legibilidad
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: rowNumber - 1,
                endRowIndex: rowNumber,
                startColumnIndex: 0,
                endColumnIndex: 40
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: rowNumber % 2 === 0 
                    ? { red: 0.95, green: 0.95, blue: 0.95 }
                    : { red: 1, green: 1, blue: 1 }
                }
              },
              fields: 'userEnteredFormat.backgroundColor'
            }
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Error al formatear fila de datos:', error);
  }
}

/**
 * Verificar conectividad con Google Sheets
 * @returns {Promise<boolean>} Estado de conexión
 */
async checkConnection() {
  try {
    await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'spreadsheetId,properties.title'
    });

    logger.info('Conexión con Google Sheets verificada exitosamente');
    return true;
  } catch (error) {
    logger.error('Error de conexión con Google Sheets:', error);
    return false;
  }
}

/**
 * Obtener estadísticas de la hoja
 * @returns {Promise<Object>} Estadísticas
 */
async getSheetStats() {
  try {
    const properties = await this.getExportedProperties();
    
    const stats = {
      totalProperties: properties.length,
      completedToday: properties.filter(prop => {
        const today = new Date().toDateString();
        const propDate = new Date(prop.fechaCompletado).toDateString();
        return today === propDate;
      }).length,
      byType: {},
      byStatus: {}
    };

    // Agrupar por tipo
    properties.forEach(prop => {
      const type = prop.tipoPropiedad || 'Sin especificar';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    // Agrupar por estado
    properties.forEach(prop => {
      const status = prop.estado || 'Sin especificar';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;

  } catch (error) {
    logger.error('Error al obtener estadísticas de la hoja:', error);
    return {
      totalProperties: 0,
      completedToday: 0,
      byType: {},
      byStatus: {}
    };
  }
}

/**
 * Obtener todas las propiedades exportadas
 * @returns {Promise<Array>} Lista de propiedades
 */
async getExportedProperties() {
  try {
    const range = `${this.sheetName}!A2:Z`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: range
    });

    const values = response.data.values || [];
    
    return values.map((row, index) => ({
      row: index + 2,
      id: row[0],
      fechaCompletado: row[1],
      nombre: row[2],
      apellido: row[3],
      direccion: row[10],
      tipoPropiedad: row[12],
      precio: row[21],
      estado: row[37]
    }));

  } catch (error) {
    logger.error('Error al obtener propiedades exportadas:', error);
    return [];
  }
}
}

// Crear instancia singleton
const sheetsService = new SheetsService();

export default sheetsService;