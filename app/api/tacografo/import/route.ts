import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { processImport } from '@/lib/tacografo/tachograph-service';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await processImport(
        buffer,
        file.name,
        file.type || null,
        parseInt(user.id),
        'MANUAL_UPLOAD'
      );
      
      results.push({
        fileName: file.name,
        ...result
      });
    }

    return NextResponse.json({
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('POST /api/tacografo/import error:', error);
    return NextResponse.json({ error: 'Error al importar archivos' }, { status: 500 });
  }
}
