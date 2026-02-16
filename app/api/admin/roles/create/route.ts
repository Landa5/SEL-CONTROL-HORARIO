import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || user.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { nombre, descripcion } = body;

        const newRol = await prisma.rol.create({
            data: {
                nombre,
                descripcion,
                esSistema: false
            }
        });

        return NextResponse.json(newRol);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
