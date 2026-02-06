-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tarea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'AVERIA',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "activoTipo" TEXT,
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
    "asignadoAId" INTEGER,
    "camionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tarea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tarea_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tarea_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tarea" ("activoTipo", "asignadoAId", "camionId", "clienteNombre", "contactoNombre", "contactoTelefono", "creadoPorId", "createdAt", "descripcion", "estado", "fechaCierre", "fechaInicio", "id", "matricula", "prioridad", "resumenCierre", "tipo", "titulo", "ubicacionTexto", "updatedAt") SELECT "activoTipo", "asignadoAId", "camionId", "clienteNombre", "contactoNombre", "contactoTelefono", "creadoPorId", "createdAt", "descripcion", "estado", "fechaCierre", "fechaInicio", "id", "matricula", "prioridad", "resumenCierre", "tipo", "titulo", "ubicacionTexto", "updatedAt" FROM "Tarea";
DROP TABLE "Tarea";
ALTER TABLE "new_Tarea" RENAME TO "Tarea";
CREATE TABLE "new_TareaAdjunto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TareaAdjunto_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TareaAdjunto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TareaAdjunto" ("autorId", "createdAt", "filename", "id", "mimeType", "tareaId", "url") SELECT "autorId", "createdAt", "filename", "id", "mimeType", "tareaId", "url" FROM "TareaAdjunto";
DROP TABLE "TareaAdjunto";
ALTER TABLE "new_TareaAdjunto" RENAME TO "TareaAdjunto";
CREATE TABLE "new_TareaHistorial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estadoNuevo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TareaHistorial_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TareaHistorial_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TareaHistorial" ("autorId", "createdAt", "estadoNuevo", "id", "mensaje", "tareaId", "tipoAccion") SELECT "autorId", "createdAt", "estadoNuevo", "id", "mensaje", "tareaId", "tipoAccion" FROM "TareaHistorial";
DROP TABLE "TareaHistorial";
ALTER TABLE "new_TareaHistorial" RENAME TO "TareaHistorial";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
