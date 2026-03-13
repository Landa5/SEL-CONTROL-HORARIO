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
    const linked = searchParams.get('linked'); // 'true', 'false', or null

    const where: any = { active: true };
    if (linked === 'true') where.linkedEmployeeId = { not: null };
    if (linked === 'false') where.linkedEmployeeId = null;

    const drivers = await prisma.tachographDriver.findMany({
      where,
      include: {
        linkedEmployee: { select: { id: true, nombre: true, apellidos: true, rol: true, dni: true } },
        _count: { select: { imports: true, normalizedEvents: true, incidents: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json(drivers);
  } catch (error: any) {
    console.error('GET /api/tacografo/drivers error:', error);
    return NextResponse.json({ error: 'Error al obtener conductores' }, { status: 500 });
  }
}
