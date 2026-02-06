
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.0.0
 * Query Engine version: 5dbef10bdbfb579e07d35cc85fb1518d357cb99e
 */
Prisma.prismaVersion = {
  client: "6.0.0",
  engine: "5dbef10bdbfb579e07d35cc85fb1518d357cb99e"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.EmpleadoScalarFieldEnum = {
  id: 'id',
  usuario: 'usuario',
  password: 'password',
  activo: 'activo',
  nombre: 'nombre',
  apellidos: 'apellidos',
  dni: 'dni',
  telefono: 'telefono',
  email: 'email',
  direccion: 'direccion',
  rol: 'rol',
  fechaAlta: 'fechaAlta',
  fechaBaja: 'fechaBaja',
  observaciones: 'observaciones',
  diasVacaciones: 'diasVacaciones',
  diasExtras: 'diasExtras',
  horasExtra: 'horasExtra',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CamionScalarFieldEnum = {
  id: 'id',
  matricula: 'matricula',
  modelo: 'modelo',
  marca: 'marca',
  nVin: 'nVin',
  anio: 'anio',
  activo: 'activo',
  kmActual: 'kmActual',
  itvVencimiento: 'itvVencimiento',
  seguroVencimiento: 'seguroVencimiento',
  tacografoVencimiento: 'tacografoVencimiento',
  adrVencimiento: 'adrVencimiento',
  anioCisterna: 'anioCisterna',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JornadaLaboralScalarFieldEnum = {
  id: 'id',
  fecha: 'fecha',
  horaEntrada: 'horaEntrada',
  horaSalida: 'horaSalida',
  totalHoras: 'totalHoras',
  estado: 'estado',
  observaciones: 'observaciones',
  empleadoId: 'empleadoId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UsoCamionScalarFieldEnum = {
  id: 'id',
  jornadaId: 'jornadaId',
  camionId: 'camionId',
  horaInicio: 'horaInicio',
  horaFin: 'horaFin',
  kmInicial: 'kmInicial',
  kmFinal: 'kmFinal',
  kmRecorridos: 'kmRecorridos',
  descargasCount: 'descargasCount',
  viajesCount: 'viajesCount',
  litrosRepostados: 'litrosRepostados',
  fotoKmInicial: 'fotoKmInicial',
  notas: 'notas',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DescargaScalarFieldEnum = {
  id: 'id',
  hora: 'hora',
  litros: 'litros',
  tipoGasoil: 'tipoGasoil',
  lugar: 'lugar',
  usoCamionId: 'usoCamionId'
};

exports.Prisma.AusenciaScalarFieldEnum = {
  id: 'id',
  tipo: 'tipo',
  fechaInicio: 'fechaInicio',
  fechaFin: 'fechaFin',
  estado: 'estado',
  observaciones: 'observaciones',
  empleadoId: 'empleadoId',
  aprobadoPorId: 'aprobadoPorId',
  fechaResolucion: 'fechaResolucion',
  justificanteUrl: 'justificanteUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TareaScalarFieldEnum = {
  id: 'id',
  tipo: 'tipo',
  estado: 'estado',
  prioridad: 'prioridad',
  activoTipo: 'activoTipo',
  matricula: 'matricula',
  clienteNombre: 'clienteNombre',
  ubicacionTexto: 'ubicacionTexto',
  titulo: 'titulo',
  descripcion: 'descripcion',
  contactoNombre: 'contactoNombre',
  contactoTelefono: 'contactoTelefono',
  fechaInicio: 'fechaInicio',
  fechaCierre: 'fechaCierre',
  resumenCierre: 'resumenCierre',
  creadoPorId: 'creadoPorId',
  asignadoAId: 'asignadoAId',
  camionId: 'camionId',
  descargas: 'descargas',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TareaHistorialScalarFieldEnum = {
  id: 'id',
  tareaId: 'tareaId',
  autorId: 'autorId',
  tipoAccion: 'tipoAccion',
  mensaje: 'mensaje',
  estadoNuevo: 'estadoNuevo',
  createdAt: 'createdAt'
};

exports.Prisma.TareaAdjuntoScalarFieldEnum = {
  id: 'id',
  tareaId: 'tareaId',
  autorId: 'autorId',
  filename: 'filename',
  url: 'url',
  mimeType: 'mimeType',
  createdAt: 'createdAt'
};

exports.Prisma.MantenimientoProximoScalarFieldEnum = {
  id: 'id',
  camionId: 'camionId',
  tipo: 'tipo',
  descripcion: 'descripcion',
  kmObjetivo: 'kmObjetivo',
  fechaObjetivo: 'fechaObjetivo',
  estado: 'estado',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MantenimientoRealizadoScalarFieldEnum = {
  id: 'id',
  fecha: 'fecha',
  kmEnEseMomento: 'kmEnEseMomento',
  tipo: 'tipo',
  descripcion: 'descripcion',
  piezasCambiadas: 'piezasCambiadas',
  costo: 'costo',
  taller: 'taller',
  camionId: 'camionId',
  tareaId: 'tareaId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditoriaScalarFieldEnum = {
  id: 'id',
  usuarioId: 'usuarioId',
  accion: 'accion',
  entidad: 'entidad',
  entidadId: 'entidadId',
  detalles: 'detalles',
  createdAt: 'createdAt'
};

exports.Prisma.NotificacionScalarFieldEnum = {
  id: 'id',
  usuarioId: 'usuarioId',
  mensaje: 'mensaje',
  link: 'link',
  leida: 'leida',
  createdAt: 'createdAt'
};

exports.Prisma.FiestaLocalScalarFieldEnum = {
  id: 'id',
  fecha: 'fecha',
  nombre: 'nombre',
  ambito: 'ambito',
  esAnual: 'esAnual',
  activa: 'activa',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompensacionFestivoScalarFieldEnum = {
  id: 'id',
  empleadoId: 'empleadoId',
  jornadaId: 'jornadaId',
  fiestaId: 'fiestaId',
  tipo: 'tipo',
  valor: 'valor',
  motivo: 'motivo',
  createdAt: 'createdAt'
};

exports.Prisma.ModuloFormacionScalarFieldEnum = {
  id: 'id',
  titulo: 'titulo',
  descripcion: 'descripcion',
  fechaInicio: 'fechaInicio',
  fechaFin: 'fechaFin',
  duracionEstimada: 'duracionEstimada',
  activo: 'activo',
  creadoPorId: 'creadoPorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TemaFormacionScalarFieldEnum = {
  id: 'id',
  moduloId: 'moduloId',
  orden: 'orden',
  titulo: 'titulo',
  contenido: 'contenido',
  tipo: 'tipo',
  resourceUrl: 'resourceUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PreguntaFormacionScalarFieldEnum = {
  id: 'id',
  moduloId: 'moduloId',
  texto: 'texto',
  opcionA: 'opcionA',
  opcionB: 'opcionB',
  opcionC: 'opcionC',
  correcta: 'correcta',
  puntos: 'puntos',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ResultadoFormacionScalarFieldEnum = {
  id: 'id',
  empleadoId: 'empleadoId',
  moduloId: 'moduloId',
  puntuacion: 'puntuacion',
  aprobado: 'aprobado',
  intentos: 'intentos',
  completadoAl: 'completadoAl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConceptoNominaScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  nombre: 'nombre',
  descripcion: 'descripcion',
  active: 'active'
};

exports.Prisma.TarifaNominaScalarFieldEnum = {
  id: 'id',
  conceptoId: 'conceptoId',
  rol: 'rol',
  empleadoId: 'empleadoId',
  valor: 'valor',
  fechaInicio: 'fechaInicio',
  fechaFin: 'fechaFin',
  activo: 'activo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NominaMesScalarFieldEnum = {
  id: 'id',
  empleadoId: 'empleadoId',
  year: 'year',
  month: 'month',
  estado: 'estado',
  totalBruto: 'totalBruto',
  totalVariables: 'totalVariables',
  cerradaPorId: 'cerradaPorId',
  fechaCierre: 'fechaCierre',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NominaLineaScalarFieldEnum = {
  id: 'id',
  nominaId: 'nominaId',
  conceptoCodigo: 'conceptoCodigo',
  conceptoNombre: 'conceptoNombre',
  cantidad: 'cantidad',
  rate: 'rate',
  importe: 'importe',
  orden: 'orden',
  override: 'override',
  notas: 'notas',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt'
};

exports.Prisma.ComercialLitrosScalarFieldEnum = {
  id: 'id',
  empleadoId: 'empleadoId',
  year: 'year',
  month: 'month',
  litros: 'litros',
  notas: 'notas',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EnvioGestoriaScalarFieldEnum = {
  id: 'id',
  year: 'year',
  month: 'month',
  fechaEnvio: 'fechaEnvio',
  usuarioId: 'usuarioId',
  urlPdfConsolidado: 'urlPdfConsolidado',
  status: 'status'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Empleado: 'Empleado',
  Camion: 'Camion',
  JornadaLaboral: 'JornadaLaboral',
  UsoCamion: 'UsoCamion',
  Descarga: 'Descarga',
  Ausencia: 'Ausencia',
  Tarea: 'Tarea',
  TareaHistorial: 'TareaHistorial',
  TareaAdjunto: 'TareaAdjunto',
  MantenimientoProximo: 'MantenimientoProximo',
  MantenimientoRealizado: 'MantenimientoRealizado',
  Auditoria: 'Auditoria',
  Notificacion: 'Notificacion',
  FiestaLocal: 'FiestaLocal',
  CompensacionFestivo: 'CompensacionFestivo',
  ModuloFormacion: 'ModuloFormacion',
  TemaFormacion: 'TemaFormacion',
  PreguntaFormacion: 'PreguntaFormacion',
  ResultadoFormacion: 'ResultadoFormacion',
  ConceptoNomina: 'ConceptoNomina',
  TarifaNomina: 'TarifaNomina',
  NominaMes: 'NominaMes',
  NominaLinea: 'NominaLinea',
  ComercialLitros: 'ComercialLitros',
  EnvioGestoria: 'EnvioGestoria'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
