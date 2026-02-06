-- CreateEnum
CREATE TYPE "RolEmpleado" AS ENUM ('ADMIN', 'OFICINA', 'CONDUCTOR', 'MECANICO', 'EMPLEADO', 'COMERCIAL');

-- CreateTable
CREATE TABLE "Empleado" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "dni" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "rol" "RolEmpleado" NOT NULL DEFAULT 'CONDUCTOR',
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaBaja" TIMESTAMP(3),
    "observaciones" TEXT,
    "diasVacaciones" INTEGER NOT NULL DEFAULT 30,
    "diasExtras" INTEGER NOT NULL DEFAULT 0,
    "horasExtra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camion" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "modelo" TEXT,
    "marca" TEXT,
    "nVin" TEXT,
    "anio" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "itvVencimiento" TIMESTAMP(3),
    "seguroVencimiento" TIMESTAMP(3),
    "tacografoVencimiento" TIMESTAMP(3),
    "adrVencimiento" TIMESTAMP(3),
    "anioCisterna" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Camion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JornadaLaboral" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaEntrada" TIMESTAMP(3) NOT NULL,
    "horaSalida" TIMESTAMP(3),
    "totalHoras" DOUBLE PRECISION,
    "estado" TEXT NOT NULL DEFAULT 'TRABAJANDO',
    "observaciones" TEXT,
    "empleadoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JornadaLaboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoCamion" (
    "id" SERIAL NOT NULL,
    "jornadaId" INTEGER NOT NULL,
    "camionId" INTEGER NOT NULL,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFin" TIMESTAMP(3),
    "kmInicial" INTEGER NOT NULL,
    "kmFinal" INTEGER,
    "kmRecorridos" INTEGER,
    "descargasCount" INTEGER NOT NULL DEFAULT 0,
    "viajesCount" INTEGER NOT NULL DEFAULT 0,
    "litrosRepostados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fotoKmInicial" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsoCamion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Descarga" (
    "id" SERIAL NOT NULL,
    "hora" TIMESTAMP(3) NOT NULL,
    "litros" INTEGER NOT NULL,
    "tipoGasoil" TEXT NOT NULL,
    "lugar" TEXT NOT NULL,
    "usoCamionId" INTEGER NOT NULL,

    CONSTRAINT "Descarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "empleadoId" INTEGER NOT NULL,
    "aprobadoPorId" INTEGER,
    "fechaResolucion" TIMESTAMP(3),
    "justificanteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" SERIAL NOT NULL,
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
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "resumenCierre" TEXT,
    "creadoPorId" INTEGER NOT NULL,
    "asignadoAId" INTEGER,
    "camionId" INTEGER,
    "descargas" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaHistorial" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estadoNuevo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TareaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaAdjunto" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TareaAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantenimientoProximo" (
    "id" SERIAL NOT NULL,
    "camionId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "kmObjetivo" INTEGER,
    "fechaObjetivo" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MantenimientoProximo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantenimientoRealizado" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kmEnEseMomento" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "piezasCambiadas" TEXT,
    "costo" DOUBLE PRECISION,
    "taller" TEXT,
    "camionId" INTEGER NOT NULL,
    "tareaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MantenimientoRealizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "detalles" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "link" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiestaLocal" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" TEXT,
    "esAnual" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiestaLocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensacionFestivo" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "jornadaId" INTEGER NOT NULL,
    "fiestaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'Compensación por fiesta local trabajada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensacionFestivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuloFormacion" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "duracionEstimada" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuloFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemaFormacion" (
    "id" SERIAL NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "resourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemaFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreguntaFormacion" (
    "id" SERIAL NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "opcionA" TEXT NOT NULL,
    "opcionB" TEXT NOT NULL,
    "opcionC" TEXT NOT NULL,
    "correcta" TEXT NOT NULL DEFAULT 'A',
    "puntos" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreguntaFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoFormacion" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "puntuacion" INTEGER NOT NULL DEFAULT 0,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "completadoAl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultadoFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoNomina" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConceptoNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaNomina" (
    "id" SERIAL NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "rol" TEXT,
    "empleadoId" INTEGER,
    "valor" DOUBLE PRECISION NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NominaMes" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "totalBruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVariables" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cerradaPorId" INTEGER,
    "fechaCierre" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NominaMes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NominaLinea" (
    "id" SERIAL NOT NULL,
    "nominaId" INTEGER NOT NULL,
    "conceptoCodigo" TEXT NOT NULL,
    "conceptoNombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NominaLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComercialLitros" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "litros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComercialLitros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioGestoria" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "urlPdfConsolidado" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',

    CONSTRAINT "EnvioGestoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuario_key" ON "Empleado"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_dni_key" ON "Empleado"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_matricula_key" ON "Camion"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_nVin_key" ON "Camion"("nVin");

-- CreateIndex
CREATE UNIQUE INDEX "FiestaLocal_fecha_nombre_key" ON "FiestaLocal"("fecha", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CompensacionFestivo_jornadaId_key" ON "CompensacionFestivo"("jornadaId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultadoFormacion_empleadoId_moduloId_key" ON "ResultadoFormacion"("empleadoId", "moduloId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoNomina_codigo_key" ON "ConceptoNomina"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "NominaMes_empleadoId_year_month_key" ON "NominaMes"("empleadoId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ComercialLitros_empleadoId_year_month_key" ON "ComercialLitros"("empleadoId", "year", "month");

-- AddForeignKey
ALTER TABLE "JornadaLaboral" ADD CONSTRAINT "JornadaLaboral_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoCamion" ADD CONSTRAINT "UsoCamion_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "JornadaLaboral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoCamion" ADD CONSTRAINT "UsoCamion_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Descarga" ADD CONSTRAINT "Descarga_usoCamionId_fkey" FOREIGN KEY ("usoCamionId") REFERENCES "UsoCamion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaHistorial" ADD CONSTRAINT "TareaHistorial_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaHistorial" ADD CONSTRAINT "TareaHistorial_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaAdjunto" ADD CONSTRAINT "TareaAdjunto_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaAdjunto" ADD CONSTRAINT "TareaAdjunto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoProximo" ADD CONSTRAINT "MantenimientoProximo_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoRealizado" ADD CONSTRAINT "MantenimientoRealizado_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoRealizado" ADD CONSTRAINT "MantenimientoRealizado_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensacionFestivo" ADD CONSTRAINT "CompensacionFestivo_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensacionFestivo" ADD CONSTRAINT "CompensacionFestivo_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "JornadaLaboral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensacionFestivo" ADD CONSTRAINT "CompensacionFestivo_fiestaId_fkey" FOREIGN KEY ("fiestaId") REFERENCES "FiestaLocal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloFormacion" ADD CONSTRAINT "ModuloFormacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemaFormacion" ADD CONSTRAINT "TemaFormacion_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloFormacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreguntaFormacion" ADD CONSTRAINT "PreguntaFormacion_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloFormacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadoFormacion" ADD CONSTRAINT "ResultadoFormacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadoFormacion" ADD CONSTRAINT "ResultadoFormacion_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloFormacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaNomina" ADD CONSTRAINT "TarifaNomina_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoNomina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaNomina" ADD CONSTRAINT "TarifaNomina_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominaMes" ADD CONSTRAINT "NominaMes_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominaLinea" ADD CONSTRAINT "NominaLinea_nominaId_fkey" FOREIGN KEY ("nominaId") REFERENCES "NominaMes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComercialLitros" ADD CONSTRAINT "ComercialLitros_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

