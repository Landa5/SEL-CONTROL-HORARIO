
import { prisma } from '@/lib/prisma';

export async function registrarAuditoria(
    usuarioId: number,
    accion: string,
    entidad: string,
    entidadId: number,
    detalles: any
) {
    try {
        await prisma.auditoria.create({
            data: {
                usuarioId,
                accion,
                entidad,
                entidadId,
                detalles: typeof detalles === 'string' ? detalles : JSON.stringify(detalles)
            }
        });
    } catch (error) {
        console.error('Error al registrar auditoria:', error);
        // No lanzamos error para no interrumpir el flujo principal si falla el log
    }
}
