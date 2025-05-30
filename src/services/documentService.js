/**
 * Servicio para procesamiento de documentos y OCR
 * Maneja archivos PDF, imágenes y extracción de texto
 */
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
// REMOVIDO: import pdfParse from 'pdf-parse'; 
// Se usa importación dinámica para evitar el error de inicialización
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import { FILE_CONFIG, ERROR_CODES, DOCUMENT_TYPES } from '../utils/constants.js';

class DocumentService {
  constructor() {
    this.uploadDir = 'uploads';
    this.tempDir = 'temp';
    this.allowedTypes = FILE_CONFIG.ALLOWED_TYPES;
    this.maxFileSize = FILE_CONFIG.MAX_SIZE;
    
    // Crear directorios si no existen
    this.initializeDirectories();
  }

  /**
   * Inicializar directorios necesarios
   */
  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info('Directorios de documentos inicializados', {
        uploadDir: this.uploadDir,
        tempDir: this.tempDir
      });
    } catch (error) {
      logger.error('Error al inicializar directorios:', error);
    }
  }

  /**
   * Procesar documento recibido por WhatsApp
   * @param {Object} fileData - Datos del archivo recibido
   * @param {string} propertyId - ID de la propiedad
   * @param {string} documentType - Tipo de documento
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processDocument(fileData, propertyId, documentType) {
    let tempFilePath = null;
    
    try {
      // Validar tipo de archivo
      const fileExtension = this.getFileExtension(fileData.filename || fileData.name);
      if (!this.isValidFileType(fileExtension)) {
        return {
          success: false,
          error: ERROR_CODES.FILE_ERROR,
          message: `Tipo de archivo no permitido: ${fileExtension}`
        };
      }

      // Validar tamaño
      if (fileData.size && fileData.size > this.maxFileSize) {
        return {
          success: false,
          error: ERROR_CODES.FILE_ERROR,
          message: `Archivo demasiado grande. Máximo ${this.maxFileSize / 1024 / 1024}MB`
        };
      }

      // Generar nombre único para el archivo
      const uniqueFilename = this.generateUniqueFilename(propertyId, documentType, fileExtension);
      const finalPath = join(this.uploadDir, uniqueFilename);
      tempFilePath = join(this.tempDir, `temp_${uuidv4()}.${fileExtension}`);

      // Descargar archivo temporal
      await this.downloadFile(fileData.url, tempFilePath);

      // Procesar según el tipo de archivo
      let extractedText = '';
      let processedData = {};

      if (this.isImageFile(fileExtension)) {
        // Procesar imagen con OCR
        const ocrResult = await this.extractTextFromImage(tempFilePath);
        extractedText = ocrResult.text;
        processedData = ocrResult;
      } else if (fileExtension === 'pdf') {
        // Procesar PDF
        const pdfResult = await this.extractTextFromPDF(tempFilePath);
        extractedText = pdfResult.text;
        processedData = pdfResult;
      }

      // Mover archivo a ubicación final
      await fs.rename(tempFilePath, finalPath);
      tempFilePath = null; // Ya no necesita limpieza

      // Validar contenido del documento si es necesario
      const validation = await this.validateDocumentContent(extractedText, documentType);

      logger.info('Documento procesado exitosamente', {
        propertyId,
        documentType,
        filename: uniqueFilename,
        extractedTextLength: extractedText.length,
        validation: validation.isValid
      });

      return {
        success: true,
        filename: uniqueFilename,
        path: finalPath,
        extractedText,
        processedData,
        validation,
        fileSize: fileData.size,
        originalName: fileData.filename || fileData.name
      };

    } catch (error) {
      logger.error('Error al procesar documento:', {
        propertyId,
        documentType,
        error: error.message
      });

      // Limpiar archivo temporal si existe
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          logger.error('Error al limpiar archivo temporal:', cleanupError);
        }
      }

      return {
        success: false,
        error: ERROR_CODES.FILE_ERROR,
        message: error.message
      };
    }
  }

  /**
   * Extraer texto de imagen usando OCR
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Promise<Object>} Texto extraído y metadata
   */
  async extractTextFromImage(imagePath) {
    try {
      // Optimizar imagen para mejor OCR
      const optimizedPath = await this.optimizeImageForOCR(imagePath);
      
      // Ejecutar OCR
      const { data } = await Tesseract.recognize(optimizedPath, 'spa', {
        logger: progress => {
          if (progress.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${Math.round(progress.progress * 100)}%`);
          }
        }
      });

      // Limpiar imagen optimizada temporal
      if (optimizedPath !== imagePath) {
        await fs.unlink(optimizedPath);
      }

      return {
        text: data.text.trim(),
        confidence: data.confidence,
        words: data.words?.length || 0,
        lines: data.lines?.length || 0
      };

    } catch (error) {
      logger.error('Error en OCR de imagen:', error);
      throw error;
    }
  }

  /**
   * Optimizar imagen para mejor reconocimiento OCR
   * @param {string} imagePath - Ruta de la imagen original
   * @returns {Promise<string>} Ruta de la imagen optimizada
   */
  async optimizeImageForOCR(imagePath) {
    try {
      const optimizedPath = join(this.tempDir, `optimized_${uuidv4()}.png`);
      
      await sharp(imagePath)
        .resize(null, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .normalize()
        .sharpen()
        .greyscale()
        .png({ quality: 100 })
        .toFile(optimizedPath);

      return optimizedPath;
    } catch (error) {
      logger.error('Error al optimizar imagen:', error);
      return imagePath; // Retornar original si falla la optimización
    }
  }

  /**
   * Extraer texto de archivo PDF
   * @param {string} pdfPath - Ruta del archivo PDF
   * @returns {Promise<Object>} Texto extraído y metadata
   */
  async extractTextFromPDF(pdfPath) {
    try {
      // IMPORTACIÓN DINÁMICA PARA EVITAR EL ERROR DE pdf-parse
      const pdfParse = (await import('pdf-parse')).default;
      
      const dataBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(dataBuffer);

      return {
        text: pdfData.text.trim(),
        pages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata
      };

    } catch (error) {
      logger.error('Error al extraer texto de PDF:', error);
      
      // Si falla pdf-parse, intentar procesamiento básico
      try {
        // Retornar estructura básica si no se puede procesar el PDF
        return {
          text: 'PDF recibido - procesamiento de texto no disponible',
          pages: 1,
          info: {},
          metadata: {}
        };
      } catch (fallbackError) {
        throw error; // Lanzar el error original
      }
    }
  }

  /**
   * Validar contenido del documento según su tipo
   * @param {string} extractedText - Texto extraído del documento
   * @param {string} documentType - Tipo de documento
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateDocumentContent(extractedText, documentType) {
    try {
      const lowerText = extractedText.toLowerCase();
      let isValid = false;
      let confidence = 0;
      let issues = [];

      switch (documentType) {
        case DOCUMENT_TYPES.CERTIFICADO_EXISTENCIA:
          isValid = lowerText.includes('certificado') && 
                   (lowerText.includes('existencia') || lowerText.includes('representación'));
          confidence = isValid ? 0.8 : 0.2;
          if (!isValid) issues.push('No parece ser un certificado de existencia');
          break;

        case DOCUMENT_TYPES.ESCRITURA_PUBLICA:
          isValid = lowerText.includes('escritura') && lowerText.includes('pública');
          confidence = isValid ? 0.8 : 0.2;
          if (!isValid) issues.push('No parece ser una escritura pública');
          break;

        case DOCUMENT_TYPES.RECIBO_SERVICIOS:
          isValid = lowerText.includes('servicios') || 
                   lowerText.includes('factura') || 
                   lowerText.includes('recibo');
          confidence = isValid ? 0.7 : 0.3;
          if (!isValid) issues.push('No parece ser un recibo de servicios');
          break;

        case DOCUMENT_TYPES.CERTIFICADO_PREDIAL:
          isValid = lowerText.includes('certificado') && 
                   (lowerText.includes('tradición') || lowerText.includes('libertad'));
          confidence = isValid ? 0.8 : 0.2;
          if (!isValid) issues.push('No parece ser un certificado de tradición y libertad');
          break;

        default:
          isValid = extractedText.length > 10; // Validación básica
          confidence = 0.5;
      }

      return {
        isValid,
        confidence,
        issues,
        hasText: extractedText.length > 0,
        textLength: extractedText.length
      };

    } catch (error) {
      logger.error('Error al validar contenido de documento:', error);
      return {
        isValid: false,
        confidence: 0,
        issues: ['Error al validar documento'],
        hasText: false,
        textLength: 0
      };
    }
  }

  /**
   * Descargar archivo desde URL
   * @param {string} url - URL del archivo
   * @param {string} destinationPath - Ruta de destino
   */
  async downloadFile(url, destinationPath) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error al descargar archivo: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(destinationPath, Buffer.from(buffer));

    } catch (error) {
      logger.error('Error al descargar archivo:', error);
      throw error;
    }
  }

  /**
   * Generar nombre único para archivo
   * @param {string} propertyId - ID de la propiedad
   * @param {string} documentType - Tipo de documento
   * @param {string} extension - Extensión del archivo
   * @returns {string} Nombre único
   */
  generateUniqueFilename(propertyId, documentType, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueId = uuidv4().substr(0, 8);
    return `${propertyId}_${documentType}_${timestamp}_${uniqueId}.${extension}`;
  }

  /**
   * Obtener extensión de archivo
   * @param {string} filename - Nombre del archivo
   * @returns {string} Extensión en minúsculas
   */
  getFileExtension(filename) {
    return extname(filename).slice(1).toLowerCase();
  }

  /**
   * Verificar si el tipo de archivo es válido
   * @param {string} extension - Extensión del archivo
   * @returns {boolean} True si es válido
   */
  isValidFileType(extension) {
    return this.allowedTypes.includes(extension);
  }

  /**
   * Verificar si es archivo de imagen
   * @param {string} extension - Extensión del archivo
   * @returns {boolean} True si es imagen
   */
  isImageFile(extension) {
    return ['jpg', 'jpeg', 'png'].includes(extension);
  }

  /**
   * Obtener información de archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object>} Información del archivo
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const extension = this.getFileExtension(filePath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension,
        isImage: this.isImageFile(extension),
        isPDF: extension === 'pdf'
      };

    } catch (error) {
      logger.error('Error al obtener información de archivo:', error);
      return null;
    }
  }

  /**
   * Eliminar archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<boolean>} True si se eliminó exitosamente
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info('Archivo eliminado exitosamente', { filePath });
      return true;
    } catch (error) {
      logger.error('Error al eliminar archivo:', { filePath, error: error.message });
      return false;
    }
  }

  /**
   * Limpiar archivos temporales antiguos
   * @param {number} maxAgeHours - Edad máxima en horas
   * @returns {Promise<number>} Número de archivos eliminados
   */
  async cleanupTempFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.tempDir);
      let deletedCount = 0;
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convertir a millisegundos

      for (const file of files) {
        const filePath = join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > maxAge) {
          await this.deleteFile(filePath);
          deletedCount++;
        }
      }

      logger.info('Limpieza de archivos temporales completada', {
        deletedCount,
        maxAgeHours
      });

      return deletedCount;

    } catch (error) {
      logger.error('Error en limpieza de archivos temporales:', error);
      return 0;
    }
  }

  /**
   * Obtener estadísticas de archivos
   * @returns {Promise<Object>} Estadísticas
   */
  async getFileStats() {
    try {
      const uploadFiles = await fs.readdir(this.uploadDir);
      const tempFiles = await fs.readdir(this.tempDir);

      let totalSize = 0;
      const fileTypes = {};

      for (const file of uploadFiles) {
        const filePath = join(this.uploadDir, file);
        const stats = await fs.stat(filePath);
        const extension = this.getFileExtension(file);
        
        totalSize += stats.size;
        fileTypes[extension] = (fileTypes[extension] || 0) + 1;
      }

      return {
        uploadedFiles: uploadFiles.length,
        tempFiles: tempFiles.length,
        totalSizeMB: Math.round(totalSize / 1024 / 1024),
        fileTypes
      };

    } catch (error) {
      logger.error('Error al obtener estadísticas de archivos:', error);
      return {
        uploadedFiles: 0,
        tempFiles: 0,
        totalSizeMB: 0,
        fileTypes: {}
      };
    }
  }
}

// Crear instancia singleton
const documentService = new DocumentService();

export default documentService;