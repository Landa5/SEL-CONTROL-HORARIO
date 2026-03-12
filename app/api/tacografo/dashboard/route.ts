import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getDashboardData } from '@/lib/tacografo/tachograph-service';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('GET /api/tacografo/dashboard error:', error);
    return NextResponse.json({ error: 'Error al obtener dashboard' }, { status: 500 });
  }
}
