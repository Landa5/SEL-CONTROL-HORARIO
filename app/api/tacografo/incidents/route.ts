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
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const incidentType = searchParams.get('type');
    const driverId = searchParams.get('driverId');
    const vehicleId = searchParams.get('vehicleId');

    const where: any = {};
    if (status) where.resolutionStatus = status;
    if (severity) where.severity = severity;
    if (incidentType) where.incidentType = incidentType;
    if (driverId) where.driverId = parseInt(driverId);
    if (vehicleId) where.vehicleId = parseInt(vehicleId);

    const incidents = await prisma.tachographIncident.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, plateNumber: true } },
        import: { select: { id: true, fileName: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json(incidents);
  } catch (error: any) {
    console.error('GET /api/tacografo/incidents error:', error);
    return NextResponse.json({ error: 'Error al obtener incidencias' }, { status: 500 });
  }
}
