import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('=== Migración v3.1 - Centro Operativo ===\n');

  // ── 1. Mapear visibilidad (orden por prioridad, sin redundancias) ──
  console.log('1. Mapeando privada + tipo → visibilidad...');

  // 1a: RECLAMACION → siempre CONFIDENCIAL (independiente de privada)
  const reclamaciones = await prisma.tarea.updateMany({
    where: { tipo: 'RECLAMACION', visibilidad: 'GENERAL' },
    data: { visibilidad: 'CONFIDENCIAL' }
  });
  console.log(`   RECLAMACION → CONFIDENCIAL: ${reclamaciones.count}`);

  // 1b: TALLER no privada → EQUIPO
  const tallerPublicas = await prisma.tarea.updateMany({
    where: { tipo: 'TALLER', privada: false, visibilidad: 'GENERAL' },
    data: { visibilidad: 'EQUIPO' }
  });
  console.log(`   TALLER (no privada) → EQUIPO: ${tallerPublicas.count}`);

  // 1c: TALLER privada → DIRIGIDA
  const tallerPrivadas = await prisma.tarea.updateMany({
    where: { tipo: 'TALLER', privada: true, visibilidad: 'GENERAL' },
    data: { visibilidad: 'DIRIGIDA' }
  });
  console.log(`   TALLER (privada) → DIRIGIDA: ${tallerPrivadas.count}`);

  // 1d: Privada con asignado → DIRIGIDA
  const privadasConAsignado = await prisma.tarea.updateMany({
    where: {
      privada: true,
      asignadoAId: { not: null },
      visibilidad: 'GENERAL'
    },
    data: { visibilidad: 'DIRIGIDA' }
  });
  console.log(`   Privada con asignado → DIRIGIDA: ${privadasConAsignado.count}`);

  // 1e: Privada sin asignado → PERSONAL
  const privadasSinAsignado = await prisma.tarea.updateMany({
    where: {
      privada: true,
      asignadoAId: null,
      visibilidad: 'GENERAL'
    },
    data: { visibilidad: 'PERSONAL' }
  });
  console.log(`   Privada sin asignado → PERSONAL: ${privadasSinAsignado.count}`);

  // 1f: Todo lo que queda GENERAL ya tiene el default correcto

  // ── 2. Crear TareaParticipante (idempotente via upsert) ──
  console.log('\n2. Creando TareaParticipante...');

  const todasTareas = await prisma.tarea.findMany({
    select: { id: true, creadoPorId: true, asignadoAId: true }
  });

  let creados = 0;
  let existentes = 0;

  for (const t of todasTareas) {
    // Creador → RESPONSABLE
    try {
      await prisma.tareaParticipante.upsert({
        where: { tareaId_empleadoId: { tareaId: t.id, empleadoId: t.creadoPorId } },
        update: {},
        create: {
          tareaId: t.id,
          empleadoId: t.creadoPorId,
          rolParticipacion: 'RESPONSABLE',
          notificar: true
        }
      });
      creados++;
    } catch {
      existentes++;
    }

    // Asignado → SEGUIDOR (si existe y diferente del creador)
    if (t.asignadoAId && t.asignadoAId !== t.creadoPorId) {
      try {
        await prisma.tareaParticipante.upsert({
          where: { tareaId_empleadoId: { tareaId: t.id, empleadoId: t.asignadoAId } },
          update: {},
          create: {
            tareaId: t.id,
            empleadoId: t.asignadoAId,
            rolParticipacion: 'SEGUIDOR',
            notificar: true
          }
        });
        creados++;
      } catch {
        existentes++;
      }
    }
  }

  console.log(`   Participantes creados: ${creados}, ya existentes: ${existentes}`);

  // ── 3. Crear TareaTaller para tipo=TALLER (idempotente) ──
  console.log('\n3. Creando TareaTaller para tareas tipo TALLER...');

  const tareasTaller = await prisma.tarea.findMany({
    where: { tipo: 'TALLER' },
    select: { id: true }
  });

  let tallerCreados = 0;
  for (const t of tareasTaller) {
    try {
      await prisma.tareaTaller.upsert({
        where: { tareaId: t.id },
        update: {},
        create: { tareaId: t.id }
      });
      tallerCreados++;
    } catch {
      // ya existe
    }
  }

  console.log(`   TareaTaller: ${tallerCreados} creados de ${tareasTaller.length} tareas TALLER`);

  // ── 4. Crear TareaReclamacion para tipo=RECLAMACION (idempotente) ──
  console.log('\n4. Creando TareaReclamacion para tareas tipo RECLAMACION...');

  const tareasReclamacion = await prisma.tarea.findMany({
    where: { tipo: 'RECLAMACION' },
    select: { id: true }
  });

  let reclamacionCreados = 0;
  for (const t of tareasReclamacion) {
    try {
      await prisma.tareaReclamacion.upsert({
        where: { tareaId: t.id },
        update: {},
        create: { tareaId: t.id }
      });
      reclamacionCreados++;
    } catch {
      // ya existe
    }
  }

  console.log(`   TareaReclamacion: ${reclamacionCreados} creados de ${tareasReclamacion.length} tareas RECLAMACION`);

  // ── 5. Migrar leida → readAt en Notificacion ──
  console.log('\n5. Migrando leida → readAt en Notificacion...');

  const notifMigradas = await prisma.notificacion.updateMany({
    where: { leida: true, readAt: null },
    data: { readAt: new Date() }
  });
  console.log(`   Notificaciones migradas (leida=true → readAt): ${notifMigradas.count}`);

  // ── 6. Verificación ──
  console.log('\n=== VERIFICACIÓN ===\n');

  const totalTareas = await prisma.tarea.count();
  const totalParticipantes = await prisma.tareaParticipante.count();
  const tareasConParticipante = await prisma.tarea.count({
    where: { participantes: { some: {} } }
  });
  const totalTallerDB = await prisma.tareaTaller.count();
  const totalReclamacionDB = await prisma.tareaReclamacion.count();
  const totalTallerTareas = await prisma.tarea.count({ where: { tipo: 'TALLER' } });
  const totalReclamacionTareas = await prisma.tarea.count({ where: { tipo: 'RECLAMACION' } });
  const inconsistencias = await prisma.tarea.count({
    where: { privada: true, visibilidad: 'GENERAL' }
  });

  console.log(`Total tareas:           ${totalTareas}`);
  console.log(`Tareas con participante: ${tareasConParticipante} / ${totalTareas}`);
  console.log(`Total participantes:     ${totalParticipantes}`);
  console.log(`TareaTaller:             ${totalTallerDB} / ${totalTallerTareas} (tareas TALLER)`);
  console.log(`TareaReclamacion:        ${totalReclamacionDB} / ${totalReclamacionTareas} (tareas RECLAMACION)`);
  console.log(`Inconsistencias (privada=true + GENERAL): ${inconsistencias}`);
  console.log('');

  const ok = (
    tareasConParticipante === totalTareas &&
    totalTallerDB === totalTallerTareas &&
    totalReclamacionDB === totalReclamacionTareas &&
    inconsistencias === 0
  );

  if (ok) {
    console.log('✅ MIGRACIÓN COMPLETADA CORRECTAMENTE');
  } else {
    console.log('⚠️  HAY INCONSISTENCIAS - Revisar manualmente');
    if (tareasConParticipante < totalTareas) {
      console.log(`   → ${totalTareas - tareasConParticipante} tareas sin participante`);
    }
    if (totalTallerDB < totalTallerTareas) {
      console.log(`   → ${totalTallerTareas - totalTallerDB} tareas TALLER sin TareaTaller`);
    }
    if (totalReclamacionDB < totalReclamacionTareas) {
      console.log(`   → ${totalReclamacionTareas - totalReclamacionDB} tareas RECLAMACION sin TareaReclamacion`);
    }
  }
}

migrate()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('ERROR EN MIGRACIÓN:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
