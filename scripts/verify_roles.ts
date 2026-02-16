import { prisma } from '@/lib/prisma';
import { getUserPermissions, hasPermission } from '@/lib/permissions';

async function main() {
    console.log('🧪 Iniciando Verificación de Roles Fase 2...');

    // 1. Get a test user (or create one)
    const testUser = await prisma.empleado.findFirst();
    if (!testUser) {
        console.error('❌ No hay empleados para probar.');
        return;
    }
    console.log(`👤 Usuario de prueba: ${testUser.id} (${testUser.usuario}) - Rol Actual: ${testUser.rol}`);

    // 2. Check default permissions (based on Enum)
    const initialPerms = await getUserPermissions(testUser.id);
    console.log(`📜 Permisos iniciales (Enum ${testUser.rol}):`, initialPerms.length);
    if (initialPerms.length === 0) console.warn('⚠️ No se encontraron permisos para el rol Enum.');

    // 3. Create a Dynamic Role "TEST_ROLE"
    const roleName = `TEST_ROLE_${Date.now()}`;
    const newRole = await prisma.rol.create({
        data: {
            nombre: roleName,
            descripcion: 'Rol de prueba generado automáticamente',
            esSistema: false
        }
    });
    console.log(`✅ Rol dinámico creado: ${newRole.nombre} (ID: ${newRole.id})`);

    // 4. Assign specific permissions to this role
    // Let's grab the first 2 permissions available
    const somePerms = await prisma.permiso.findMany({ take: 2 });
    for (const p of somePerms) {
        await prisma.rolPermiso.create({
            data: {
                rolId: newRole.id,
                permisoId: p.id
            }
        });
    }
    console.log(`✅ Asignados ${somePerms.length} permisos a ${newRole.nombre}: ${somePerms.map(p => p.codigo).join(', ')}`);

    // 5. Assign this role to the user (Simulate "rolPersonalizado")
    await prisma.empleado.update({
        where: { id: testUser.id },
        data: { rolPersonalizadoId: newRole.id }
    });
    console.log(`👤 Asignado rol personalizado ${newRole.nombre} al usuario.`);

    // 6. Verify permissions again
    const newPerms = await getUserPermissions(testUser.id);
    console.log(`📜 Nuevos permisos (Dynamic Role):`, newPerms);

    const hasP1 = await hasPermission(testUser.id, somePerms[0].codigo);
    if (hasP1) console.log(`✅ Verificación hasPermission('${somePerms[0].codigo}'): OK`);
    else console.error(`❌ Verificación hasPermission('${somePerms[0].codigo}'): FALLÓ`);

    // 7. Clean up (Revert)
    await prisma.empleado.update({
        where: { id: testUser.id },
        data: { rolPersonalizadoId: null }
    });
    // Optional: Delete role? Keep it for inspection? Let's delete to keep clean.
    await prisma.rol.delete({ where: { id: newRole.id } });
    console.log('🧹 Limpieza completada (Rol personalizado desasignado y borrado).');

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
