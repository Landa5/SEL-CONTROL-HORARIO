import { prisma } from '@/lib/prisma';
import { TareaVisibilidad, AreaResponsable, TipoNotificacion, RolParticipacion } from '@prisma/client';

// ═══════════════════════════════════════════════════
// Motor de Visibilidad v3.1
// ═══════════════════════════════════════════════════

interface SessionUser {
  id: number;
  rol: string;
}

/**
 * Mapping: Rol del usuario → áreas que puede ver en modo EQUIPO
 */
const ROL_TO_AREAS: Record<string, AreaResponsable[]> = {
  ADMIN: Object.values(AreaResponsable) as AreaResponsable[],
  MECANICO: ['TALLER'],
  OFICINA: ['OFICINA', 'OPERACIONES', 'COMERCIAL'],
  COMERCIAL: ['COMERCIAL'],
  // CONDUCTOR y EMPLEADO: no ven por área, solo por participación
};

/**
 * Construye el filtro WHERE de Prisma según las reglas de visibilidad v3.1.
 * Se combina con otros filtros (tipo, estado, etc.) via AND.
 */
export function buildVisibilityFilter(session: SessionUser, options?: { auditoria?: boolean }) {
  const userId = Number(session.id);
  const isAdmin = session.rol === 'ADMIN';

  // Admin: ve todo excepto PERSONAL (a menos que use modo auditoría)
  if (isAdmin) {
    if (options?.auditoria) {
      // Modo auditoría: admin ve TODO, incluido PERSONAL
      return {};
    }
    // Normal: admin ve todo excepto PERSONAL
    return {
      OR: [
        { visibilidad: { not: 'PERSONAL' as TareaVisibilidad } },
        { creadoPorId: userId }, // Sus propias PERSONAL sí las ve
      ]
    };
  }

  // No-admin: reglas de visibilidad granulares
  const participacionFilter = {
    participantes: { some: { empleadoId: userId } }
  };

  const esCreadorOAsignado = {
    OR: [
      { creadoPorId: userId },
      { asignadoAId: userId },
    ]
  };

  const conditions: any[] = [];

  // GENERAL: según rol
  if (['MECANICO', 'OFICINA', 'COMERCIAL'].includes(session.rol)) {
    // Staff ve GENERAL (filtrado también por privada legacy para compatibilidad)
    conditions.push({
      AND: [
        { visibilidad: 'GENERAL' as TareaVisibilidad },
        {
          OR: [
            { creadoPorId: userId },
            { asignadoAId: userId },
            { asignadoAId: null },  // Pool sin asignar
            { tipo: 'TALLER' },      // Mecánicos/oficina ven taller
            participacionFilter,
          ]
        }
      ]
    });
  } else {
    // CONDUCTOR/EMPLEADO: GENERAL solo creador/asignado/participante
    conditions.push({
      AND: [
        { visibilidad: 'GENERAL' as TareaVisibilidad },
        {
          OR: [
            ...esCreadorOAsignado.OR,
            participacionFilter,
          ]
        }
      ]
    });
  }

  // EQUIPO: participante O área coincidente
  const areasUsuario = ROL_TO_AREAS[session.rol] || [];
  const equipoConditions: any[] = [
    ...esCreadorOAsignado.OR,
    participacionFilter,
  ];
  if (areasUsuario.length > 0) {
    equipoConditions.push({
      areaResponsable: { in: areasUsuario }
    });
  }
  conditions.push({
    AND: [
      { visibilidad: 'EQUIPO' as TareaVisibilidad },
      { OR: equipoConditions }
    ]
  });

  // DIRIGIDA: solo creador/asignado/participante
  conditions.push({
    AND: [
      { visibilidad: 'DIRIGIDA' as TareaVisibilidad },
      {
        OR: [
          ...esCreadorOAsignado.OR,
          participacionFilter,
        ]
      }
    ]
  });

  // PERSONAL: solo creador
  conditions.push({
    AND: [
      { visibilidad: 'PERSONAL' as TareaVisibilidad },
      { creadoPorId: userId }
    ]
  });

  // CONFIDENCIAL: solo participante explícito (+ OFICINA si participante)
  if (['OFICINA'].includes(session.rol)) {
    conditions.push({
      AND: [
        { visibilidad: 'CONFIDENCIAL' as TareaVisibilidad },
        {
          OR: [
            ...esCreadorOAsignado.OR,
            participacionFilter,
          ]
        }
      ]
    });
  }
  // MECANICO/CONDUCTOR/EMPLEADO: no ven CONFIDENCIAL excepto si son participantes directos
  // (ya cubierto por el else implícito: no se añade condition para CONFIDENCIAL)

  return { OR: conditions };
}

// ═══════════════════════════════════════════════════
// Validación de Cierre TALLER
// ═══════════════════════════════════════════════════

interface CierreValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCierreTaller(
  extensionTaller: any,
  resumenCierre: string | null | undefined,
  bodyExtension?: any
): CierreValidationResult {
  const errors: string[] = [];

  // diagnosticoFinal: obligatorio
  const diagnostico = bodyExtension?.diagnosticoFinal ?? extensionTaller?.diagnosticoFinal;
  if (!diagnostico || diagnostico.trim() === '') {
    errors.push('diagnosticoFinal es obligatorio para cerrar una tarea TALLER');
  }

  // tipoAveria: obligatorio (puede venir en body o ya existir)
  const tipoAveria = bodyExtension?.tipoAveria ?? extensionTaller?.tipoAveria;
  if (!tipoAveria) {
    errors.push('tipoAveria es obligatorio para cerrar una tarea TALLER');
  }

  // costeFinal: obligatorio (puede ser 0)
  const costeFinal = bodyExtension?.costeFinal ?? extensionTaller?.costeFinal;
  if (costeFinal === null || costeFinal === undefined) {
    errors.push('costeFinal es obligatorio para cerrar una tarea TALLER (puede ser 0)');
  }

  // resumenCierre: obligatorio (campo de Tarea)
  if (!resumenCierre || resumenCierre.trim() === '') {
    errors.push('resumenCierre es obligatorio para cerrar una tarea TALLER');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════
// Permisos por Rol × Tipo × Acción
// ═══════════════════════════════════════════════════

type TareaAction = 'ver' | 'editar' | 'editar_tecnico' | 'comentar' | 'adjuntos' | 'cambiar_estado' | 'reasignar' | 'cerrar' | 'reabrir';

export function checkPermission(
  session: SessionUser,
  tarea: { tipo: string; creadoPorId: number; asignadoAId: number | null },
  action: TareaAction,
  participantes?: { empleadoId: number }[]
): boolean {
  const userId = Number(session.id);
  const isCreador = tarea.creadoPorId === userId;
  const isAsignado = tarea.asignadoAId === userId;
  const isParticipante = participantes?.some(p => p.empleadoId === userId) || false;
  const isInvolved = isCreador || isAsignado || isParticipante;

  if (session.rol === 'ADMIN') return true;

  if (tarea.tipo === 'TALLER') {
    switch (action) {
      case 'ver': return session.rol === 'OFICINA' || session.rol === 'MECANICO' || isInvolved;
      case 'editar': return session.rol === 'OFICINA' || (session.rol === 'MECANICO' && isAsignado);
      case 'editar_tecnico': return session.rol === 'MECANICO';
      case 'comentar': return ['OFICINA', 'MECANICO'].includes(session.rol) || isInvolved;
      case 'adjuntos': return ['OFICINA', 'MECANICO'].includes(session.rol) || isInvolved;
      case 'cambiar_estado': return session.rol === 'OFICINA' || (session.rol === 'MECANICO' && isAsignado);
      case 'reasignar': return session.rol === 'OFICINA';
      case 'cerrar': return session.rol === 'MECANICO' && isAsignado;
      case 'reabrir': return false; // Solo ADMIN
    }
  }

  if (tarea.tipo === 'RECLAMACION') {
    switch (action) {
      case 'ver': return session.rol === 'OFICINA' || isCreador;
      case 'editar': return session.rol === 'OFICINA';
      case 'comentar': return session.rol === 'OFICINA' || isCreador;
      case 'adjuntos': return session.rol === 'OFICINA' || isCreador;
      case 'cerrar': return session.rol === 'OFICINA';
      default: return false;
    }
  }

  // GENERALES
  switch (action) {
    case 'ver': return isInvolved || session.rol === 'OFICINA';
    case 'editar': return session.rol === 'OFICINA' || isCreador || isAsignado;
    case 'comentar': return isInvolved || session.rol === 'OFICINA';
    case 'cerrar': return session.rol === 'OFICINA' || isAsignado || isCreador;
    case 'cambiar_estado': return session.rol === 'OFICINA' || isAsignado;
    case 'reasignar': return session.rol === 'OFICINA';
    default: return isInvolved;
  }
}

// ═══════════════════════════════════════════════════
// Notificaciones con deduplicación
// ═══════════════════════════════════════════════════

export async function createNotificacion(params: {
  usuarioId: number;
  mensaje: string;
  link?: string;
  tipo: TipoNotificacion;
  tareaId?: number;
  actorId?: number;
}) {
  // Generar hash para deduplicación
  const now = new Date();
  const hourTruncated = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  const hash = `${params.tipo}:${params.tareaId || ''}:${params.actorId || ''}:${hourTruncated}`;

  // No notificar al actor de su propia acción
  if (params.actorId && params.actorId === params.usuarioId) return;

  // Buscar duplicado no leído en las últimas 2 horas
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const existing = await prisma.notificacion.findFirst({
    where: {
      hash,
      readAt: null,
      createdAt: { gte: twoHoursAgo }
    }
  });

  if (existing) return; // Deduplicado

  await prisma.notificacion.create({
    data: {
      usuarioId: params.usuarioId,
      mensaje: params.mensaje,
      link: params.link,
      tipo: params.tipo,
      tareaId: params.tareaId,
      actorId: params.actorId,
      hash,
      canal: 'INTERNA',
    }
  });
}

/**
 * Notifica a todos los participantes de una tarea (excluyendo al actor)
 */
export async function notifyParticipantes(params: {
  tareaId: number;
  actorId: number;
  mensaje: string;
  link: string;
  tipo: TipoNotificacion;
}) {
  const participantes = await prisma.tareaParticipante.findMany({
    where: { tareaId: params.tareaId, notificar: true },
    select: { empleadoId: true }
  });

  for (const p of participantes) {
    await createNotificacion({
      usuarioId: p.empleadoId,
      mensaje: params.mensaje,
      link: params.link,
      tipo: params.tipo,
      tareaId: params.tareaId,
      actorId: params.actorId,
    });
  }
}

// ═══════════════════════════════════════════════════
// Determinación automática de visibilidad
// ═══════════════════════════════════════════════════

export function determineVisibilidad(
  tipo: string,
  privada: boolean,
  asignadoAId: number | null
): TareaVisibilidad {
  if (tipo === 'RECLAMACION') return 'CONFIDENCIAL';
  if (tipo === 'TALLER') return privada ? 'DIRIGIDA' : 'EQUIPO';
  if (privada) return asignadoAId ? 'DIRIGIDA' : 'PERSONAL';
  return 'GENERAL';
}

/**
 * Determina el área responsable automáticamente basándose en el tipo
 */
export function determineAreaResponsable(tipo: string): AreaResponsable | null {
  if (tipo === 'TALLER') return 'TALLER';
  if (tipo === 'RECLAMACION') return 'OFICINA';
  return null;
}
