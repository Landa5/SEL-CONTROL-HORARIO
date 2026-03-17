import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { evaluateRegulations } from '@/lib/tacografo/regulation/regulation-engine';

// Extend timeout
export const maxDuration = 60;

/**
 * GET /api/tacografo/regulation
 * Consulta findings con filtros
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const user: any = await verifyToken(session);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const ruleCode = searchParams.get('ruleCode');
  const result = searchParams.get('result');
  const severity = searchParams.get('severity');
  const evaluability = searchParams.get('evaluability');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  const where: any = {};
  if (driverId) where.driverId = parseInt(driverId);
  if (dateFrom) where.dateFrom = { gte: new Date(dateFrom) };
  if (dateTo) where.dateTo = { lte: new Date(dateTo) };
  if (ruleCode) where.ruleCode = ruleCode;
  if (result) where.result = result;
  if (severity) where.severity = severity;
  if (evaluability) where.evaluability = evaluability;

  const [findings, total] = await Promise.all([
    prisma.tachographRegulationFinding.findMany({
      where,
      orderBy: { dateFrom: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        driver: {
          select: { id: true, fullName: true, cardNumber: true },
        },
      },
    }),
    prisma.tachographRegulationFinding.count({ where }),
  ]);

  // Summary stats
  const stats = await prisma.tachographRegulationFinding.groupBy({
    by: ['result'],
    where,
    _count: true,
  });

  return NextResponse.json({
    findings,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    stats: stats.reduce((acc: Record<string, number>, s: any) => {
      acc[s.result] = s._count;
      return acc;
    }, {} as Record<string, number>),
  });
}

/**
 * POST /api/tacografo/regulation
 * Ejecutar evaluación normativa
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const user: any = await verifyToken(session);
  if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { driverId, dateFrom, dateTo } = body;

    if (!driverId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'Se requieren driverId, dateFrom y dateTo' },
        { status: 400 },
      );
    }

    const result = await evaluateRegulations(
      parseInt(driverId),
      new Date(dateFrom),
      new Date(dateTo),
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en evaluación normativa:', error);
    return NextResponse.json(
      { error: 'Error en evaluación normativa', details: error.message },
      { status: 500 },
    );
  }
}
