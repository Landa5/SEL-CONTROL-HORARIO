import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

export async function POST() {
    try {
        const session: any = await getSession();
        if (!session || !['ADMIN', 'OFICINA'].includes(session.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // 1. Find all fallback records
        const fallbackRecords = await prisma.mantenimientoRealizado.findMany({
            where: {
                descripcion: {
                    contains: 'Modo Fallback'
                }
            }
        });

        if (fallbackRecords.length === 0) {
            return NextResponse.json({ success: true, message: 'No hay facturas en modo fallback para re-procesar.' });
        }

        const projectRoot = process.cwd();
        const baseDir = path.join(projectRoot, 'facturas-taller');
        const processedDir = path.join(baseDir, 'procesadas');

        let movedCount = 0;
        let deletedCount = 0;

        for (const record of fallbackRecords) {
            // Extract filename from description: "Procesado (Modo Fallback): filename.pdf"
            const match = record.descripcion.match(/Procesado \(Modo Fallback\): (.*)/);
            if (match && match[1]) {
                const filename = match[1].trim();
                const processedPath = path.join(processedDir, filename);
                const originalPath = path.join(baseDir, filename);

                // Move file back if it exists
                if (fs.existsSync(processedPath)) {
                    fs.renameSync(processedPath, originalPath);
                    movedCount++;
                }
            }

            // Delete record from DB
            await prisma.mantenimientoRealizado.delete({
                where: { id: record.id }
            });
            deletedCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Se han restaurado ${movedCount} facturas y eliminado ${deletedCount} registros antiguos. Dale a "Sincronizar" para procesarlas con la IA.`
        });

    } catch (error: any) {
        console.error('Error resetting fallbacks:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
