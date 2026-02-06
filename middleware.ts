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

        const rol = (payload as any).rol;

        if (pathname.startsWith('/admin') && rol !== 'ADMIN') {
            // Allow office to access formation even if it's under /admin
            if (!pathname.startsWith('/admin/formacion') || rol !== 'OFICINA') {
                return NextResponse.redirect(new URL(roleRoutes[rol] || '/login', request.url));
            }
        }

        if (pathname.startsWith('/oficina') && rol !== 'OFICINA' && rol !== 'ADMIN') {
            return NextResponse.redirect(new URL(roleRoutes[rol] || '/login', request.url));
        }

        if (pathname.startsWith('/mecanico') && rol !== 'MECANICO' && rol !== 'ADMIN') {
            return NextResponse.redirect(new URL(roleRoutes[rol] || '/login', request.url));
        }

        if (pathname === '/login' || pathname === '/' || pathname === '/admin' || pathname === '/oficina' || pathname === '/mecanico') {
            return NextResponse.redirect(new URL(roleRoutes[rol] || '/empleado', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
