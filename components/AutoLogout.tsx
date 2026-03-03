'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AutoLogout() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Si estamos en login, no aplicamos auto-logout o lo limpiamos
        if (pathname === '/login') return;

        // Redirigir por inactividad a las 2h (7200000ms)
        // También se puede asociar a un logueo estricto
        const TIMEOUT_MS = 2 * 60 * 60 * 1000;

        let inactivityTimer: NodeJS.Timeout;

        const resetTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                // Ejecuta el logout endpoint si existe o solo navega a /login
                fetch('/api/auth/logout', { method: 'POST' })
                    .catch(() => { })
                    .finally(() => {
                        router.push('/login');
                    });
            }, TIMEOUT_MS);
        };

        // Reseteamos el contador con la actividad normal de un usuario en un dashboard
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => document.addEventListener(event, resetTimer));

        resetTimer();

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            events.forEach(event => document.removeEventListener(event, resetTimer));
        };
    }, [router, pathname]);

    return null;
}
