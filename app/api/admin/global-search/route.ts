import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const q = (searchParams.get('q') || '').trim();

        if (!q || q.length < 1) {
            return NextResponse.json({ empleados: [], camiones: [], tareas: [], ausencias: [] });
        }

        const [empleados, camiones, tareas, ausencias] = await Promise.all([
            prisma.empleado.findMany({
                where: {
                    OR: [
                        { nombre: { contains: q, mode: 'insensitive' } },
                        { apellidos: { contains: q, mode: 'insensitive' } },
                        { usuario: { contains: q, mode: 'insensitive' } },
                        { dni: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    nombre: true,
                    apellidos: true,
                    rol: true,
                    activo: true,
                    dni: true
                },
                take: 6
            }),
            prisma.camion.findMany({
                where: {
                    OR: [
                        { matricula: { contains: q, mode: 'insensitive' } },
                        { modelo: { contains: q, mode: 'insensitive' } },
                        { marca: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    matricula: true,
                    marca: true,
                    modelo: true,
                    activo: true,
                    kmActual: true
                },
                take: 6
            }),
            prisma.tarea.findMany({
                where: {
                    OR: [
                        { titulo: { contains: q, mode: 'insensitive' } },
                        { descripcion: { contains: q, mode: 'insensitive' } },
                        { matricula: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    titulo: true,
                    estado: true,
                    prioridad: true,
                    tipo: true,
                    matricula: true
                },
                orderBy: { createdAt: 'desc' },
                take: 6
            }),
            prisma.ausencia.findMany({
                where: {
                    OR: [
                        { tipo: { contains: q, mode: 'insensitive' } },
                        { empleado: { nombre: { contains: q, mode: 'insensitive' } } },
                        { empleado: { apellidos: { contains: q, mode: 'insensitive' } } }
                    ]
                },
                select: {
                    id: true,
                    tipo: true,
                    estado: true,
                    fechaInicio: true,
                    fechaFin: true,
                    empleado: { select: { id: true, nombre: true, apellidos: true } }
                },
                orderBy: { fechaInicio: 'desc' },
                take: 5
            })
        ]);

        return NextResponse.json({
            empleados,
            camiones,
            tareas,
            ausencias
        });
    } catch (error) {
        console.error('Error in global search:', error);
        return NextResponse.json({ empleados: [], camiones: [], tareas: [], ausencias: [] });
    }
}
