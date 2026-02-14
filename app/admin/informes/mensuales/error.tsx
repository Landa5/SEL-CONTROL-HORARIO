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
            <p className="text-gray-500 mb-8 max-w-md">
                Ha ocurrido un error al cargar el informe mensual.
                <br />
                <span className="text-xs font-mono bg-gray-100 p-1 rounded mt-2 block overflow-hidden text-ellipsis">
                    {error.message || 'Error desconocido'}
                </span>
            </p>
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
