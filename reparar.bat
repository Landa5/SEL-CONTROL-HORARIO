@echo off
echo ===========================================
echo   REPARADOR DE SERVIDOR - SEL CONTROL
echo ===========================================
echo.
echo 1. Deteniendo procesos Node.js bloqueados (Liberando archivos)...
taskkill /F /IM node.exe
echo.
echo 2. Regenerando Cliente de Base de Datos (Prisma)...
call npx prisma generate
echo.
echo 3. Reiniciando Servidor...
echo    (Espera a que diga "Ready" en el puerto 3000)
echo.
call npm run dev
pause
