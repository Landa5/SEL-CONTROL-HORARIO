import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const body = await request.json();
        const { moduloId, respuestas } = body; // respuestas: { preguntaId: "A", ... }

        if (!moduloId) return NextResponse.json({ error: 'ID de módulo requerido' }, { status: 400 });

        const modulo = await prisma.moduloFormacion.findUnique({
            where: { id: parseInt(moduloId) },
            include: { preguntas: true }
        });

        if (!modulo) return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 });

        // Date and active check
        const now = new Date();
        if (!modulo.activo || modulo.fechaInicio > now || modulo.fechaFin < now) {
            return NextResponse.json({ error: 'La evaluación está bloqueada porque el módulo no está activo o ha expirado.' }, { status: 403 });
        }

        // Check attempts
        const existingResult = await prisma.resultadoFormacion.findUnique({
            where: {
                empleadoId_moduloId: {
                    empleadoId: parseInt(user.id),
                    moduloId: parseInt(moduloId)
                }
            }
        });

        if (existingResult && existingResult.intentos >= 2) {
            return NextResponse.json({ error: 'Has alcanzado el máximo de intentos permitidos (2).' }, { status: 403 });
        }

        // Calculate score
        let totalPoints = 0;
        let earnedPoints = 0;

        modulo.preguntas.forEach(q => {
            totalPoints += q.puntos;
            if (respuestas[q.id] === q.correcta) {
                earnedPoints += q.puntos;
            }
        });

        const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = percentage >= 70;

        // Upsert result
        const result = await prisma.resultadoFormacion.upsert({
            where: {
                empleadoId_moduloId: {
                    empleadoId: parseInt(user.id),
                    moduloId: parseInt(moduloId)
                }
            },
            update: {
                puntuacion: Math.round(percentage),
                aprobado: passed,
                intentos: { increment: 1 },
                completadoAl: now
            },
            create: {
                empleadoId: parseInt(user.id),
                moduloId: parseInt(moduloId),
                puntuacion: Math.round(percentage),
                aprobado: passed,
                intentos: 1,
                completadoAl: now
            }
        });

        return NextResponse.json({
            success: true,
            score: Math.round(percentage),
            passed,
            attempts: result.intentos
        });

    } catch (error) {
        console.error('POST /api/formacion/evaluacion error:', error);
        return NextResponse.json({ error: 'Error al procesar la evaluación' }, { status: 500 });
    }
}
