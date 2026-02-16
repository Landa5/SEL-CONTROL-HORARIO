import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Retrieves the list of permission codes for a given user.
 * Priority:
 * 1. rolPersonalizado (Dynamic Role)
 * 2. rol (Enum) - Mapped to a Rol with the same name
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
    const user = await prisma.empleado.findUnique({
        where: { id: userId },
        include: {
            rolPersonalizado: {
                include: {
                    permisos: {
                        include: { permiso: true }
                    }
                }
            }
        }
    });

    if (!user) return [];

    // 1. Dynamic Role (Highest Priority)
    if (user.rolPersonalizado) {
        return user.rolPersonalizado.permisos.map(p => p.permiso.codigo);
    }

    // 2. Legacy Enum Role (Fallback)
    // We look up a Role with the same name as the Enum (e.g. "ADMIN", "OFICINA")
    if (user.rol) {
        const legacyRol = await prisma.rol.findUnique({
            where: { nombre: user.rol }, // The seed script created these matches
            include: {
                permisos: {
                    include: { permiso: true }
                }
            }
        });

        if (legacyRol) {
            return legacyRol.permisos.map(p => p.permiso.codigo);
        }
    }

    return [];
}

/**
 * Usage in API Routes:
 * if (!await hasPermission(user.id, 'nominas.ver')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function hasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const permissions = await getUserPermissions(userId);
    return permissions.includes(permissionCode);
}
