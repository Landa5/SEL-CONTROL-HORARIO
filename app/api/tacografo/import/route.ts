import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { processImport } from '@/lib/tacografo/tachograph-service';

// Extend Vercel serverless function timeout to 60s (default is 10s)
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id));
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID de usuario inválido en sesión' }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError: any) {
      console.error('Error parsing formData:', formError);
      return NextResponse.json({ error: `Error al leer datos del formulario: ${formError.message}` }, { status: 400 });
    }

    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        results.push({
          fileName: 'unknown',
          success: false,
          status: 'ERROR',
          warnings: [],
          errors: ['El elemento recibido no es un archivo válido']
        });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const result = await processImport(
          buffer,
          file.name,
          file.type || null,
          userId,
          'MANUAL_UPLOAD'
        );
        
        results.push({
          fileName: file.name,
          ...result
        });
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError);
        results.push({
          fileName: file.name,
          success: false,
          status: 'ERROR',
          warnings: [],
          errors: [fileError.message || 'Error desconocido al procesar el archivo']
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('POST /api/tacografo/import error:', error);
    return NextResponse.json({ 
      error: `Error al importar: ${error.message || 'Error interno del servidor'}` 
    }, { status: 500 });
  }
}
