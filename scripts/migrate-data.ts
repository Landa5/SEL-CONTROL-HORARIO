import { PrismaClient } from '@prisma/client';
// @ts-ignore
// @ts-ignore
import { PrismaClient as PrismaClientSqlite } from '../prisma-client-sqlite';

const prismaPg = new PrismaClient();
const prismaSqlite = new PrismaClientSqlite();

async function main() {
    console.log('🚀 Starting migration...');

    // 1. Empleado
    console.log('Migrating Empleado...');
    const empleados = await prismaSqlite.empleado.findMany();
    if (empleados.length > 0) {
        // Cast rol to any to avoid type mismatch with enum
        const formatedEmpleados = empleados.map((e: any) => ({
            ...e,
            rol: e.rol as any
        }));
        console.log('First employee to insert:', formatedEmpleados[0]);
        try {
            await prismaPg.empleado.createMany({ data: formatedEmpleados });
            console.log(`✅ Migrated ${empleados.length} Empleados`);
        } catch (err) {
            console.error('❌ Failed to migrate Empleado:', err);
        }
    }

    // 2. Camion
    console.log('Migrating Camion...');
    const camiones = await prismaSqlite.camion.findMany();
    if (camiones.length > 0) {
        await prismaPg.camion.createMany({ data: camiones });
        console.log(`✅ Migrated ${camiones.length} Camiones`);
    }

    // 3. FiestaLocal
    console.log('Migrating FiestaLocal...');
    const fiestas = await prismaSqlite.fiestaLocal.findMany();
    if (fiestas.length > 0) {
        await prismaPg.fiestaLocal.createMany({ data: fiestas });
        console.log(`✅ Migrated ${fiestas.length} FiestasLocales`);
    }

    // 4. ConceptoNomina
    console.log('Migrating ConceptoNomina...');
    const conceptos = await prismaSqlite.conceptoNomina.findMany();
    if (conceptos.length > 0) {
        await prismaPg.conceptoNomina.createMany({ data: conceptos });
        console.log(`✅ Migrated ${conceptos.length} ConceptosNomina`);
    }

    // 5. ModuloFormacion
    console.log('Migrating ModuloFormacion...');
    const modulos = await prismaSqlite.moduloFormacion.findMany();
    if (modulos.length > 0) {
        await prismaPg.moduloFormacion.createMany({ data: modulos });
        console.log(`✅ Migrated ${modulos.length} ModulosFormacion`);
    }

    // 6. TarifaNomina
    console.log('Migrating TarifaNomina...');
    const tarifas = await prismaSqlite.tarifaNomina.findMany();
    if (tarifas.length > 0) {
        await prismaPg.tarifaNomina.createMany({ data: tarifas });
        console.log(`✅ Migrated ${tarifas.length} TarifasNomina`);
    }

    // 7. JornadaLaboral
    console.log('Migrating JornadaLaboral...');
    const jornadas = await prismaSqlite.jornadaLaboral.findMany();
    if (jornadas.length > 0) {
        await prismaPg.jornadaLaboral.createMany({ data: jornadas });
        console.log(`✅ Migrated ${jornadas.length} JornadasLaborales`);
    }

    // 7b. CompensacionFestivo
    console.log('Migrating CompensacionFestivo...');
    const compensaciones = await prismaSqlite.compensacionFestivo.findMany();
    if (compensaciones.length > 0) {
        await prismaPg.compensacionFestivo.createMany({ data: compensaciones });
        console.log(`✅ Migrated ${compensaciones.length} CompensacionesFestivo`);
    }

    // 8. UsoCamion
    console.log('Migrating UsoCamion...');
    const usos = await prismaSqlite.usoCamion.findMany();
    if (usos.length > 0) {
        await prismaPg.usoCamion.createMany({ data: usos });
        console.log(`✅ Migrated ${usos.length} UsosCamion`);
    }

    // 8b. Descarga
    console.log('Migrating Descarga...');
    const descargas = await prismaSqlite.descarga.findMany();
    if (descargas.length > 0) {
        await prismaPg.descarga.createMany({ data: descargas });
        console.log(`✅ Migrated ${descargas.length} Descargas`);
    }

    // 9. Tarea
    console.log('Migrating Tarea...');
    const tareas = await prismaSqlite.tarea.findMany();
    if (tareas.length > 0) {
        await prismaPg.tarea.createMany({ data: tareas });
        console.log(`✅ Migrated ${tareas.length} Tareas`);
    }

    // Dependencies of Tarea
    console.log('Migrating TareaHistorial...');
    const historiales = await prismaSqlite.tareaHistorial.findMany();
    if (historiales.length > 0) {
        await prismaPg.tareaHistorial.createMany({ data: historiales });
        console.log(`✅ Migrated ${historiales.length} Historiales`);
    }

    console.log('Migrating TareaAdjunto...');
    const adjuntos = await prismaSqlite.tareaAdjunto.findMany();
    if (adjuntos.length > 0) {
        await prismaPg.tareaAdjunto.createMany({ data: adjuntos });
        console.log(`✅ Migrated ${adjuntos.length} Adjuntos`);
    }

    console.log('Migrating MantenimientoRealizado...');
    const mantelRealizados = await prismaSqlite.mantenimientoRealizado.findMany();
    if (mantelRealizados.length > 0) {
        await prismaPg.mantenimientoRealizado.createMany({ data: mantelRealizados });
        console.log(`✅ Migrated ${mantelRealizados.length} Mantenimientos Realizados`);
    }

    // 10. Ausencia
    console.log('Migrating Ausencia...');
    const ausencias = await prismaSqlite.ausencia.findMany();
    if (ausencias.length > 0) {
        await prismaPg.ausencia.createMany({ data: ausencias });
        console.log(`✅ Migrated ${ausencias.length} Ausencias`);
    }

    // 11. MantenimientoProximo
    console.log('Migrating MantenimientoProximo...');
    const mantelProximos = await prismaSqlite.mantenimientoProximo.findMany();
    if (mantelProximos.length > 0) {
        await prismaPg.mantenimientoProximo.createMany({ data: mantelProximos });
        console.log(`✅ Migrated ${mantelProximos.length} Mantenimientos Proximos`);
    }

    // 12. Auditoria
    console.log('Migrating Auditoria...');
    const auditorias = await prismaSqlite.auditoria.findMany();
    if (auditorias.length > 0) {
        await prismaPg.auditoria.createMany({ data: auditorias });
        console.log(`✅ Migrated ${auditorias.length} Auditorias`);
    }

    // 13. Notificacion
    console.log('Migrating Notificacion...');
    const notificaciones = await prismaSqlite.notificacion.findMany();
    if (notificaciones.length > 0) {
        await prismaPg.notificacion.createMany({ data: notificaciones });
        console.log(`✅ Migrated ${notificaciones.length} Notificaciones`);
    }

    // 14. TemaFormacion
    console.log('Migrating TemaFormacion...');
    const temas = await prismaSqlite.temaFormacion.findMany();
    if (temas.length > 0) {
        await prismaPg.temaFormacion.createMany({ data: temas });
        console.log(`✅ Migrated ${temas.length} TemasFormacion`);
    }

    // 15. PreguntaFormacion
    console.log('Migrating PreguntaFormacion...');
    const preguntas = await prismaSqlite.preguntaFormacion.findMany();
    if (preguntas.length > 0) {
        await prismaPg.preguntaFormacion.createMany({ data: preguntas });
        console.log(`✅ Migrated ${preguntas.length} PreguntasFormacion`);
    }

    // 16. ResultadoFormacion
    console.log('Migrating ResultadoFormacion...');
    const resultados = await prismaSqlite.resultadoFormacion.findMany();
    if (resultados.length > 0) {
        await prismaPg.resultadoFormacion.createMany({ data: resultados });
        console.log(`✅ Migrated ${resultados.length} ResultadosFormacion`);
    }

    // 17. NominaMes
    console.log('Migrating NominaMes...');
    const nominas = await prismaSqlite.nominaMes.findMany();
    if (nominas.length > 0) {
        await prismaPg.nominaMes.createMany({ data: nominas });
        console.log(`✅ Migrated ${nominas.length} Nominas`);
    }

    // 17b. NominaLinea
    console.log('Migrating NominaLinea...');
    const lineas = await prismaSqlite.nominaLinea.findMany();
    if (lineas.length > 0) {
        await prismaPg.nominaLinea.createMany({ data: lineas });
        console.log(`✅ Migrated ${lineas.length} LineasNomina`);
    }

    // 18. ComercialLitros
    console.log('Migrating ComercialLitros...');
    const litros = await prismaSqlite.comercialLitros.findMany();
    if (litros.length > 0) {
        await prismaPg.comercialLitros.createMany({ data: litros });
        console.log(`✅ Migrated ${litros.length} ComercialLitros`);
    }

    // 19. EnvioGestoria
    console.log('Migrating EnvioGestoria...');
    const envios = await prismaSqlite.envioGestoria.findMany();
    if (envios.length > 0) {
        await prismaPg.envioGestoria.createMany({ data: envios });
        console.log(`✅ Migrated ${envios.length} EnviosGestoria`);
    }

    console.log('🔄 Resetting Sequences...');
    const tableNames = [
        'Empleado', 'Camion', 'JornadaLaboral', 'UsoCamion', 'Descarga', 'Ausencia',
        'Tarea', 'TareaHistorial', 'TareaAdjunto', 'MantenimientoProximo', 'MantenimientoRealizado',
        'Auditoria', 'Notificacion', 'FiestaLocal', 'CompensacionFestivo', 'ModuloFormacion',
        'TemaFormacion', 'PreguntaFormacion', 'ResultadoFormacion', 'ConceptoNomina', 'TarifaNomina',
        'NominaMes', 'NominaLinea', 'ComercialLitros', 'EnvioGestoria'
    ];

    for (const table of tableNames) {
        try {
            // Postgres raw query to reset sequence
            await prismaPg.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${table}";`);
            console.log(`  - Reset sequence for ${table}`);
        } catch (error) {
            console.error(`  - Failed to reset sequence for ${table}`, error);
        }
    }

    console.log('🎉 Migration Completed Successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prismaPg.$disconnect();
        await prismaSqlite.$disconnect();
    });
