/**
 * VNNOX / NovaCloud Open Platform API Client
 * 
 * API oficial v2: https://open-eu.vnnox.com (región EU)
 * 
 * Autenticación por headers:
 *   AppKey    — clave pública de la aplicación
 *   Nonce     — cadena alfanumérica aleatoria de 8‑64 caracteres (SIN guiones)
 *   CurTime   — UNIX timestamp en segundos
 *   CheckSum  — SHA256(AppSecret + Nonce + CurTime), hexadecimal lowercase
 *
 * Endpoints oficiales v2 usados:
 *   GET  /v2/player/list
 *   POST /v2/player/current/online-status
 *   POST /v2/player/program/normal
 *   POST /v2/player/program/over-specification-check
 *   POST /v2/player/scheduled-control/screen-status
 *   POST /v2/player/scheduled-control/brightness
 */

import crypto from 'crypto';

// ============================================================
// Types
// ============================================================

export interface VnnoxAuthHeaders {
  AppKey: string;
  Nonce: string;
  CurTime: string;
  CheckSum: string;
  'Content-Type': string;
}

export interface VnnoxConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
}

export interface VnnoxPlayer {
  playerId: string;
  playerName: string;
  width?: number;
  height?: number;
  rotation?: number;
  status?: string;
  lastOnlineTime?: string;
  model?: string;
  firmwareVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface VnnoxPlayerDetail extends VnnoxPlayer {
  resolutionWidth: number;
  resolutionHeight: number;
  orientation: string;
  isOnline: boolean;
  screenStatus?: string;
  brightness?: number;
  volume?: number;
  ipAddress?: string;
  macAddress?: string;
}

/** Payload para publicar un programa normal (MVP 1 = solo IMAGE) */
export interface VnnoxProgramPayload {
  name: string;
  playerId: string;
  width: number;
  height: number;
  layers: VnnoxProgramLayer[];
  duration?: number; // seconds
}

export interface VnnoxProgramLayer {
  type: 'IMAGE';           // MVP 1: solo imágenes
  url: string;             // HTTPS público, no localhost
  width: number;
  height: number;
  x?: number;
  y?: number;
  duration?: number;       // segundos que se muestra la imagen
  md5?: string;            // MD5 hex del archivo
  size?: number;           // tamaño en bytes del archivo
}

export interface VnnoxSchedulePayload {
  playerId: string;
  entries: Array<{
    startTime: string;     // HH:mm
    endTime: string;       // HH:mm
    status?: 'ON' | 'OFF';
    brightness?: number;   // 0-100
    daysOfWeek?: number[]; // 0=Sun … 6=Sat
  }>;
}

export interface VnnoxApiResponse<T = unknown> {
  success: boolean;
  code?: number;
  message?: string;
  data?: T;
  rawResponse?: unknown;
}

export interface OverSpecResult {
  pass: boolean;
  details?: unknown;
}

// ============================================================
// Error Types
// ============================================================

export class VnnoxError extends Error {
  public code: string;
  public httpStatus?: number;
  public apiResponse?: unknown;

  constructor(message: string, code: string, httpStatus?: number, apiResponse?: unknown) {
    super(message);
    this.name = 'VnnoxError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.apiResponse = apiResponse;
  }
}

export class VnnoxAuthError extends VnnoxError {
  constructor(message: string, apiResponse?: unknown) {
    super(message, 'AUTH_ERROR', 401, apiResponse);
    this.name = 'VnnoxAuthError';
  }
}

export class VnnoxPermissionError extends VnnoxError {
  constructor(message: string, apiResponse?: unknown) {
    super(message, 'PERMISSION_ERROR', 403, apiResponse);
    this.name = 'VnnoxPermissionError';
  }
}

export class VnnoxTimeSkewError extends VnnoxError {
  constructor(message: string) {
    super(message, 'TIME_SKEW_ERROR');
    this.name = 'VnnoxTimeSkewError';
  }
}

export class VnnoxConnectionError extends VnnoxError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'VnnoxConnectionError';
  }
}

// ============================================================
// Helper functions
// ============================================================

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Genera un Nonce alfanumérico de `length` caracteres (8–64).
 * NO usa UUID v4 (los guiones están prohibidos por la API).
 */
export function generateNonce(length: number = 32): string {
  if (length < 8 || length > 64) {
    throw new Error('Nonce length must be between 8 and 64');
  }
  const bytes = crypto.randomBytes(length);
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  }
  return nonce;
}

export function getCurTime(): string {
  return Math.floor(Date.now() / 1000).toString();
}

/**
 * CheckSum = SHA256(AppSecret + Nonce + CurTime)
 * Resultado: 64 caracteres hex lowercase
 */
export function generateCheckSum(appSecret: string, nonce: string, curTime: string): string {
  const raw = appSecret + nonce + curTime;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Construye los headers de autenticación para la Open Platform VNNOX */
export function buildAuthHeaders(config: VnnoxConfig): VnnoxAuthHeaders {
  const nonce = generateNonce(32);
  const curTime = getCurTime();
  const checkSum = generateCheckSum(config.appSecret, nonce, curTime);

  return {
    AppKey: config.appKey,
    Nonce: nonce,
    CurTime: curTime,
    CheckSum: checkSum,
    'Content-Type': 'application/json',
  };
}

/** Redacta secretos de objetos para logging seguro */
function sanitizeForLog(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForLog);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lk = key.toLowerCase();
    if (lk.includes('secret') || lk.includes('password') || lk.includes('checksum') || lk.includes('token')) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = typeof value === 'object' ? sanitizeForLog(value) : value;
    }
  }
  return sanitized;
}

// ============================================================
// VNNOX Client
// ============================================================

const DEFAULT_TIMEOUT = 15000; // 15 s
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export class VnnoxClient {
  private config: VnnoxConfig;

  constructor(config?: VnnoxConfig) {
    this.config = config || {
      baseUrl: process.env.VNNOX_BASE_URL || 'https://open-eu.vnnox.com',
      appKey: process.env.VNNOX_APP_KEY || '',
      appSecret: process.env.VNNOX_APP_SECRET || '',
    };
  }

  // ------ internal ------

  private validateConfig(): void {
    if (!this.config.appKey)    throw new VnnoxError('VNNOX_APP_KEY no está configurado', 'CONFIG_MISSING');
    if (!this.config.appSecret) throw new VnnoxError('VNNOX_APP_SECRET no está configurado', 'CONFIG_MISSING');
    if (!this.config.baseUrl)   throw new VnnoxError('VNNOX_BASE_URL no está configurado', 'CONFIG_MISSING');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    retries: number = MAX_RETRIES
  ): Promise<VnnoxApiResponse<T>> {
    this.validateConfig();

    const url = `${this.config.baseUrl}${path}`;
    const headers = buildAuthHeaders(this.config);

    console.log(`[VNNOX] ${method} ${path}`, {
      headers: sanitizeForLog(headers),
      body: body ? sanitizeForLog(body) : undefined,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers: headers as unknown as HeadersInit,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      let responseData: unknown;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

      console.log(`[VNNOX] Response ${response.status}`, {
        path,
        status: response.status,
        dataPreview: typeof responseData === 'string'
          ? responseData.substring(0, 200)
          : JSON.stringify(sanitizeForLog(responseData)).substring(0, 500),
      });

      // --- Map HTTP errors ---
      if (response.status === 401) {
        throw new VnnoxAuthError(
          'Credenciales VNNOX inválidas o CheckSum incorrecto. Verifica AppKey/AppSecret y que el reloj del servidor esté sincronizado.',
          responseData,
        );
      }

      if (response.status === 403) {
        throw new VnnoxPermissionError(
          'Sin permisos suficientes en la cuenta VNNOX para esta operación.',
          responseData,
        );
      }

      if (!response.ok) {
        const errMsg = typeof responseData === 'object' && responseData !== null
          ? JSON.stringify(responseData) : String(responseData);

        if (/time|expired|curtime/i.test(errMsg)) {
          throw new VnnoxTimeSkewError(
            `Posible desfase horario del servidor. CurTime enviado: ${headers.CurTime}. Resp: ${errMsg}`,
          );
        }

        throw new VnnoxError(`Error API VNNOX: ${response.status} — ${errMsg}`, 'API_ERROR', response.status, responseData);
      }

      // --- Interpret body-level result code ---
      const apiData = responseData as Record<string, unknown>;
      const apiSuccess = apiData?.code === 0 || apiData?.code === 200 || response.ok;

      return {
        success: apiSuccess,
        code: typeof apiData?.code === 'number' ? apiData.code : response.status,
        message: typeof apiData?.msg === 'string' ? apiData.msg : (typeof apiData?.message === 'string' ? apiData.message : undefined),
        data: apiData as T,
        rawResponse: responseData,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof VnnoxError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (retries > 0) {
          console.warn(`[VNNOX] Timeout en ${path}, reintentando (${retries} restantes)…`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          return this.request<T>(method, path, body, retries - 1);
        }
        throw new VnnoxConnectionError(`Timeout al conectar con VNNOX (${DEFAULT_TIMEOUT}ms): ${path}`);
      }

      if (retries > 0 && error instanceof TypeError) {
        console.warn(`[VNNOX] Error de red en ${path}, reintentando (${retries} restantes)…`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        return this.request<T>(method, path, body, retries - 1);
      }

      throw new VnnoxConnectionError(`Error de conexión con VNNOX: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================
  // Public API — v2 endpoints oficiales
  // ============================================================

  /**
   * GET /v2/player/list
   * Devuelve la lista de players de la cuenta.
   */
  async getPlayers(): Promise<VnnoxApiResponse<VnnoxPlayer[]>> {
    const result = await this.request<unknown>('GET', '/v2/player/list');

    const rawData = result.data as any;
    let players: VnnoxPlayer[] = [];

    // VNNOX v2 API devuelve { pageInfo, total, rows: [...] }
    if (rawData?.rows && Array.isArray(rawData.rows)) {
      players = rawData.rows.map(VnnoxClient.normalizePlayer);
    } else if (Array.isArray(rawData)) {
      players = rawData.map(VnnoxClient.normalizePlayer);
    } else if (rawData?.list && Array.isArray(rawData.list)) {
      players = rawData.list.map(VnnoxClient.normalizePlayer);
    } else if (rawData?.data && Array.isArray(rawData.data)) {
      players = rawData.data.map(VnnoxClient.normalizePlayer);
    }

    return { ...result, data: players };
  }

  /**
   * POST /v2/player/current/online-status
   * Consulta el estado online/offline + resolución de un player.
   * Body: { playerIds: [id] }
   */
  async getPlayerOnlineStatus(playerIds: string[]): Promise<VnnoxApiResponse<VnnoxPlayerDetail[]>> {
    const result = await this.request<unknown>('POST', '/v2/player/current/online-status', {
      playerIds,
    });

    const rawData = result.data as any;
    const items: any[] = Array.isArray(rawData) ? rawData
      : (rawData?.list ?? rawData?.data ?? []);

    const details: VnnoxPlayerDetail[] = items.map((raw: any) => ({
      playerId: String(raw.playerId ?? raw.id ?? ''),
      playerName: raw.playerName ?? raw.name ?? 'Desconocido',
      resolutionWidth: raw.width ?? raw.terminalWidth ?? raw.resolutionWidth ?? 0,
      resolutionHeight: raw.height ?? raw.terminalHeight ?? raw.resolutionHeight ?? 0,
      orientation: (raw.rotation === 90 || raw.rotation === 270) ? 'VERTICAL' : 'HORIZONTAL',
      isOnline: raw.onlineStatus === 1 || raw.status === 1 || raw.status === 'ONLINE' || raw.online === true,
      screenStatus: raw.screenStatus,
      brightness: raw.brightness,
      volume: raw.volume,
      ipAddress: raw.ipAddress,
      macAddress: raw.macAddress,
      status: raw.onlineStatus === 1 || raw.online === true ? 'ONLINE' : 'OFFLINE',
      metadata: raw,
    }));

    return { ...result, data: details };
  }

  /**
   * Combina getPlayers + getPlayerOnlineStatus para obtener toda la info de un player.
   */
  async getPlayerFullInfo(playerId: string): Promise<VnnoxApiResponse<VnnoxPlayerDetail>> {
    // Primero consultamos la lista para obtener el nombre/resolución base
    const listResult = await this.getPlayers();
    const playerFromList = listResult.data?.find(p => p.playerId === playerId);

    // Luego online-status para estado real
    const statusResult = await this.getPlayerOnlineStatus([playerId]);
    const statusInfo = statusResult.data?.[0];

    if (!playerFromList && !statusInfo) {
      return {
        success: false,
        message: `Player ${playerId} no encontrado en la cuenta VNNOX`,
      };
    }

    const detail: VnnoxPlayerDetail = {
      playerId,
      playerName: statusInfo?.playerName || playerFromList?.playerName || 'Desconocido',
      resolutionWidth: statusInfo?.resolutionWidth || playerFromList?.width || 0,
      resolutionHeight: statusInfo?.resolutionHeight || playerFromList?.height || 0,
      orientation: statusInfo?.orientation || ((playerFromList?.rotation === 90 || playerFromList?.rotation === 270) ? 'VERTICAL' : 'HORIZONTAL'),
      isOnline: statusInfo?.isOnline ?? false,
      width: playerFromList?.width,
      height: playerFromList?.height,
      rotation: playerFromList?.rotation,
      status: statusInfo?.isOnline ? 'ONLINE' : 'OFFLINE',
      metadata: { list: playerFromList?.metadata, status: statusInfo?.metadata },
    };

    return { success: true, data: detail };
  }

  /**
   * POST /v2/player/program/over-specification-check
   * Valida que el contenido no exceda las capacidades del player
   * ANTES de publicar. Obligatorio en el flujo.
   */
  async overSpecificationCheck(payload: {
    playerId: string;
    width: number;
    height: number;
    fileSize?: number;
  }): Promise<VnnoxApiResponse<OverSpecResult>> {
    const result = await this.request<unknown>('POST', '/v2/player/program/over-specification-check', {
      playerId: payload.playerId,
      width: payload.width,
      height: payload.height,
      fileSize: payload.fileSize,
    });

    const raw = result.data as any;
    const pass = result.success && (raw?.pass !== false);

    return {
      ...result,
      data: { pass, details: raw },
    };
  }

  /**
   * POST /v2/player/program/normal
   * Publica un programa normal de tipo IMAGE al player.
   * (MVP 1: solo imágenes, vídeo queda para fase posterior.)
   */
  async publishNormalProgram(payload: VnnoxProgramPayload): Promise<VnnoxApiResponse> {
    // Build schedule: all day, every day, for 10 years
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endYear = now.getFullYear() + 10;
    const endDate = `${endYear}-12-31`;

    const programBody = {
      playerIds: [payload.playerId],
      schedule: {
        startDate,
        endDate,
        plans: [
          {
            weekDays: [1, 2, 3, 4, 5, 6, 7],
            startTime: '00:00:00',
            endTime: '23:59:59',
          },
        ],
      },
      pages: payload.layers.map((layer, idx) => ({
        name: `${payload.name}-page-${idx + 1}`,
        repeatCount: 1,
        widgets: [
          {
            zIndex: 1,
            type: 'PICTURE',
            url: layer.url,
            md5: layer.md5 || '',
            size: layer.size || 0,
            duration: (layer.duration ?? 10) * 1000, // API expects milliseconds
            layout: {
              x: '0%',
              y: '0%',
              width: '100%',
              height: '100%',
            },
            inAnimation: {
              type: 'NONE',
              duration: 1000,
            },
          },
        ],
      })),
    };

    return this.request('POST', '/v2/player/program/normal', programBody);
  }

  /**
   * POST /v2/player/scheduled-control/screen-status
   * Programa el encendido/apagado de la pantalla.
   */
  async scheduleScreenStatus(payload: VnnoxSchedulePayload): Promise<VnnoxApiResponse> {
    const body = {
      playerIds: [payload.playerId],
      scheduleItems: payload.entries.map(e => ({
        startTime: e.startTime,
        endTime: e.endTime,
        status: e.status ?? 'ON',
        weekDays: e.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
      })),
    };
    return this.request('POST', '/v2/player/scheduled-control/screen-status', body);
  }

  /**
   * POST /v2/player/scheduled-control/brightness
   * Programa el brillo de la pantalla por franja horaria.
   */
  async scheduleBrightness(payload: VnnoxSchedulePayload): Promise<VnnoxApiResponse> {
    const body = {
      playerIds: [payload.playerId],
      brightnessItems: payload.entries.map(e => ({
        startTime: e.startTime,
        endTime: e.endTime,
        brightness: e.brightness ?? 100,
        weekDays: e.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
      })),
    };
    return this.request('POST', '/v2/player/scheduled-control/brightness', body);
  }

  /**
   * Test de conexión → usa GET /v2/player/list con interpretación de resultado.
   */
  async testConnection(): Promise<VnnoxApiResponse> {
    try {
      const result = await this.request<unknown>('GET', '/v2/player/list');
      return {
        success: true,
        message: 'Conexión exitosa con VNNOX',
        data: { timestamp: new Date().toISOString(), rawCode: result.code },
        rawResponse: result.rawResponse,
      };
    } catch (error) {
      if (error instanceof VnnoxError) {
        return { success: false, code: error.httpStatus, message: error.message, data: { errorCode: error.code } };
      }
      return { success: false, message: error instanceof Error ? error.message : 'Error desconocido', data: { errorCode: 'UNKNOWN' } };
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private static normalizePlayer(raw: any): VnnoxPlayer {
    return {
      playerId: String(raw.playerId ?? raw.id ?? raw.terminalId ?? ''),
      playerName: raw.playerName ?? raw.name ?? raw.terminalName ?? 'Sin nombre',
      width: parseInt(raw.width ?? raw.terminalWidth ?? '0', 10) || undefined,
      height: parseInt(raw.height ?? raw.terminalHeight ?? '0', 10) || undefined,
      rotation: raw.rotation,
      status: (raw.onlineStatus === 1 || raw.status === 1 || raw.online === true) ? 'ONLINE' : 'OFFLINE',
      lastOnlineTime: raw.lastOnlineTime ?? raw.lastHeartbeatTime,
      model: raw.productName ?? raw.model ?? raw.terminalModel,
      firmwareVersion: raw.firmwareVersion ?? raw.version ?? raw.osVersion,
      metadata: raw,
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let _defaultClient: VnnoxClient | null = null;

export function getVnnoxClient(config?: VnnoxConfig): VnnoxClient {
  if (config) return new VnnoxClient(config);
  if (!_defaultClient) _defaultClient = new VnnoxClient();
  return _defaultClient;
}

export function resetVnnoxClient(): void {
  _defaultClient = null;
}
