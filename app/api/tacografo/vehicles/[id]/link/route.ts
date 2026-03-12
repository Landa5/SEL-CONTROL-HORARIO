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
    const { vehicleId } = body;

    if (vehicleId) {
      const camion = await prisma.camion.findUnique({ where: { id: vehicleId } });
      if (!camion) return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 });
    }

    const vehicle = await prisma.tachographVehicle.update({
      where: { id: parseInt(id) },
      data: { linkedVehicleId: vehicleId || null },
      include: { linkedVehicle: { select: { id: true, matricula: true, marca: true, modelo: true } } }
    });

    if (vehicleId) {
      await prisma.tachographIncident.updateMany({
        where: {
          vehicleId: parseInt(id),
          incidentType: 'UNIDENTIFIED_VEHICLE',
          resolutionStatus: 'OPEN',
        },
        data: {
          resolutionStatus: 'RESOLVED',
          resolutionNotes: `Vinculado manualmente al camión ID ${vehicleId}`,
          resolvedAt: new Date(),
          resolvedById: parseInt(user.id),
        }
      });
    }

    return NextResponse.json(vehicle);
  } catch (error: any) {
    console.error('PUT /api/tacografo/vehicles/[id]/link error:', error);
    return NextResponse.json({ error: 'Error al vincular vehículo' }, { status: 500 });
  }
}
