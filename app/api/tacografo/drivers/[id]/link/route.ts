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
    const { employeeId } = body;

    // Verify employee exists
    if (employeeId) {
      const employee = await prisma.empleado.findUnique({ where: { id: employeeId } });
      if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const driver = await prisma.tachographDriver.update({
      where: { id: parseInt(id) },
      data: { linkedEmployeeId: employeeId || null },
      include: { linkedEmployee: { select: { id: true, nombre: true, apellidos: true } } }
    });

    // Close related incident if linking
    if (employeeId) {
      await prisma.tachographIncident.updateMany({
        where: {
          driverId: parseInt(id),
          incidentType: 'UNIDENTIFIED_DRIVER',
          resolutionStatus: 'OPEN',
        },
        data: {
          resolutionStatus: 'RESOLVED',
          resolutionNotes: `Vinculado manualmente al empleado ID ${employeeId}`,
          resolvedAt: new Date(),
          resolvedById: parseInt(user.id),
        }
      });
    }

    return NextResponse.json(driver);
  } catch (error: any) {
    console.error('PUT /api/tacografo/drivers/[id]/link error:', error);
    return NextResponse.json({ error: 'Error al vincular conductor' }, { status: 500 });
  }
}
