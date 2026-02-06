import { NextResponse } from 'next/server';
import { processWorkshopInvoices } from '@/lib/ai/invoice-engine';
import { getSession } from '@/lib/auth';

export async function POST() {
    try {
        const session: any = await getSession();
        if (!session || !['ADMIN', 'OFICINA'].includes(session.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const result = await processWorkshopInvoices();

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('API Process Invoices Error:', error);
        return NextResponse.json({ error: 'Error interno al procesar facturas' }, { status: 500 });
    }
}
