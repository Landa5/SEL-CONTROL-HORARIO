import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { calcularNominaEmpleado } from '@/lib/nominas/calculos';

// POST /api/nominas/generar
// Generates/Recalculates payroll for all active employees for a given month
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user = await verifyToken(session);
        if (!user || user.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { year, month } = body;

        if (!year || !month) return NextResponse.json({ error: 'Año y mes requeridos' }, { status: 400 });

        const empleados = await prisma.empleado.findMany({
            where: { activo: true }
        });

        const results = [];

        for (const emp of empleados) {
            // Check if closed
            const existing = await prisma.nominaMes.findUnique({
                where: {
                    empleadoId_year_month: {
                        empleadoId: emp.id,
                        year: parseInt(year),
                        month: parseInt(month)
                    }
                }
            });

            if (existing && existing.estado !== 'BORRADOR') {
                results.push({ id: emp.id, status: 'SKIPPED', reason: 'Ya cerrada o enviada' });
                continue;
            }

            // Calculate Lines
            // If existing draft exists, we decided whether to wipe lines or try to merge overrides.
            // Simplest logic: If Recalculating, we WIPE calculated lines but KEEP overridden lines?
            // "Permitir edición/override con trazabilidad".
            // If we regenerate, we usually want to refresh data. 
            // If user manually overrode a line, we should probably Keep it or warn.
            // For MVP: Wipe all non-overridden lines. Keep overridden lines.

            // 1. Calculate theoretical lines
            const calculatedLines = await calcularNominaEmpleado(emp.id, parseInt(year), parseInt(month));

            // 2. Prepare Transaction
            // If draft exists, delete lines that are NOT overrides.
            if (existing) {
                // Fetch current lines to preserve overrides
                const currentLines = await prisma.nominaLinea.findMany({
                    where: { nominaId: existing.id }
                });

                // Map of overridden lines
                const overridden = new Map();
                currentLines.forEach(l => {
                    if (l.override) overridden.set(l.conceptoCodigo, l);
                });

                // Delete all lines (simplification for clean state, then re-insert mixing calc + overrides)
                await prisma.nominaLinea.deleteMany({ where: { nominaId: existing.id } });

                // Merge: Use override if exists, else use calculated
                const finalLines: any[] = [];
                const codesProcessed = new Set();

                // Add calculated lines (unless overridden)
                calculatedLines.forEach(cl => {
                    codesProcessed.add(cl.codigo);
                    if (overridden.has(cl.codigo)) {
                        const ov = overridden.get(cl.codigo);
                        // Re-insert the Override as is
                        finalLines.push({
                            conceptoCodigo: ov.conceptoCodigo,
                            conceptoNombre: ov.conceptoNombre,
                            cantidad: ov.cantidad,
                            rate: ov.rate,
                            importe: ov.importe,
                            override: true,
                            notas: ov.notas,
                            updatedBy: ov.updatedBy,
                            orden: 1
                        });
                    } else {
                        // Insert new calculated
                        finalLines.push({
                            conceptoCodigo: cl.codigo,
                            conceptoNombre: cl.nombre,
                            cantidad: cl.cantidad,
                            rate: cl.rate,
                            importe: cl.importe,
                            override: false,
                            notas: null,
                            updatedBy: null,
                            orden: 1
                        });
                    }
                });

                // Also add any overridden lines that were NOT in calculation (manually added extra concepts)
                overridden.forEach((ov, code) => {
                    if (!codesProcessed.has(code)) {
                        finalLines.push({
                            conceptoCodigo: ov.conceptoCodigo,
                            conceptoNombre: ov.conceptoNombre,
                            cantidad: ov.cantidad,
                            rate: ov.rate,
                            importe: ov.importe,
                            override: true,
                            notas: ov.notas,
                            updatedBy: ov.updatedBy,
                            orden: 2
                        });
                    }
                });

                // Calculate Totals
                const totalVariables = finalLines.reduce((sum, l) => sum + l.importe, 0);

                await prisma.nominaMes.update({
                    where: { id: existing.id },
                    data: {
                        totalVariables,
                        updatedAt: new Date(),
                        lineas: {
                            create: finalLines
                        }
                    }
                });
                results.push({ id: emp.id, status: 'UPDATED' });

            } else {
                // New Draft
                const totalVariables = calculatedLines.reduce((sum, l) => sum + l.importe, 0);

                await prisma.nominaMes.create({
                    data: {
                        empleadoId: emp.id,
                        year: parseInt(year),
                        month: parseInt(month),
                        estado: 'BORRADOR',
                        totalVariables,
                        lineas: {
                            create: calculatedLines.map(cl => ({
                                conceptoCodigo: cl.codigo,
                                conceptoNombre: cl.nombre,
                                cantidad: cl.cantidad,
                                rate: cl.rate,
                                importe: cl.importe
                            }))
                        }
                    }
                });
                results.push({ id: emp.id, status: 'CREATED' });
            }
        }

        return NextResponse.json({ message: 'Generación completada', results });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error generando nóminas' + error }, { status: 500 });
    }
}
