import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

// Importamos usando require para evitar problemas de ESM en Next.js
const pdf = require('pdf-parse');

const apiKey = (process.env.GOOGLE_API_KEY || '').trim();
const genAI = new GoogleGenerativeAI(apiKey);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function processWorkshopInvoices() {
    console.log('--- INICIANDO PROCESAMIENTO DE FACTURAS (ENGINE) ---');

    // Intentamos varias rutas por si acaso en Windows
    const projectRoot = process.cwd();
    const directoryPath = path.join(projectRoot, 'facturas-taller');

    console.log('Ruta del proyecto:', projectRoot);
    console.log('Buscando en carpeta:', directoryPath);

    if (!fs.existsSync(directoryPath)) {
        console.error('ERROR: La carpeta no existe físicamente en:', directoryPath);
        return { success: false, message: `La carpeta no existe en: ${directoryPath}` };
    }

    const allFiles = fs.readdirSync(directoryPath);
    console.log('Archivos encontrados en total:', allFiles.length);
    console.log('Lista completa:', allFiles);

    const files = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log('Archivos PDF detectados:', files.length);

    if (files.length === 0) {
        return {
            success: true,
            message: `No hay facturas PDF en ${directoryPath}. (Total archivos: ${allFiles.length})`,
            count: 0
        };
    }

    if (!process.env.GOOGLE_API_KEY) {
        return { success: false, message: 'Falta la API Key de Google (GOOGLE_API_KEY) en el servidor.' };
    }

    const results = [];
    let processedCount = 0;

    for (const file of files) {
        let filePath = '';
        let textContent = '';
        try {
            filePath = path.join(directoryPath, file);
            const dataBuffer = fs.readFileSync(filePath);

            // Extract text from PDF
            // Estamos usando pdf-parse v2.4.5, que puede requerir la clase PDFParse
            const { PDFParse } = pdf;

            if (PDFParse) {
                // Modo v2 (Clase)
                const parser = new PDFParse({ data: dataBuffer });
                const result = await parser.getText();
                textContent = result.text;
                await parser.destroy();
            } else {
                // Modo v1 (Función)
                const pdfFunc = typeof pdf === 'function' ? pdf : pdf.default;
                if (typeof pdfFunc !== 'function') {
                    throw new Error('No se pudo cargar la librería pdf-parse (ni v1 ni v2). Verifica la instalación.');
                }
                const pdfData = await pdfFunc(dataBuffer);
                textContent = pdfData.text;
            }

            console.log(`Procesando ${file}: ${textContent.length} caracteres extraídos.`);
            if (textContent.trim().length < 10) {
                console.warn(`Aviso: ${file} parece estar vacío o ser una imagen.`, textContent);
            }

            // Retry wrapper for AI Generation
            let text = '';
            let retries = 0;
            const maxRetries = 3;
            let success = false;

            while (retries <= maxRetries && !success) {
                try {
                    // Use Gemini to parse the technical data
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                    // Initial sleep for rate limiting standard
                    if (retries === 0) await sleep(6000);

                    const prompt = `
                        Analiza el siguiente texto de una factura de taller mecánico y extrae los datos técnicos en formato JSON puro.
                        Si no encuentras un dato, deja el campo como null o array vacío.
                        
                        IMPORTANTE: La matrícula debe ser la del camión que ha sido reparado.
                        
                        Campos requeridos:
                        - matricula (String, ej: "1234ABC" o "1234-ABC")
                        - fecha (String en formato ISO, ej: "2023-12-31")
                        - km (Número entero, kilómetros que marca el vehículo en la factura)
                        - piezas (Array de strings con las principales piezas cambiadas)
                        - total (Número, el importe total de la factura)
                        - taller (String, nombre del taller)

                        Texto de la factura:
                        ${textContent.substring(0, 10000)}
                    `;

                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    text = response.text();
                    success = true;

                } catch (apiError: any) {
                    if (apiError.message?.includes('429') || apiError.message?.includes('quota')) {
                        retries++;
                        if (retries <= maxRetries) {
                            const delay = 10000 * Math.pow(2, retries - 1); // 10s, 20s, 40s
                            console.warn(`Cuota excedida (429) en ${file}. Reintentando en ${delay / 1000}s... (Intento ${retries}/${maxRetries})`);
                            await sleep(delay);
                        } else {
                            throw apiError; // Exhausted retries
                        }
                    } else {
                        throw apiError; // Other error, don't retry
                    }
                }
            }

            console.log(`Respuesta IA para ${file}:`, text);

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta de la IA');

            const extractedData = JSON.parse(jsonMatch[0]);

            if (extractedData.matricula) {
                // Normalizar matrícula para búsqueda (quitar guiones y espacios)
                const normalizedMatricula = extractedData.matricula.replace(/[- ]/g, '').toUpperCase();
                console.log(`Buscando camión: ${normalizedMatricula} (original: ${extractedData.matricula})`);

                const trucks = await prisma.camion.findMany();
                const truck = trucks.find(t => t.matricula.replace(/[- ]/g, '').toUpperCase() === normalizedMatricula);

                if (truck) {
                    await prisma.mantenimientoRealizado.create({
                        data: {
                            camionId: truck.id,
                            fecha: extractedData.fecha ? new Date(extractedData.fecha) : new Date(),
                            kmEnEseMomento: extractedData.km || truck.kmActual,
                            tipo: 'TALLER_EXTERNO',
                            descripcion: `Procesado por IA desde factura: ${file}`,
                            piezasCambiadas: extractedData.piezas?.join(', ') || null,
                            costo: extractedData.total || null,
                            taller: extractedData.taller || 'Desconocido'
                        }
                    });

                    if (extractedData.km && extractedData.km > truck.kmActual) {
                        await prisma.camion.update({
                            where: { id: truck.id },
                            data: { kmActual: extractedData.km }
                        });
                    }

                    const processedDir = path.join(directoryPath, 'procesadas');
                    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);
                    fs.renameSync(filePath, path.join(processedDir, file));

                    processedCount++;
                    results.push({ file, status: 'success', data: extractedData });
                } else {
                    console.warn(`Camión no encontrado: ${normalizedMatricula}`);
                    results.push({ file, status: 'error', message: `Camión ${extractedData.matricula} no encontrado en la base de datos.` });
                }
            } else {
                console.warn(`No se detectó matrícula en ${file}`);
                results.push({ file, status: 'error', message: 'Matrícula no detectada.' });
            }

        } catch (error: any) {
            console.error(`Error procesando ${file}:`, error);

            // Fallback: Try regex extraction if AI fails
            if (textContent && textContent.length > 50) {
                console.log(`Intentando extracción por Regex para ${file} debido a error de IA...`);
                try {
                    // Strategy 1: Reverse Lookup (Check if any known truck plate is in the text)
                    const trucks = await prisma.camion.findMany();
                    const normalize = (s: string) => s.replace(/[- .]/g, '').toUpperCase();

                    // Clean text for searching
                    const cleanText = textContent.replace(/[- .]/g, '').toUpperCase();

                    let foundTruck = null;
                    let matriculaDetected = '';

                    // Sort by length desc or just iterate
                    for (const truck of trucks) {
                        const plateClean = normalize(truck.matricula);
                        // Ensure we don't match empty strings or very short junk
                        if (plateClean.length > 3 && cleanText.includes(plateClean)) {
                            foundTruck = truck;
                            matriculaDetected = truck.matricula;
                            console.log(`Fallback: Encontrado camión conocido en texto: ${truck.matricula}`);
                            break;
                        }
                    }

                    // Strategy 2: Generic Regex if no known truck found
                    if (!foundTruck) {
                        // Mod: More flexible regex allowing dots, dashes and spaces
                        const matriculaMatch = textContent.match(/([0-9]{4})[\s.-]?([B-Z]{3})/i) ||
                            textContent.match(/([A-Z]{1,2})[\s.-]?([0-9]{4})[\s.-]?([A-Z]{1,2})/i);
                        if (matriculaMatch) {
                            // Reconstruct based on match type
                            if (matriculaMatch.length === 3) {
                                matriculaDetected = `${matriculaMatch[1]}${matriculaMatch[2]}`.toUpperCase(); // 1234ABC
                            } else {
                                matriculaDetected = `${matriculaMatch[1]}${matriculaMatch[2]}${matriculaMatch[3]}`.toUpperCase(); // M1234AB
                            }
                            console.log(`Fallback: Regex encontró matrícula potencial: ${matriculaDetected}`);

                            // Try to find this truck
                            foundTruck = trucks.find(t => normalize(t.matricula) === normalize(matriculaDetected));
                        }
                    }

                    // Common extraction for other fields
                    // Improved Regex for Amounts (Euopean format 1.234,56 or 1234.56)
                    const totalMatch = textContent.match(/TOTAL[:\s]*([\d.,]+)\s*€?/i) ||
                        textContent.match(/IMPORTE[:\s]*([\d.,]+)\s*€?/i) ||
                        textContent.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s?€/);

                    // Improved Regex for Dates (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)
                    const fechaMatch = textContent.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/) ||
                        textContent.match(/(\d{1,2})\sde\s([a-zA-Z]+)\sde\s(\d{4})/); // "15 de Agosto de 2023"

                    // Try to find KM (Keywords: KM, Kilometros, Kms)
                    const kmMatch = textContent.match(/KM[:\s]*([\d.,]+)/i) ||
                        textContent.match(/Kilometros[:\s]*([\d.,]+)/i) ||
                        textContent.match(/(\d+[\d.,]*)\s*KM/i);

                    let fechaDate = new Date();
                    if (fechaMatch) {
                        try {
                            if (fechaMatch[2].length > 2) {
                                // Handle month names if needed, for now simplistic fallback
                                fechaDate = new Date();
                            } else {
                                // Standard numeric date
                                fechaDate = new Date(`${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`);
                            }
                        } catch (e) { fechaDate = new Date(); }
                    }

                    let extractedTotal = 0;
                    if (totalMatch) {
                        // Normalize number: remove dots (thousands), replace comma with dot (decimal)
                        // This assumes European format 1.000,00. If US format, this needs logic adjustment.
                        // Safe approach: remove all non-numeric except last separator
                        let raw = totalMatch[1];
                        raw = raw.replace(/\./g, '').replace(',', '.');
                        extractedTotal = parseFloat(raw);
                    }

                    let extractedKm = foundTruck?.kmActual || 0;
                    if (kmMatch) {
                        let rawKm = kmMatch[1].replace(/\./g, '').replace(',', '');
                        extractedKm = parseInt(rawKm);
                    }

                    if (foundTruck) {
                        // Fake a successful extraction
                        const extractedData = {
                            matricula: matriculaDetected,
                            fecha: fechaDate.toISOString().split('T')[0],
                            km: extractedKm,
                            piezas: ['Mantenimiento General (Recuperado por Fallback)'],
                            total: extractedTotal,
                            taller: 'Taller Detectado (Fallback System)'
                        };

                        await prisma.mantenimientoRealizado.create({
                            data: {
                                camionId: foundTruck.id,
                                fecha: new Date(extractedData.fecha),
                                kmEnEseMomento: extractedData.km,
                                tipo: 'TALLER_EXTERNO',
                                descripcion: `Procesado (Modo Fallback): ${file}`,
                                piezasCambiadas: extractedData.piezas.join(', '),
                                costo: extractedData.total || 0,
                                taller: extractedData.taller
                            }
                        });

                        const processedDir = path.join(directoryPath, 'procesadas');
                        if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);
                        // Check if file still exists before rename (in case it was moved)
                        if (fs.existsSync(filePath)) {
                            fs.renameSync(filePath, path.join(processedDir, file));
                        }

                        processedCount++;
                        results.push({ file, status: 'success', data: extractedData, source: 'fallback' });
                        continue; // Skip the error push
                    } else {
                        console.warn('Fallback: No se pudo identificar ningún camión en la factura.');
                    }
                } catch (fallbackError) {
                    console.error('Error en fallback:', fallbackError);
                }
            }

            // Si es un error de cuota (429) y falló el fallback
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                let msg = 'Límite de cuota IA alcanzado.';

                if (!textContent || textContent.length < 50) {
                    msg += ' El PDF parece ser una IMAGEN escaneada (sin texto detectado), por lo que el modo manual no funciona. Debes esperar a que se restablezca la cuota de Google.';
                } else {
                    msg += ' El modo manual intentó leerlo pero no encontró ninguna matrícula conocida en el texto. Revisa que la matrícula esté bien escrita en el PDF o en la base de datos.';
                }

                results.push({ file, status: 'error', message: msg });
                break;
            }
            results.push({ file, status: 'error', message: error.message });
        }
    }

    return {
        success: true,
        message: `Procesamiento completado: ${processedCount} facturas integradas.`,
        count: processedCount,
        details: results
    };
}
