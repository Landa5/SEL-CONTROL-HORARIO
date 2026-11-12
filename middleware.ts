import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value;
    const { pathname } = request.nextUrl;

    // 1. Protect all /api/admin/* endpoints at middleware level
    if (pathname.startsWith('/api/admin')) {
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        const payload = await verifyToken(session);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
        }
        const rol = String((payload as any).rol || '').toUpperCase();
        if (!['ADMIN', 'OFICINA', 'MECANICO'].includes(rol)) {
            return NextResponse.json({ error: 'No autorizado para rutas de administración' }, { status: 403 });
        }
        return NextResponse.next();
    }

    const protectedRoutes = ['/admin', '/empleado', '/oficina', '/mecanico'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (!session && isProtectedRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (session) {
        const payload = await verifyToken(session);
        if (!payload) {
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('session');
            return response;
        }

        const roleRoutes: Record<string, string> = {
            'ADMIN': '/admin/dashboard',
            'OFICINA': '/admin/dashboard',
            'MECANICO': '/admin/tareas',
            'CONDUCTOR': '/empleado',
            'EMPLEADO': '/empleado',
            'COMERCIAL': '/empleado'
        };

        const rolePermissions: Record<string, string[]> = {
            'ADMIN': ['/admin', '/oficina', '/mecanico', '/empleado'],
            'OFICINA': [
                '/oficina',
                '/empleado',
                '/admin/dashboard',
                '/admin/empleados',
                '/admin/ausencias',
                '/admin/jornadas',
                '/admin/formacion',
                '/admin/evaluaciones',
                '/admin/camiones',
                '/admin/tareas',
                '/admin/tacografo',
                '/admin/informes',
                '/admin/alquiler'
            ],
            'MECANICO': [
                '/mecanico',
                '/empleado',
                '/admin/dashboard',
                '/admin/camiones',
                '/admin/tareas',
                '/admin/inventario'
            ],
            'CONDUCTOR': ['/empleado'],
            'EMPLEADO': ['/empleado'],
            'COMERCIAL': ['/empleado']
        };

        const rol = (payload as any).rol;
        const fallbackRoute = roleRoutes[rol] || '/login';

        // Redirects away from login root or naked dashboard roots to their proper starting points
        const isRedirectHomeRoute = pathname === '/login' || pathname === '/' || pathname === '/admin' || pathname === '/oficina' || pathname === '/mecanico';

        if (isRedirectHomeRoute) {
            return NextResponse.redirect(new URL(fallbackRoute, request.url));
        }

        if (isProtectedRoute) {
            const allowedPrefixes = rolePermissions[rol] || [];
            const hasPermission = allowedPrefixes.some(prefix => pathname.startsWith(prefix));

            if (!hasPermission) {
                return NextResponse.redirect(new URL(fallbackRoute, request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', '/api/admin/:path*'],
};
