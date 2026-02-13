const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Enum definitions from Prisma Client (mocked for script if needed, but we can require them if they are exported)
// In a standalone script, we might not have the Types imported, but we can just use strings if the client allows, or match the logic.
// However, the issue might be exactly that we are passing strings that SHOULD be mapped.

async function main() {
    console.log("Starting reproduction script...");

    // 1. Simulate the User (Session)
    // Assuming ID 1 exists and is an Admin/Employee.
    const session = { id: 1, rol: 'ADMIN' };
    console.log("Simulating user ID:", session.id);

    // 2. Simulate the Payload from Frontend
    // Based on TaskForm.tsx
    // Case 1: Averia, Urgente, Camion provided
    const body = {
        titulo: "Test Averia Script",
        descripcion: "Testing reproduction of 500 error",
        tipo: "AVERIA", // Frontend sends this
        prioridad: "URGENTE", // Frontend sends this
        activoTipo: "CAMION",
        matricula: "1713-FHR", // Assuming this exists, if not it might fail on lookup or be ignored
        kilometros: "123456",
        descargas: "0",
        // clienteNombre: undefined
        // ubicacionTexto: undefined
        contactoNombre: "Juan",
        contactoTelefono: "600000000",
        // asignadoAId: undefined
    };

    console.log("Input Payload:", body);

    try {
        // --- LOGIC FROM route.ts ---

        // Handle Camion Relation
        let camionId = undefined;
        if (body.matricula) {
            console.log("Looking up matricula:", body.matricula);
            const camion = await prisma.camion.findUnique({ where: { matricula: body.matricula } });
            if (camion) {
                console.log("Camion found:", camion.id);
                camionId = camion.id;
            } else {
                console.log("Camion NOT found for matricula:", body.matricula);
            }
        }

        // Map Frontend Enums to Backend Enums (The FIX I applied)
        let tipoFinal = 'OPERATIVA'; // Valid Enum string
        if (body.tipo === 'AVERIA' || body.tipo === 'MANTENIMIENTO') {
            tipoFinal = 'OPERATIVA';
        } else if (body.tipo === 'TAREA_INTERNA') {
            tipoFinal = 'ADMINISTRATIVA';
        } else if (['OPERATIVA', 'ADMINISTRATIVA', 'RECURRENTE', 'AUTOMATICA'].includes(body.tipo)) {
            tipoFinal = body.tipo;
        }

        let prioridadFinal = 'MEDIA'; // Valid Enum string
        if (body.prioridad === 'URGENTE') {
            prioridadFinal = 'ALTA';
        } else if (['ALTA', 'MEDIA', 'BAJA'].includes(body.prioridad)) {
            prioridadFinal = body.prioridad;
        }

        console.log("Mapped Enums:", { tipoFinal, prioridadFinal });

        console.log("Attempting prisma.tarea.create...");
        const tarea = await prisma.tarea.create({
            data: {
                titulo: body.titulo,
                descripcion: body.descripcion || '',
                tipo: tipoFinal, // Prisma Client expects valid enum strings

                // If deadline or assignee is set, it's not backlog anymore, it's pending/planned
                estado: (body.fechaLimite || body.asignadoAId) ? 'PENDIENTE' : 'BACKLOG',

                prioridad: prioridadFinal,

                activoTipo: body.activoTipo,
                matricula: body.matricula,
                clienteNombre: body.clienteNombre,
                ubicacionTexto: body.ubicacionTexto,

                fechaLimite: body.fechaLimite ? new Date(body.fechaLimite) : null,

                creadoPorId: Number(session.id),
                asignadoAId: body.asignadoAId ? Number(body.asignadoAId) : undefined,
                parentId: body.parentId ? Number(body.parentId) : undefined,
                proyectoId: body.proyectoId ? Number(body.proyectoId) : undefined,

                camionId: camionId,
                descargas: body.descargas ? Number(body.descargas) : undefined,

                contactoNombre: body.contactoNombre,
                contactoTelefono: body.contactoTelefono,
            }
        });

        console.log("SUCCESS! Tarea created:", tarea.id);

    } catch (error) {
        console.error("ERROR CAUGHT IN SCRIPT:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
