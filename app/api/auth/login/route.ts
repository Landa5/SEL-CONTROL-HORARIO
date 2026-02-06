import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { usuario, password } = await request.json();

        const empleado = await prisma.empleado.findUnique({
            where: { usuario },
        });

        if (!empleado || !empleado.activo) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
        }

        const passwordsMatch = await comparePassword(password, empleado.password);
        if (!passwordsMatch) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
        }

        // Create session
        const token = await signToken({
            id: empleado.id,
            usuario: empleado.usuario,
            nombre: empleado.nombre,
            rol: empleado.rol
        });

        const response = NextResponse.json({ success: true, rol: empleado.rol });
        response.cookies.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return response;
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
