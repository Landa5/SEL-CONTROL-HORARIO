import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISOS = [
    // RRHH
    { codigo: 'empleados.ver', descripcion: 'Ver lista de empleados', categoria: 'RRHH' },
    { codigo: 'empleados.crear', descripcion: 'Crear nuevos empleados', categoria: 'RRHH' },
    { codigo: 'empleados.editar', descripcion: 'Editar datos de empleados', categoria: 'RRHH' },
    { codigo: 'empleados.eliminar', descripcion: 'Eliminar empleados', categoria: 'RRHH' },

    // NOMINAS
    { codigo: 'nominas.ver', descripcion: 'Ver nóminas', categoria: 'NOMINAS' },
    { codigo: 'nominas.gestionar', descripcion: 'Calcular y cerrar nóminas', categoria: 'NOMINAS' },

    // FLOTA
    { codigo: 'flota.ver', descripcion: 'Ver camiones y mantenimientos', categoria: 'FLOTA' },
    { codigo: 'flota.editar', descripcion: 'Gestionar flota', categoria: 'FLOTA' },

    // SISTEMA
    { codigo: 'admin.roles', descripcion: 'Gestionar roles y permisos', categoria: 'SISTEMA' },
    { codigo: 'admin.auditoria', descripcion: 'Ver logs de auditoría', categoria: 'SISTEMA' },
];

const ROLES_DEFAULT = [
    { nombre: 'ADMIN', descripcion: 'Acceso total al sistema', esSistema: true },
    { nombre: 'OFICINA', descripcion: 'Gestión administrativa y RRHH', esSistema: true },
    { nombre: 'CONDUCTOR', descripcion: 'Acceso básico a sus datos', esSistema: true },
    { nombre: 'MECANICO', descripcion: 'Gestión de taller', esSistema: true },
    { nombre: 'COMERCIAL', descripcion: 'Gestión comercial', esSistema: true },
];

async function main() {
    console.log('🌱 Iniciando seed de Roles y Permisos...');

    // 1. Crear Permisos
    for (const p of PERMISOS) {
        await prisma.permiso.upsert({
            where: { codigo: p.codigo },
            update: {},
            create: p
        });
    }
    console.log('✅ Permisos creados/verificados.');

    // 2. Crear Roles
    for (const r of ROLES_DEFAULT) {
        await prisma.rol.upsert({
            where: { nombre: r.nombre },
            update: {},
            create: r
        });
    }
    console.log('✅ Roles creados/verificados.');

    // 3. Asignar Permisos a ADMIN (Todos)
    const adminRole = await prisma.rol.findUnique({ where: { nombre: 'ADMIN' } });
    const allPermisos = await prisma.permiso.findMany();

    if (adminRole) {
        for (const p of allPermisos) {
            await prisma.rolPermiso.upsert({
                where: { rolId_permisoId: { rolId: adminRole.id, permisoId: p.id } },
                update: {},
                create: { rolId: adminRole.id, permisoId: p.id }
            });
        }
    }
    console.log('✅ Permisos asignados a ADMIN.');

    // 4. Asignar Permisos a OFICINA (RRHH, NOMINAS, FLOTA)
    const oficinaRole = await prisma.rol.findUnique({ where: { nombre: 'OFICINA' } });
    const oficinaPermisos = await prisma.permiso.findMany({
        where: {
            categoria: { in: ['RRHH', 'NOMINAS', 'FLOTA'] }
        }
    });

    if (oficinaRole) {
        for (const p of oficinaPermisos) {
            await prisma.rolPermiso.upsert({
                where: { rolId_permisoId: { rolId: oficinaRole.id, permisoId: p.id } },
                update: {},
                create: { rolId: oficinaRole.id, permisoId: p.id }
            });
        }
    }
    console.log('✅ Permisos asignados a OFICINA.');

    console.log('🏁 Seed completado.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
