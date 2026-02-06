import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { id } = await params;
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });

        const tarea = await prisma.tarea.findUnique({ where: { id: parseInt(id) } });
        if (!tarea) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

        // Permisos: ADMIN, MECANICO, OFICINA y CREADOR
        const isOwner = tarea.creadoPorId === Number(session.id);
        const hasAccess = session.rol === 'ADMIN' || session.rol === 'MECANICO' || session.rol === 'OFICINA';

        if (!isOwner && !hasAccess) {
            return NextResponse.json({ error: 'No tienes permiso para añadir adjuntos a este ticket' }, { status: 403 });
        }

        // Subida de archivo
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = join(process.cwd(), 'public', 'uploads', 'tareas');
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) { }

        const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = join(uploadDir, uniqueFileName);
        await writeFile(filePath, buffer);

        const url = `/uploads/tareas/${uniqueFileName}`;

        const adjunto = await prisma.tareaAdjunto.create({
            data: {
                tareaId: parseInt(id),
                autorId: Number(session.id),
                filename: file.name,
                url: url,
                mimeType: file.type
            },
            include: { autor: { select: { nombre: true } } }
        });

        // Registrar en el historial
        await prisma.tareaHistorial.create({
            data: {
                tareaId: parseInt(id),
                autorId: Number(session.id),
                tipoAccion: 'ADJUNTO',
                mensaje: `Se ha adjuntado un archivo: ${file.name}`
            }
        });

        return NextResponse.json(adjunto);
    } catch (error) {
        console.error('Error POST /api/tareas/[id]/adjuntos:', error);
        return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
    }
}
