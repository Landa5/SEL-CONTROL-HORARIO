import { NextResponse } from 'next/server';
import { prisma, withWriteClient } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { processImport } from '@/lib/tacografo/tachograph-service';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const importRecord = await prisma.tachographImport.findUnique({
      where: { id: parseInt(id) },
      include: {
        driver: {
          include: { linkedEmployee: { select: { id: true, nombre: true, apellidos: true } } }
        },
        vehicle: {
          include: { linkedVehicle: { select: { id: true, matricula: true, marca: true, modelo: true } } }
        },
        uploadedBy: { select: { id: true, nombre: true } },
        normalizedEvents: {
          orderBy: { startAtUtc: 'asc' as const }
        },
        rawEvents: {
          orderBy: { rawStartAt: 'asc' as const }
        },
        legacyActivities: {
          orderBy: { startTime: 'asc' as const }
        },
        incidents: {
          orderBy: { createdAt: 'desc' }
        },
      }
    });

    if (!importRecord) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 });
    }

    return NextResponse.json(importRecord);
  } catch (error: any) {
    console.error('GET /api/tacografo/imports/[id] error:', error);
    return NextResponse.json({ error: 'Error al obtener importación' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reviewed } = body;

    const updateData: any = {};
    if (reviewed) {
      updateData.reviewedAt = new Date();
      updateData.reviewedById = parseInt(user.id);
    }

    const updated = await prisma.tachographImport.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/tacografo/imports/[id] error:', error);
    return NextResponse.json({ error: 'Error al actualizar importación' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Solo administradores pueden borrar importaciones' }, { status: 403 });
    }

    const { id } = await params;
    const importId = parseInt(id);

    // Use DIRECT_URL for writes (pooler may route to read-only replicas)
    await withWriteClient(async (client) => {
      // Delete in dependency order: MatchAudit → NormalizedEvent → RawEvent → Incident → ActivityLegacy → Import
      await client.$executeRawUnsafe(`DELETE FROM "TachographMatchAudit" WHERE "normalizedEventId" IN (SELECT "id" FROM "TachographNormalizedEvent" WHERE "importId" = $1)`, importId);
      await client.$executeRawUnsafe(`DELETE FROM "TachographNormalizedEvent" WHERE "importId" = $1`, importId);
      await client.$executeRawUnsafe(`DELETE FROM "TachographRawEvent" WHERE "importId" = $1`, importId);
      await client.$executeRawUnsafe(`DELETE FROM "TachographIncident" WHERE "importId" = $1`, importId);
      await client.$executeRawUnsafe(`DELETE FROM "TachographActivityLegacy" WHERE "importId" = $1`, importId);
      await client.$executeRawUnsafe(`DELETE FROM "TachographImport" WHERE "id" = $1`, importId);
    });

    return NextResponse.json({ success: true, message: 'Importación eliminada correctamente' });
  } catch (error: any) {
    console.error('DELETE /api/tacografo/imports/[id] error:', error);
    return NextResponse.json({ error: `Error al eliminar: ${error.message}` }, { status: 500 });
  }
}
