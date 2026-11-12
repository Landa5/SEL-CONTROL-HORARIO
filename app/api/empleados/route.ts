import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, getSession } from '@/lib/auth';

export async function GET(request: Request) {
    const session: any = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isPrivileged = session.rol === 'ADMIN' || session.rol === 'OFICINA';

    if (id) {
        const empId = parseInt(id);
        const empleado = await prisma.empleado.findUnique({
            where: { id: empId },
            include: { perfilProfesional: true }
        });
        if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

        // Privileged or the user themselves gets full profile
        if (isPrivileged || empId === session.id) {
            const { password, ...safe } = empleado;
            return NextResponse.json(safe);
        }

        // Other users only get non-sensitive public info
        return NextResponse.json({
            id: empleado.id,
            nombre: empleado.nombre,
            apellidos: empleado.apellidos,
            rol: empleado.rol,
            puestoTrabajo: empleado.puestoTrabajo,
            activo: empleado.activo
        });
    }

    const empleados = await prisma.empleado.findMany({
        orderBy: [
            { rol: 'asc' },
            { nombre: 'asc' }
        ],
        include: { perfilProfesional: isPrivileged }
    });

    if (isPrivileged) {
        // Omit passwords only
        const safeEmpleados = empleados.map(({ password, ...rest }) => rest);
        return NextResponse.json(safeEmpleados);
    }

    // Directory view for non-privileged staff
    const directoryEmpleados = empleados.map(e => ({
        id: e.id,
        nombre: e.nombre,
        apellidos: e.apellidos,
        rol: e.rol,
        puestoTrabajo: e.puestoTrabajo,
        activo: e.activo
    }));
    return NextResponse.json(directoryEmpleados);
}

const ALLOWED_ROLES = ['ADMIN', 'OFICINA', 'CONDUCTOR', 'MECANICO', 'EMPLEADO', 'COMERCIAL'];

// Helper to sanitize optional fields (empty string/whitespace -> null)
const sanitize = (val: any) => {
    if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
    }
    return val === undefined || val === null ? null : val;
};

export async function POST(request: Request) {
    try {
        const session: any = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de Administrador.' }, { status: 403 });
        }

        const data = await request.json();

        // 1. Role Validation
        if (!ALLOWED_ROLES.includes(data.rol)) {
            return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
        }

        // 2. Hash Password
        const hashedPassword = await hashPassword(data.password);

        const empleado = await prisma.empleado.create({
            data: {
                usuario: data.usuario,
                password: hashedPassword,
                rol: data.rol,
                nombre: data.nombre,
                apellidos: sanitize(data.apellidos),
                dni: sanitize(data.dni),
                telefono: sanitize(data.telefono),
                email: sanitize(data.email),
                direccion: sanitize(data.direccion),
                observaciones: sanitize(data.observaciones),
                activo: data.activo !== undefined ? data.activo : true,
                // Configuración Horaria
                horaEntradaPrevista: sanitize(data.horaEntradaPrevista),
                horaSalidaPrevista: sanitize(data.horaSalidaPrevista),
                horaEntradaTarde: sanitize(data.horaEntradaTarde),
                horaSalidaTarde: sanitize(data.horaSalidaTarde),
                puestoTrabajo: sanitize(data.puestoTrabajo),

                fechaAlta: new Date(),
                // PERFIL PROFESIONAL (If applicable)
                perfilProfesional: (data.rol === 'CONDUCTOR' || data.rol === 'MECANICO') ? {
                    create: {
                        dniCaducidad: new Date(data.dniCaducidad),
                        carnetTipo: data.carnetTipo,
                        carnetCaducidad: new Date(data.carnetCaducidad),
                        tieneAdr: data.tieneAdr || false,
                        adrCaducidad: data.tieneAdr && data.adrCaducidad ? new Date(data.adrCaducidad) : null
                    }
                } : undefined
            },
            include: { perfilProfesional: true }
        });

        const { password, ...safeEmpleado } = empleado;
        return NextResponse.json(safeEmpleado);
    } catch (error: any) {
        // Catch Unique Constraint Violation explicitly
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'campo';
            return NextResponse.json({ error: `El valor de ${field} ya está en uso.` }, { status: 400 });
        }
        console.error("POST /api/empleados Error Detail:", {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'Error creando empleado',
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session: any = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const data = await request.json();
        const { id, password, ...rest } = data;
        const targetId = parseInt(id);

        const isAdmin = session.rol === 'ADMIN';
        const isOffice = session.rol === 'OFICINA';
        const isSelf = session.id === targetId;

        if (!isAdmin && !isOffice && !isSelf) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const updateData: any = {
            nombre: rest.nombre,
            apellidos: sanitize(rest.apellidos),
            telefono: sanitize(rest.telefono),
            email: sanitize(rest.email),
            direccion: sanitize(rest.direccion),
        };

        // Only privileged users can edit DNI, work schedule, job title, notes
        if (isAdmin || isOffice) {
            updateData.dni = sanitize(rest.dni);
            updateData.observaciones = sanitize(rest.observaciones);
            updateData.horaEntradaPrevista = sanitize(rest.horaEntradaPrevista);
            updateData.horaSalidaPrevista = sanitize(rest.horaSalidaPrevista);
            updateData.horaEntradaTarde = sanitize(rest.horaEntradaTarde);
            updateData.horaSalidaTarde = sanitize(rest.horaSalidaTarde);
            updateData.puestoTrabajo = sanitize(rest.puestoTrabajo);
        }

        // Only ADMIN can change roles and active status
        if (isAdmin) {
            if (rest.rol && ALLOWED_ROLES.includes(rest.rol)) updateData.rol = rest.rol;
            if (rest.activo !== undefined) updateData.activo = rest.activo;
        }

        // Password change: only ADMIN or user themselves
        if (password) {
            if (!isAdmin && !isSelf) {
                return NextResponse.json({ error: 'No tienes permiso para cambiar la contraseña de otro usuario' }, { status: 403 });
            }
            updateData.password = await hashPassword(password);
        }

        const empleado = await prisma.empleado.update({
            where: { id: targetId },
            data: {
                ...updateData,
                perfilProfesional: (rest.rol === 'CONDUCTOR' || rest.rol === 'MECANICO') && rest.dniCaducidad ? {
                    upsert: {
                        create: {
                            dniCaducidad: new Date(rest.dniCaducidad),
                            carnetTipo: rest.carnetTipo,
                            carnetCaducidad: new Date(rest.carnetCaducidad),
                            tieneAdr: rest.tieneAdr || false,
                            adrCaducidad: rest.tieneAdr && rest.adrCaducidad ? new Date(rest.adrCaducidad) : null
                        },
                        update: {
                            dniCaducidad: new Date(rest.dniCaducidad),
                            carnetTipo: rest.carnetTipo,
                            carnetCaducidad: new Date(rest.carnetCaducidad),
                            tieneAdr: rest.tieneAdr || false,
                            adrCaducidad: rest.tieneAdr && rest.adrCaducidad ? new Date(rest.adrCaducidad) : null
                        }
                    }
                } : undefined
            },
            include: { perfilProfesional: true }
        });

        const { password: _, ...safeEmpleado } = empleado;
        return NextResponse.json(safeEmpleado);
    } catch (error: any) {
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'campo';
            return NextResponse.json({ error: `El valor de '${field}' ya está en uso.` }, { status: 400 });
        }
        console.error("PUT Error:", error);
        return NextResponse.json({ error: 'Error actualizando empleado' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session: any = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de Administrador.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        await prisma.empleado.update({
            where: { id: parseInt(id) },
            data: {
                activo: false,
                fechaBaja: new Date()
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Error:", error);
        return NextResponse.json({ error: 'Error eliminando empleado' }, { status: 500 });
    }
}
