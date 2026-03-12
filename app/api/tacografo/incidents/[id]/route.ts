import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

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
    const { resolutionStatus, resolutionNotes } = body;

    const updateData: any = {};
    if (resolutionStatus) {
      updateData.resolutionStatus = resolutionStatus;
      if (resolutionStatus === 'RESOLVED' || resolutionStatus === 'DISMISSED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = parseInt(user.id);
      }
    }
    if (resolutionNotes !== undefined) {
      updateData.resolutionNotes = resolutionNotes;
    }

    const incident = await prisma.tachographIncident.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json(incident);
  } catch (error: any) {
    console.error('PUT /api/tacografo/incidents/[id] error:', error);
    return NextResponse.json({ error: 'Error al actualizar incidencia' }, { status: 500 });
  }
}
