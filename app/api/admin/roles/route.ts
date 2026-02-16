import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const empleados = await prisma.empleado.findMany({
            select: {
                id: true,
                nombre: true,
                apellidos: true,
                usuario: true,
                email: true,
                rol: true,
                rolPersonalizado: {
                    select: {
                        id: true,
                        nombre: true
                    }
                },
                activo: true,
                puestoTrabajo: true
            },
            orderBy: { nombre: 'asc' }
        });

        return NextResponse.json(empleados);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const adminUser: any = await verifyToken(session);

        if (!adminUser || adminUser.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol ADMIN.' }, { status: 403 });
        }

        const body = await request.json();
        const { targetUserId, newRole, customRoleId } = body;

        if (!targetUserId || (!newRole && !customRoleId)) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        // 1. Get current data for audit
        const currentEmployee = await prisma.empleado.findUnique({
            where: { id: targetUserId },
            include: { rolPersonalizado: true }
        });

        if (!currentEmployee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        const oldRole = currentEmployee.rolPersonalizado ? `Custom: ${currentEmployee.rolPersonalizado.nombre}` : currentEmployee.rol;
        let finalRoleName = newRole;

        // 2. Update Role
        let updateData: any = {};

        if (customRoleId) {
            // Assigning a Dynamic Role
            updateData = {
                rolPersonalizadoId: parseInt(customRoleId),
                // We keep the base 'rol' as EMPLEADO or whatever it was, or we could set it to something specific if needed.
                // For now, we just update the custom role linkage.
            };
            const customRole = await prisma.rol.findUnique({ where: { id: parseInt(customRoleId) } });
            finalRoleName = `Custom: ${customRole?.nombre}`;
        } else {
            // Assigning a Standard Enum Role
            updateData = {
                rol: newRole,
                rolPersonalizadoId: null // Clear custom role if assigning a standard one
            };
        }

        const updatedEmployee = await prisma.empleado.update({
            where: { id: targetUserId },
            data: updateData
        });

        // 3. Create Audit Log
        if (oldRole !== finalRoleName) {
            await prisma.auditoria.create({
                data: {
                    usuarioId: adminUser.id,
                    accion: 'CAMBIO_ROL',
                    entidad: 'Empleado',
                    entidadId: targetUserId,
                    detalles: JSON.stringify({
                        anterior: oldRole,
                        nuevo: finalRoleName,
                        motivo: 'Cambio manual desde Centro de Roles'
                    })
                }
            });
        }

        return NextResponse.json({ success: true, employee: updatedEmployee });

    } catch (error: any) {
        console.error("PUT /api/admin/roles Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
