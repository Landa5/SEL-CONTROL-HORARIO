# Sistema de Control Horario y Gestión de Distribución

Este sistema permite gestionar el control horario, tramos de camiones, descargas, ausencias y mantenimiento (averías) para una empresa de distribución de gasoil.

## Requisitos
- Node.js 18+
- SQLite (incluido en la configuración de Prisma)

## Instalación
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar base de datos:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
3. (Opcional) Crear el administrador inicial:
   ```bash
   node scripts/create-admin.js
   ```

## Roles y Usuarios de Prueba
Todos los usuarios usan la contraseña `1234` o `admin123` (ver tabla).

| Usuario | Contraseña | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | ADMIN | Gestión total, reportes y aprobación de vacaciones. |
| **oficina** | `1234` | OFICINA | Gestión de personal, ausencias y averías. |
| **manolo** | `1234` | CONDUCTOR | Control horario, tramos de camión y reporte de averías. |
| **taller** | `1234` | MECANICO | Panel de taller, historial de reparaciones y mantenimientos. |

## Funcionalidades Clave
- **Control Horario**: Validación de doble entrada y cálculo automático de horas.
- **Tramos (Conductores)**: Validación dura de continuidad de kilómetros entre tramos.
- **Gestión de Averías**: Sistema de historial (mini-CRM) con trazabilidad de cada acción.
- **Ausencias**: Notificaciones automáticas al administrador y descuento de saldo de vacaciones.
- **Interfaz Adaptada**: Dashboard específico y simplificado según el rol del usuario logueado.

## Comandos Útiles
- `npm run dev`: Iniciar servidor de desarrollo.
- `npx prisma studio`: Ver base de datos en el navegador.
