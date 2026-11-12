import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/nominas/config
// Returns all tariff overrides and active concepts
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || (user.rol && user.rol.toUpperCase() !== 'ADMIN')) {
            console.log('Unauthorized config access attempt:', user?.rol);
            return NextResponse.json({ error: `No autorizado (Tu rol es: ${user?.rol})` }, { status: 403 });
        }

        const concepts = await prisma.conceptoNomina.findMany({
            where: { active: true },
            include: {
                tarifas: {
                    where: { activo: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        // Always ensure defaults exist (not just when empty)
        const defaults = [
            { codigo: 'PRECIO_KM', nombre: 'Precio por KM' },
            { codigo: 'PRECIO_DESCARGA', nombre: 'Precio por Descarga' },
            { codigo: 'PRECIO_VIAJE', nombre: 'Precio por Viaje' },
            { codigo: 'PRECIO_DESCARGA_SABADO', nombre: 'Precio Descarga Sábado' },
            { codigo: 'PRECIO_LITRO', nombre: 'Precio Litro (Comercial)' },
            { codigo: 'PRODUCTIVIDAD_FIJA', nombre: 'Productividad Fija' },
            { codigo: 'DIETAS', nombre: 'Dietas' },
            { codigo: 'DIETAS_COMERCIAL', nombre: 'Dietas Comercial' },
            { codigo: 'DIETA_TOPE', nombre: 'Tope Dietas (Mensual)' },
            { codigo: 'HORAS_EXTRA', nombre: 'Horas Extra' },
            { codigo: 'FESTIVO_TRABAJADO', nombre: 'Festivo Trabajado' },
            { codigo: 'INCENTIVOS', nombre: 'Incentivos' },
            { codigo: 'DESCUENTO_AUSENCIA', nombre: 'Descuento por Ausencia' },
            { codigo: 'DESCUENTO_VACACIONES', nombre: 'Descuento por Vacaciones' },
            { codigo: 'PORCENTAJE_PRODUCTIVIDAD', nombre: '% Productividad (sobre resto)' },
            // Nuevos Incentivos
            { codigo: 'PLUS_ANTIGUEDAD', nombre: 'Plus Antigüedad' },
            { codigo: 'BONUS_SEGURIDAD', nombre: 'Bonus Seguridad y No Siniestralidad' },
            { codigo: 'PLUS_FORMACION', nombre: 'Plus Formación y Títulos' },
            { codigo: 'PLUS_DISPONIBILIDAD', nombre: 'Plus Disponibilidad / Guardias' },
            { codigo: 'BONUS_PUNTUALIDAD', nombre: 'Bonus Puntualidad' },
            { codigo: 'BONUS_CONSUMO', nombre: 'Bonus Consumo Eficiente' },
        ];

        // Ensure all defaults exist
        await Promise.all(defaults.map(d =>
            prisma.conceptoNomina.upsert({
                where: { codigo: d.codigo },
                update: {},
                create: { codigo: d.codigo, nombre: d.nombre }
            })
        ));

        // Re-fetch everything to include newly created ones and tariffs
        const finalConcepts = await prisma.conceptoNomina.findMany({
            where: { active: true },
            include: {
                tarifas: {
                    where: { activo: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        return NextResponse.json(finalConcepts);

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

// POST /api/nominas/config
// Upserts a tariff (Create new version effectively, or update existing if simple)
// Use simple update for MVP: upsert based on (conceptoId, rol, empleadoId) logic or just create new active one.
// Simplification: We will just Create a new active Tarifa, and deactivate old ones for same scope.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || (user.rol && user.rol.toUpperCase() !== 'ADMIN')) {
            return NextResponse.json({ error: `No autorizado (Tu rol es: ${user?.rol})` }, { status: 403 });
        }

        const body = await request.json();
        console.log('POST /api/nominas/config payload:', body);
        const { conceptoId, valor, rol, empleadoId } = body;

        const parsedConceptoId = parseInt(conceptoId);
        const parsedRol = rol || null;
        const parsedEmpleadoId = empleadoId ? parseInt(empleadoId) : null;
        const parsedValor = parseFloat(valor);

        // Check if an active tariff for this exact scope already has the same value
        const existingActive = await prisma.tarifaNomina.findFirst({
            where: {
                conceptoId: parsedConceptoId,
                rol: parsedRol,
                empleadoId: parsedEmpleadoId,
                activo: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingActive && Math.abs(Number(existingActive.valor) - parsedValor) < 0.0001) {
            return NextResponse.json(existingActive);
        }

        // Deactivate previous active tariff for this scope
        await prisma.tarifaNomina.updateMany({
            where: {
                conceptoId: parsedConceptoId,
                rol: parsedRol,
                empleadoId: parsedEmpleadoId,
                activo: true
            },
            data: { activo: false, fechaFin: new Date() }
        });

        const tarifa = await prisma.tarifaNomina.create({
            data: {
                conceptoId: parsedConceptoId,
                rol: parsedRol,
                empleadoId: parsedEmpleadoId,
                valor: parsedValor,
                activo: true
            }
        });

        console.log('Tarifa created:', tarifa);
        return NextResponse.json(tarifa);

    } catch (error: any) {
        console.error('Error in POST /api/nominas/config:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
