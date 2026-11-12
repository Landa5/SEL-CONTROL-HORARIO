import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SECRET_KEY = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
if (!SECRET_KEY) {
    console.warn('⚠️  SEGURIDAD: JWT_SECRET (o NEXTAUTH_SECRET) no está definida. Se recomienda definirla en .env.');
}
const key = new TextEncoder().encode(SECRET_KEY || 'dev-only-unsafe-key-change-in-production');

export async function signToken(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(key);
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    return await verifyToken(session);
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get('session')?.value;
    if (!session) return;

    const parsed = await verifyToken(session);
    if (!parsed) return;

    const res = NextResponse.next();
    res.cookies.set({
        name: 'session',
        value: await signToken(parsed),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });
    return res;
}
