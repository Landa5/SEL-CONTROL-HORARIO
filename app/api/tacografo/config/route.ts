import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

const DEFAULT_CONFIG = [
  { key: 'input_folder', value: '', label: 'Carpeta de entrada' },
  { key: 'processed_folder', value: '', label: 'Carpeta de procesados' },
  { key: 'error_folder', value: '', label: 'Carpeta de errores' },
  { key: 'allowed_extensions', value: '.ddd,.dtco,.tgd,.v1b,.c1b,.esm', label: 'Extensiones permitidas' },
  { key: 'timezone', value: 'Europe/Madrid', label: 'Zona horaria' },
  { key: 'dedup_strategy', value: 'hash', label: 'Estrategia de deduplicación' },
  { key: 'keep_original_files', value: 'true', label: 'Conservar archivos originales' },
  { key: 'reprocess_policy', value: 'manual', label: 'Política de reprocesado' },
];

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN'].includes(user.rol)) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    let configs = await prisma.tachographConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Seed default config if empty
    if (configs.length === 0) {
      await prisma.tachographConfig.createMany({
        data: DEFAULT_CONFIG,
      });
      configs = await prisma.tachographConfig.findMany({ orderBy: { key: 'asc' } });
    }

    return NextResponse.json(configs);
  } catch (error: any) {
    console.error('GET /api/tacografo/config error:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN'].includes(user.rol)) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const { configs } = body; // Array of { key, value }

    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
    }

    for (const config of configs) {
      await prisma.tachographConfig.upsert({
        where: { key: config.key },
        update: { value: config.value, updatedBy: parseInt(user.id) },
        create: { key: config.key, value: config.value, label: config.label || config.key, updatedBy: parseInt(user.id) },
      });
    }

    const updated = await prisma.tachographConfig.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/tacografo/config error:', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
