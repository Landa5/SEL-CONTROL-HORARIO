import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleadoId');
    const camionId = searchParams.get('camionId');

    const whereClause: any = {};
    if (empleadoId) whereClause.empleadoId = Number(empleadoId);
    if (camionId) whereClause.camionId = Number(camionId);

    // Security: Drivers can only see their own docs (unless admin/office)
    if (session.rol === 'CONDUCTOR' && empleadoId && Number(empleadoId) !== Number(session.id)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    try {
        const docs = await prisma.documento.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(docs);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching documents' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || (session.rol !== 'ADMIN' && session.rol !== 'OFICINA')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const nombre = formData.get('nombre') as string;
        const tipo = formData.get('tipo') as string;
        const fechaCaducidadStr = formData.get('fechaCaducidad') as string;
        const empleadoId = formData.get('empleadoId') as string;
        const camionId = formData.get('camionId') as string;

        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

        // Save file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure directory exists
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'docs');
        await mkdir(uploadDir, { recursive: true });

        // Unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.name.split('.').pop();
        const filename = `${uniqueSuffix}.${extension}`;
        const filepath = join(uploadDir, filename);

        await writeFile(filepath, buffer);

        // Create DB record
        const doc = await prisma.documento.create({
            data: {
                nombre: nombre || file.name,
                tipo,
                url: `/uploads/docs/${filename}`,
                mimeType: file.type,
                fechaCaducidad: fechaCaducidadStr ? new Date(fechaCaducidadStr) : null,
                empleadoId: empleadoId ? Number(empleadoId) : null,
                camionId: camionId ? Number(camionId) : null,
                subidoPorId: Number(session.id)
            }
        });

        return NextResponse.json(doc);
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Error uploading document' }, { status: 500 });
    }
}
