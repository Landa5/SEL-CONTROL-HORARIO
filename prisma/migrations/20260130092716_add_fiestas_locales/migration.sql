-- CreateTable
CREATE TABLE "FiestaLocal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" TEXT,
    "esAnual" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompensacionFestivo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleadoId" INTEGER NOT NULL,
    "jornadaId" INTEGER NOT NULL,
    "fiestaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'Compensación por fiesta local trabajada',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompensacionFestivo_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompensacionFestivo_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "JornadaLaboral" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompensacionFestivo_fiestaId_fkey" FOREIGN KEY ("fiestaId") REFERENCES "FiestaLocal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Empleado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "dni" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'CONDUCTOR',
    "fechaAlta" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaBaja" DATETIME,
    "observaciones" TEXT,
    "diasVacaciones" INTEGER NOT NULL DEFAULT 30,
    "diasExtras" INTEGER NOT NULL DEFAULT 0,
    "horasExtra" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Empleado" ("activo", "createdAt", "diasExtras", "diasVacaciones", "email", "id", "nombre", "password", "rol", "updatedAt", "usuario") SELECT "activo", "createdAt", "diasExtras", "diasVacaciones", "email", "id", "nombre", "password", "rol", "updatedAt", "usuario" FROM "Empleado";
DROP TABLE "Empleado";
ALTER TABLE "new_Empleado" RENAME TO "Empleado";
CREATE UNIQUE INDEX "Empleado_usuario_key" ON "Empleado"("usuario");
CREATE UNIQUE INDEX "Empleado_dni_key" ON "Empleado"("dni");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FiestaLocal_fecha_nombre_key" ON "FiestaLocal"("fecha", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CompensacionFestivo_jornadaId_key" ON "CompensacionFestivo"("jornadaId");
