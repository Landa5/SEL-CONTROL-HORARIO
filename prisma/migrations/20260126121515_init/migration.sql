-- CreateTable
CREATE TABLE "Empleado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'CONDUCTOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "diasVacaciones" INTEGER NOT NULL DEFAULT 30,
    "diasExtras" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Camion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "modelo" TEXT,
    "marca" TEXT,
    "nVin" TEXT,
    "anio" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "itvVencimiento" DATETIME,
    "seguroVencimiento" DATETIME,
    "tacografoVencimiento" DATETIME,
    "adrVencimiento" DATETIME,
    "anioCisterna" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JornadaLaboral" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "horaEntrada" DATETIME NOT NULL,
    "horaSalida" DATETIME,
    "totalHoras" REAL,
    "estado" TEXT NOT NULL DEFAULT 'TRABAJANDO',
    "observaciones" TEXT,
    "empleadoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JornadaLaboral_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsoCamion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jornadaId" INTEGER NOT NULL,
    "camionId" INTEGER NOT NULL,
    "horaInicio" DATETIME NOT NULL,
    "horaFin" DATETIME,
    "kmInicial" INTEGER NOT NULL,
    "kmFinal" INTEGER,
    "kmRecorridos" INTEGER,
    "descargasCount" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsoCamion_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "JornadaLaboral" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsoCamion_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Descarga" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hora" DATETIME NOT NULL,
    "litros" INTEGER NOT NULL,
    "tipoGasoil" TEXT NOT NULL,
    "lugar" TEXT NOT NULL,
    "usoCamionId" INTEGER NOT NULL,
    CONSTRAINT "Descarga_usoCamionId_fkey" FOREIGN KEY ("usoCamionId") REFERENCES "UsoCamion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "empleadoId" INTEGER NOT NULL,
    "aprobadoPorId" INTEGER,
    "fechaResolucion" DATETIME,
    "justificanteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ausencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'AVERIA',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "activoTipo" TEXT NOT NULL,
    "matricula" TEXT,
    "clienteNombre" TEXT,
    "ubicacionTexto" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" DATETIME,
    "resumenCierre" TEXT,
    "creadoPorId" INTEGER NOT NULL,
    "asignadoAId" INTEGER NOT NULL,
    "camionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tarea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tarea_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tarea_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TareaHistorial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estadoNuevo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TareaHistorial_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TareaHistorial_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TareaAdjunto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TareaAdjunto_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TareaAdjunto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MantenimientoProximo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "camionId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "kmObjetivo" INTEGER,
    "fechaObjetivo" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MantenimientoProximo_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MantenimientoRealizado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kmEnEseMomento" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "piezasCambiadas" TEXT,
    "costo" REAL,
    "taller" TEXT,
    "camionId" INTEGER NOT NULL,
    "tareaId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MantenimientoRealizado_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MantenimientoRealizado_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "detalles" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "link" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_email_key" ON "Empleado"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuario_key" ON "Empleado"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_matricula_key" ON "Camion"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_nVin_key" ON "Camion"("nVin");
