import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Obtener revisión de un mes/camión concreto para el conductor actual
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const camionId = searchParams.get('camionId');
    const mes = searchParams.get('mes'); // "YYYY-MM"

    if (!camionId || !mes) {
        return NextResponse.json({ error: 'camionId y mes son requeridos' }, { status: 400 });
    }

    const revision = await prisma.revisionAccesorios.findUnique({
        where: {
            camionId_empleadoId_mes: {
                camionId: parseInt(camionId),
                empleadoId: session.id as number,
                mes
            }
        }
    });

    return NextResponse.json(revision); // null si no existe
}

// POST: Crear o actualizar la revisión mensual
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const camionId: number = Number(body.camionId);
    const mes: string = body.mes; // "YYYY-MM"

    if (!camionId || !mes) {
        return NextResponse.json({ error: 'camionId y mes son requeridos' }, { status: 400 });
    }

    // Verificar que el camión existe
    const camion = await prisma.camion.findUnique({ where: { id: camionId } });
    if (!camion) return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 });

    const data = {
        camionId,
        empleadoId: session.id as number,
        mes,
        instruccionesEscritas: Boolean(body.instruccionesEscritas),
        linternaPetroval: Boolean(body.linternaPetroval),
        linternaNormal: Boolean(body.linternaNormal),
        gafasSeguridad: Boolean(body.gafasSeguridad),
        chaleco: Boolean(body.chaleco),
        calzo: Boolean(body.calzo),
        liquidoAclaraOjos: Boolean(body.liquidoAclaraOjos),
        guantes: Boolean(body.guantes),
        impermeableCasco: Boolean(body.impermeableCasco),
        triangulos: Boolean(body.triangulos),
        sAutoportante: Boolean(body.sAutoportante),
        cargadorMovil: Boolean(body.cargadorMovil),
        pala: Boolean(body.pala),
        obturador: Boolean(body.obturador),
        recColector: Boolean(body.recColector),
        sepiolita: Boolean(body.sepiolita),
        cuerda: Boolean(body.cuerda),
        pistolaMk50: Boolean(body.pistolaMk50),
        pistolaAutomatica: Boolean(body.pistolaAutomatica),
        fundaNegraPistola: Boolean(body.fundaNegraPistola),
        ruedasDelante: Boolean(body.ruedasDelante),
        ruedasDetras: Boolean(body.ruedasDetras),
        limpiezaInterior: Boolean(body.limpiezaInterior),
        limpiezaExterior: Boolean(body.limpiezaExterior),
        desagues: Boolean(body.desagues),
        grifos: Boolean(body.grifos),
        aceiteAgua: Boolean(body.aceiteAgua),
        presionRuedas: Boolean(body.presionRuedas),
        observaciones: body.observaciones || null,
    };

    // upsert: si ya existe la actualiza, si no la crea
    const revision = await prisma.revisionAccesorios.upsert({
        where: {
            camionId_empleadoId_mes: { camionId, empleadoId: session.id as number, mes }
        },
        create: data,
        update: { ...data }
    });

    return NextResponse.json(revision, { status: 201 });
}
