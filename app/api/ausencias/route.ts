import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view'); // 'all' for admin

        let whereClause = {};

        if ((session.rol === 'ADMIN' || session.rol === 'OFICINA') && view === 'all') {
            // Admin and Office can see all requests
        } else {
            // Employee sees only their own
            whereClause = { empleadoId: Number(session.id) };
        }

        const ausencias = await prisma.ausencia.findMany({
            where: whereClause,
            include: {
                empleado: {
                    select: { nombre: true, usuario: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(ausencias);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener ausencias' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const formData = await request.formData();
        const tipo = formData.get('tipo') as string;
        const fechaInicioStr = formData.get('fechaInicio') as string;
        const fechaFinStr = formData.get('fechaFin') as string;
        const observaciones = formData.get('observaciones') as string;
        const file = formData.get('justificante') as File | null;

        if (!tipo || !fechaInicioStr || !fechaFinStr) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const fechaInicio = new Date(fechaInicioStr);
        const fechaFin = new Date(fechaFinStr);

        if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
            return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
        }

        let justificanteUrl = null;

        if (file && file.size > 0) {
            try {
                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const finalName = `${uniqueSuffix}-${filename}`;
                const path = join(process.cwd(), 'public', 'uploads', 'justificantes', finalName);

                await writeFile(path, buffer);
                justificanteUrl = `/uploads/justificantes/${finalName}`;
            } catch (fileError) {
                console.error('Error saving file:', fileError);
            }
        }

        const ausencia = await prisma.ausencia.create({
            data: {
                tipo,
                fechaInicio,
                fechaFin,
                observaciones: observaciones || null,
                justificanteUrl,
                empleadoId: Number(session.id),
                estado: tipo === 'VACACIONES' ? 'PENDIENTE' : 'APROBADA'
            }
        });

        // NOTIFICATION: Admin -> solicitud vacaciones
        const admins = await prisma.empleado.findMany({ where: { rol: 'ADMIN' } });
        for (const admin of admins) {
            await prisma.notificacion.create({
                data: {
                    usuarioId: admin.id,
                    mensaje: `Nueva solicitud de ${tipo}: ${session.nombre}`,
                    link: '/admin/dashboard'
                }
            });
        }

        return NextResponse.json(ausencia);
    } catch (error) {
        console.error('Error creating absence:', error);
        return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 });
    }
}
