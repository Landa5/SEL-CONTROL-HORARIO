'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Construction, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ConstructionPage() {
    const searchParams = useSearchParams();
    const modulo = searchParams.get('modulo') || 'Módulo';

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-theme(spacing.32))] text-center p-6">
            <div className="bg-yellow-50 p-6 rounded-full mb-6 animate-bounce">
                <Construction className="w-16 h-16 text-yellow-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                {modulo} en Construcción
            </h1>
            <p className="text-gray-500 max-w-md mb-8">
                Estamos trabajando en esta funcionalidad. Pronto estará disponible para mejorar la gestión de su flota y personal.
            </p>
            <div className="flex gap-4">
                <Link href="/admin/dashboard">
                    <Button variant="outline" className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    );
}
