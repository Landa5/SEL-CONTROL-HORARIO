'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Monthly Report Error:', error);
    }, [error]);

    return (
        <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-red-50 p-6 rounded-full mb-6">
                <AlertTriangle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Algo salió mal</h2>
            <div className="text-gray-500 mb-8 max-w-md">
                Ha ocurrido un error al cargar el informe mensual.
                Si ves "Minified React error #310", significa que hay una diferencia entre la hora/fecha de tu navegador y la del servidor.
                <br />
                <div className="mt-4 p-4 bg-gray-100 rounded text-left text-xs font-mono overflow-auto max-h-40 border border-gray-200">
                    <p className="font-bold mb-1">Detalles Técnicos:</p>
                    <p>{error.message || 'Error desconocido'}</p>
                    {error.digest && <p className="text-gray-500">Digest: {error.digest}</p>}
                    <p className="mt-2 text-gray-500">User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'}</p>
                    <p className="text-gray-500">Time: {new Date().toISOString()}</p>
                </div>
            </div>
            <div className="flex gap-4">
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                >
                    Recargar Página
                </Button>
                <Button
                    onClick={() => reset()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    Intentar de nuevo
                </Button>
            </div>
        </div>
    );
}
