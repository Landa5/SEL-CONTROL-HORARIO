'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LayoutDashboard, Truck, AlertCircle, LogOut } from 'lucide-react';

export default function OficinaLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-100">
            {children}
        </div>
    );
}
