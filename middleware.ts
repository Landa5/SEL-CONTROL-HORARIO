import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value;
    const { pathname } = request.nextUrl;
    console.log(`[Middleware] Path: ${pathname}, Session: ${session ? 'Present' : 'Absent'}`);

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
            'OFICINA': '/oficina/dashboard',
            'MECANICO': '/mecanico/dashboard',
            'CONDUCTOR': '/empleado',
            'EMPLEADO': '/empleado'
        };

        const rolePermissions: Record<string, string[]> = {
            'ADMIN': ['/admin', '/oficina', '/mecanico', '/empleado'],
            'OFICINA': ['/oficina', '/empleado', '/admin/formacion'],
            'MECANICO': ['/mecanico', '/empleado'],
            'CONDUCTOR': ['/empleado'],
            'EMPLEADO': ['/empleado']
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
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
