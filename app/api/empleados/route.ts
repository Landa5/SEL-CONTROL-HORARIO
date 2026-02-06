import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function GET() {
    const empleados = await prisma.empleado.findMany({
        orderBy: { nombre: 'asc' },
    });
    // Omit passwords
    const safeEmpleados = empleados.map(({ password, ...rest }) => rest);
    return NextResponse.json(safeEmpleados);
}

const ALLOWED_ROLES = ['ADMIN', 'OFICINA', 'CONDUCTOR', 'MECANICO', 'EMPLEADO'];

// Helper to sanitize optional fields (empty string -> null)
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
                fechaAlta: new Date()
            },
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
        const data = await request.json();
        const { id, password, ...rest } = data;

        const updateData: any = {
            nombre: rest.nombre,
            apellidos: sanitize(rest.apellidos),
            dni: sanitize(rest.dni),
            telefono: sanitize(rest.telefono),
            email: sanitize(rest.email),
            direccion: sanitize(rest.direccion),
            rol: rest.rol,
            observaciones: sanitize(rest.observaciones),
            activo: rest.activo
        };

        if (password) {
            updateData.password = await hashPassword(password);
        }

        const empleado = await prisma.empleado.update({
            where: { id: parseInt(id) },
            data: updateData,
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
} // Removed delete for now to be safe, or can add if requested. User asked for CRUD.

export async function DELETE(request: Request) {
    try {
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
