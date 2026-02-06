import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST() {
    try {
        const session: any = await getSession();
        if (!session || !['ADMIN'].includes(session.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // Get all records ordered by creation (Newest first)
        // This ensures that when we iterate, the first record we encounter for a given date/truck is the most recent one.
        const allRecords = await prisma.mantenimientoRealizado.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const seenKeys = new Map<string, number>();
        let deletedCount = 0;
        const deletedIds: number[] = [];

        for (const record of allRecords) {
            // Business Key: Truck + Date
            // We ignore Taller or Cost variations to strictly enforce "One Maintenance Record per Day per Truck"
            // This catches cases where "Fallback" (0 cost) and "AI" (real cost) exist for same day.
            const dateStr = new Date(record.fecha).toISOString().split('T')[0];
            const key = `${record.camionId}-${dateStr}`;

            if (seenKeys.has(key)) {
                // Duplicate found! 
                // Since we iterate 'desc' (Newest first), this 'record' is OLDER than the one in 'seenKeys'.
                // We assume the Newest record is the most accurate (user just re-processed it).
                // Therefore, we delete this OLDER record.

                await prisma.mantenimientoRealizado.delete({
                    where: { id: record.id }
                });
                deletedCount++;
                deletedIds.push(record.id);
            } else {
                seenKeys.set(key, record.id);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Limpieza completada. Se han eliminado ${deletedCount} registros antiguos duplicados.`,
            deletedIds
        });

    } catch (error: any) {
        console.error('Deduplication Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
