import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

// Traslado al VPS de SEL (12/11/2026): la app vive en https://app.selsel.es.
// La copia que sigue en Vercel solo redirige y no deja escribir en la base antigua (Supabase).
const NUEVA_URL = 'https://app.selsel.es';

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value;
    const { pathname } = request.nextUrl;

    const host = request.headers.get('host') || '';
    if (process.env.VERCEL === '1' || host.endsWith('.vercel.app')) {
        const destino = new URL(pathname + request.nextUrl.search, NUEVA_URL);
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'La app se ha trasladado a ' + NUEVA_URL, nuevaUrl: destino.toString() },
                { status: 410 }
            );
        }
        return NextResponse.redirect(destino, 308);
    }

    // El resto de /api (salvo /api/admin) no pasa por las comprobaciones de sesion de abajo, igual que antes
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/admin')) {
        return NextResponse.next();
    }

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
    // Incluye /api para poder cortar la escritura en Vercel; en el VPS esas rutas pasan sin cambios (ver arriba)
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
