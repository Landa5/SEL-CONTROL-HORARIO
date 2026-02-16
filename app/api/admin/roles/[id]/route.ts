import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || user.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id: idStr } = await params;
        const rolId = parseInt(idStr);
        const body = await request.json();
        const { permisos, descripcion } = body; // permisos: string[] of codes or number[] of ids? Let's assume IDs for simplicity or Codes if easier.
        // Let's assume array of permission IDs coming from frontend matrix.

        // 1. Update basic info if provided
        if (descripcion) {
            await prisma.rol.update({
                where: { id: rolId },
                data: { descripcion }
            });
        }

        // 2. Update Permissions (Transaction)
        // Only if 'permisos' array is provided
        if (Array.isArray(permisos)) {
            await prisma.$transaction(async (tx) => {
                // Remove all existing permissions
                await tx.rolPermiso.deleteMany({
                    where: { rolId }
                });

                // Add new ones
                if (permisos.length > 0) {
                    await tx.rolPermiso.createMany({
                        data: permisos.map((permisoId: number) => ({
                            rolId,
                            permisoId,
                            assignedBy: user.id
                        }))
                    });
                }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error(`PUT /api/admin/roles/[id] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
