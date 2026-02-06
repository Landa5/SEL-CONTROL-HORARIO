'use client';

import EmployeeAbsenceView from '@/components/empleado/EmployeeAbsenceView';
import { Calendar } from 'lucide-react';

export default function MecanicoVacacionesPage() {
    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-xl border shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-orange-600" /> Mis Vacaciones y Ausencias
                </h1>
                <p className="text-gray-500 text-sm mt-1">Consulta tu saldo de días y solicita permisos o vacaciones al taller.</p>
            </header>

            <EmployeeAbsenceView />
        </div>
    );
}
