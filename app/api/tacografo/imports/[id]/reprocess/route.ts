import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { processImport } from '@/lib/tacografo/tachograph-service';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Solo administradores pueden reprocesar' }, { status: 403 });
    }

    const { id } = await params;
    const importRecord = await prisma.tachographImport.findUnique({
      where: { id: parseInt(id) }
    });

    if (!importRecord) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 });
    }

    // Read original file
    const filePath = path.join(process.cwd(), 'public', importRecord.rawFilePath);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo original no encontrado en disco' }, { status: 404 });
    }

    // Delete old data for this import (in dependency order)
    // MatchAudit → NormalizedEvent → RawEvent → Incident → ActivityLegacy
    const normalizedIds = await prisma.tachographNormalizedEvent.findMany({
      where: { importId: importRecord.id },
      select: { id: true },
    });
    if (normalizedIds.length > 0) {
      await prisma.tachographMatchAudit.deleteMany({
        where: { normalizedEventId: { in: normalizedIds.map(n => n.id) } }
      });
    }
    await prisma.tachographNormalizedEvent.deleteMany({ where: { importId: importRecord.id } });
    await prisma.tachographRawEvent.deleteMany({ where: { importId: importRecord.id } });
    await prisma.tachographIncident.deleteMany({ where: { importId: importRecord.id } });
    await prisma.tachographActivityLegacy.deleteMany({ where: { importId: importRecord.id } });

    // Delete the import record (hash will allow re-insert)
    const oldHash = importRecord.fileHash;
    await prisma.tachographImport.delete({ where: { id: importRecord.id } });

    // Re-process
    const buffer = fs.readFileSync(filePath);
    const result = await processImport(
      buffer,
      importRecord.fileName,
      importRecord.mimeType,
      parseInt(user.id),
      importRecord.sourceType as any
    );

    return NextResponse.json({
      message: 'Archivo reprocesado',
      ...result
    });
  } catch (error: any) {
    console.error('POST /api/tacografo/imports/[id]/reprocess error:', error);
    return NextResponse.json({ error: 'Error al reprocesar' }, { status: 500 });
  }
}
