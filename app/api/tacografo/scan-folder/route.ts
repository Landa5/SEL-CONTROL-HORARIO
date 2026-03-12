import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { scanInputFolder } from '@/lib/tacografo/tachograph-service';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN'].includes(user.rol)) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const result = await scanInputFolder(parseInt(user.id));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST /api/tacografo/scan-folder error:', error);
    return NextResponse.json({ error: 'Error al escanear carpeta' }, { status: 500 });
  }
}
