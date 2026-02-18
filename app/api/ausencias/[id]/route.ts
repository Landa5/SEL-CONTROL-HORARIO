import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PATCH(
    request: Request,
    { params }: { params: any }
) {
    try {
        const session = await getSession();
        if (!session || (session.rol !== 'ADMIN' && session.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { estado, fechaInicio, fechaFin, tipo, observaciones } = body;
        const { id } = await params;

        const ausencia = await prisma.ausencia.findUnique({
            where: { id: parseInt(id) },
            include: { empleado: true }
        });

        if (!ausencia) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

        // Build update data
        const updateData: any = {
            fechaResolucion: new Date(),
            aprobadoPorId: Number(session.id)
        };

        if (estado) updateData.estado = estado;
        if (fechaInicio) updateData.fechaInicio = new Date(fechaInicio);
        if (fechaFin) updateData.fechaFin = new Date(fechaFin);
        if (tipo) updateData.tipo = tipo;
        if (observaciones !== undefined) updateData.observaciones = observaciones;

        const updated = await prisma.ausencia.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // AUDITORÍA
        await registrarAuditoria(
            Number(session.id),
            estado ? `AUSENCIA_${estado}` : 'EDITAR_AUSENCIA',
            'Ausencia',
            parseInt(id),
            {
                estadoAnterior: ausencia.estado,
                estadoNuevo: estado || ausencia.estado,
                cambios: {
                    fechas: fechaInicio ? `${fechaInicio} - ${fechaFin}` : undefined,
                    tipo: tipo !== ausencia.tipo ? tipo : undefined
                }
            }
        );

        return NextResponse.json(updated);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: any }
) {
    try {
        const session = await getSession();
        if (!session || (session.rol !== 'ADMIN' && session.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = await params;

        const ausencia = await prisma.ausencia.findUnique({
            where: { id: parseInt(id) },
            include: { empleado: true }
        });

        if (!ausencia) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

        await prisma.ausencia.delete({
            where: { id: parseInt(id) }
        });

        // AUDITORÍA
        await registrarAuditoria(
            Number(session.id),
            'ELIMINAR_AUSENCIA',
            'Ausencia',
            parseInt(id),
            {
                empleado: ausencia.empleado.nombre,
                tipo: ausencia.tipo,
                fechas: `${ausencia.fechaInicio} - ${ausencia.fechaFin}`,
                estado: ausencia.estado
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
    }
}
