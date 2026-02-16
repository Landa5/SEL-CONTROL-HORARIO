import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const roles = await prisma.rol.findMany({
            include: {
                permisos: {
                    include: {
                        permiso: true
                    }
                },
                _count: {
                    select: { empleados: true }
                }
            },
            orderBy: { id: 'asc' }
        });

        const formattedRoles = roles.map(rol => ({
            id: rol.id,
            nombre: rol.nombre,
            descripcion: rol.descripcion,
            esSistema: rol.esSistema,
            empleadosCount: rol._count.empleados,
            permisos: rol.permisos.map(rp => rp.permiso.codigo)
        }));

        return NextResponse.json(formattedRoles);
    } catch (error: any) {
        console.error("GET /api/admin/roles/list Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
