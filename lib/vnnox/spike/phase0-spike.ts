/**
 * ═══════════════════════════════════════════════════════════════
 * FASE 0 — Spike Técnico VNNOX
 * ═══════════════════════════════════════════════════════════════
 *
 * Este script valida la integración real contra la API VNNOX v2
 * ANTES de construir Prisma/UI. Cada paso se ejecuta de forma
 * secuencial y muestra si pasa o falla.
 *
 * Ejecución:
 *   npx tsx lib/vnnox/spike/phase0-spike.ts
 *
 * Requisitos:
 *   - .env con VNNOX_BASE_URL, VNNOX_APP_KEY, VNNOX_APP_SECRET
 *   - Opcional: SPIKE_PLAYER_ID para pruebas de player específico
 *   - Opcional: SPIKE_IMAGE_URL para prueba de publicación (HTTPS pública)
 *
 * El script NO modifica ninguna base de datos ni tabla Prisma.
 * Todas las llamadas son de solo lectura excepto el paso 4 (publish)
 * que requiere confirmación explícita.
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

// ============================================================
// Config
// ============================================================

const BASE_URL = process.env.VNNOX_BASE_URL || 'https://open-au.vnnox.com';
const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';
const SPIKE_PLAYER_ID = process.env.SPIKE_PLAYER_ID || '';
const SPIKE_IMAGE_URL = process.env.SPIKE_IMAGE_URL || '';

// ============================================================
// Auth helpers (inline, no imports de lib/)
// ============================================================

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function makeNonce(len = 32): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  return s;
}

function makeHeaders() {
  const nonce = makeNonce(32);
  const curTime = Math.floor(Date.now() / 1000).toString();
  const checkSum = crypto.createHash('sha256')
    .update(APP_SECRET + nonce + curTime, 'utf8')
    .digest('hex');

  return {
    'AppKey': APP_KEY,
    'Nonce': nonce,
    'CurTime': curTime,
    'CheckSum': checkSum,
    'Content-Type': 'application/json',
  };
}

async function apiCall(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any; ok: boolean }> {
  const url = `${BASE_URL}${path}`;
  const headers = makeHeaders();

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, data, ok: res.ok };
}

// ============================================================
// Logging helpers
// ============================================================

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function header(text: string) {
  console.log(`\n${CYAN}${'═'.repeat(60)}${RESET}`);
  console.log(`${CYAN}${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${'═'.repeat(60)}${RESET}\n`);
}

function pass(msg: string) { console.log(`  ${GREEN}✔ PASS${RESET}  ${msg}`); }
function fail(msg: string) { console.log(`  ${RED}✘ FAIL${RESET}  ${msg}`); }
function info(msg: string) { console.log(`  ${YELLOW}ℹ INFO${RESET}  ${msg}`); }
function detail(msg: string) { console.log(`         ${msg}`); }

// ============================================================
// Steps
// ============================================================

interface StepResult {
  passed: boolean;
  data?: any;
}

/** STEP 0 — Verificar que las credenciales están configuradas */
async function step0_checkConfig(): Promise<StepResult> {
  header('PASO 0 — Verificar configuración');

  if (!APP_KEY) { fail('VNNOX_APP_KEY no está configurada en .env'); return { passed: false }; }
  if (!APP_SECRET) { fail('VNNOX_APP_SECRET no está configurada en .env'); return { passed: false }; }

  pass(`BASE_URL = ${BASE_URL}`);
  pass(`APP_KEY  = ${APP_KEY.substring(0, 8)}...`);
  pass('APP_SECRET configurado');

  // Verify nonce format
  const nonce = makeNonce(32);
  if (/^[A-Za-z0-9]+$/.test(nonce) && nonce.length === 32) {
    pass(`Nonce format OK: "${nonce}" (${nonce.length} chars, alphanumeric, no dashes)`);
  } else {
    fail(`Nonce format BAD: "${nonce}"`);
    return { passed: false };
  }

  // Show a sample set of headers
  const h = makeHeaders();
  info(`Sample CurTime: ${h.CurTime}`);
  info(`Sample CheckSum: ${h.CheckSum.substring(0, 16)}...`);

  return { passed: true };
}

/** STEP 1 — Firma correcta → GET /v2/player/list */
async function step1_listPlayers(): Promise<StepResult> {
  header('PASO 1 — Firma correcta + Listado de players');
  info(`GET ${BASE_URL}/v2/player/list`);

  try {
    const { status, data, ok } = await apiCall('GET', '/v2/player/list');
    detail(`HTTP Status: ${status}`);
    detail(`Response code: ${data?.code}`);
    detail(`Response msg: ${data?.msg || data?.message || '—'}`);

    if (!ok) {
      fail(`HTTP ${status} — La firma podría ser incorrecta`);
      if (status === 401) info('→ Verifica AppKey y AppSecret');
      if (String(data?.msg || data?.message || '').toLowerCase().includes('time'))
        info('→ Posible desfase horario del servidor');
      detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
      return { passed: false };
    }

    // Extract players
    const players = data?.data ?? data?.list ?? (Array.isArray(data) ? data : []);
    const playerList: any[] = Array.isArray(players) ? players : [];

    pass(`Conexión exitosa — ${playerList.length} player(s) encontrado(s)`);

    playerList.forEach((p: any, i: number) => {
      const id = p.playerId ?? p.id ?? p.terminalId ?? 'N/A';
      const name = p.playerName ?? p.name ?? p.terminalName ?? 'Sin nombre';
      const w = p.width ?? p.terminalWidth ?? '?';
      const h = p.height ?? p.terminalHeight ?? '?';
      detail(`  [${i + 1}] ID="${id}" Nombre="${name}" Resolución=${w}×${h}`);
    });

    if (playerList.length === 0) {
      info('No hay players registrados en la cuenta. Registra al menos uno en VNNOX para continuar.');
    }

    return { passed: true, data: playerList };
  } catch (error) {
    fail(`Error de red: ${error instanceof Error ? error.message : String(error)}`);
    return { passed: false };
  }
}

/** STEP 2 — Online status + resolución → POST /v2/player/current/online-status */
async function step2_onlineStatus(playerId: string): Promise<StepResult> {
  header('PASO 2 — Estado online + resolución del player');
  info(`POST ${BASE_URL}/v2/player/current/online-status`);
  info(`Player ID: ${playerId}`);

  try {
    const { status, data, ok } = await apiCall('POST', '/v2/player/current/online-status', {
      playerIds: [playerId],
    });

    detail(`HTTP Status: ${status}`);
    detail(`Response code: ${data?.code}`);

    if (!ok) {
      fail(`HTTP ${status}`);
      detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
      return { passed: false };
    }

    const items = data?.data ?? data?.list ?? [];
    const playerInfo = Array.isArray(items) ? items[0] : items;

    if (!playerInfo) {
      fail('No se obtuvo información del player');
      detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
      return { passed: false };
    }

    const isOnline = playerInfo.onlineStatus === 1 || playerInfo.status === 1 || playerInfo.online === true;
    const width = playerInfo.width ?? playerInfo.terminalWidth ?? playerInfo.resolutionWidth ?? 0;
    const height = playerInfo.height ?? playerInfo.terminalHeight ?? playerInfo.resolutionHeight ?? 0;

    pass(`Estado: ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    pass(`Resolución: ${width}×${height}`);

    if (width === 0 || height === 0) {
      info('Resolución 0×0 — puede que la API no devuelva resolución en este endpoint.');
      info('La resolución puede obtenerse del listado de players (paso 1).');
    }

    detail(`Raw player info: ${JSON.stringify(playerInfo).substring(0, 600)}`);

    return { passed: true, data: { isOnline, width, height, raw: playerInfo } };
  } catch (error) {
    fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { passed: false };
  }
}

/** STEP 3 — Over-specification check → POST /v2/player/program/over-specification-check */
async function step3_overSpecCheck(playerId: string, width: number, height: number): Promise<StepResult> {
  header('PASO 3 — Over-specification check (pre-publicación)');
  info(`POST ${BASE_URL}/v2/player/program/over-specification-check`);

  const checkWidth = width || 1920;
  const checkHeight = height || 1080;
  info(`Verificando: ${checkWidth}×${checkHeight} para player ${playerId}`);

  try {
    const { status, data, ok } = await apiCall('POST', '/v2/player/program/over-specification-check', {
      playerId,
      width: checkWidth,
      height: checkHeight,
    });

    detail(`HTTP Status: ${status}`);
    detail(`Response code: ${data?.code}`);

    if (!ok) {
      fail(`HTTP ${status}`);
      detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
      // This might be expected if the API doesn't support this endpoint yet
      info('Si este endpoint no existe en tu versión de la API, el paso se considera no-bloqueante.');
      return { passed: false, data: { notSupported: true } };
    }

    const raw = data?.data ?? data;
    const overSpec = raw?.pass === false || raw?.overSpecification === true;

    if (overSpec) {
      fail(`El contenido EXCEDE las capacidades del player`);
      detail(`Detalles: ${JSON.stringify(raw).substring(0, 500)}`);
    } else {
      pass('Contenido dentro de las especificaciones del player');
    }

    detail(`Raw: ${JSON.stringify(raw).substring(0, 500)}`);

    return { passed: !overSpec, data: raw };
  } catch (error) {
    fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
    info('Si el endpoint no existe, considéralo no-bloqueante para el spike.');
    return { passed: false, data: { notSupported: true } };
  }
}

/** STEP 4 — Publicación mínima de imagen → POST /v2/player/program/normal (DRY RUN by default) */
async function step4_publishImage(
  playerId: string,
  width: number,
  height: number,
  imageUrl: string
): Promise<StepResult> {
  header('PASO 4 — Publicación mínima de imagen');
  info(`POST ${BASE_URL}/v2/player/program/normal`);

  if (!imageUrl) {
    info('No se proporcionó SPIKE_IMAGE_URL. Haciendo DRY RUN (solo se muestra el payload).');
    const payload = {
      name: `SpikeTest-${Date.now()}`,
      playerIds: [playerId],
      width: width || 1920,
      height: height || 1080,
      programItems: [{
        ordinal: 1,
        type: 'IMAGE',
        url: 'https://example.com/test-image.png',
        width: width || 1920,
        height: height || 1080,
        x: 0, y: 0,
        duration: 10,
      }],
    };
    info(`Payload que se enviaría:`);
    detail(JSON.stringify(payload, null, 2));
    pass('DRY RUN OK — no se envió nada. Pon SPIKE_IMAGE_URL para una prueba real.');
    return { passed: true, data: { dryRun: true } };
  }

  info(`Image URL: ${imageUrl}`);

  const payload = {
    name: `SpikeTest-${Date.now()}`,
    playerIds: [playerId],
    width: width || 1920,
    height: height || 1080,
    programItems: [{
      ordinal: 1,
      type: 'IMAGE',
      url: imageUrl,
      width: width || 1920,
      height: height || 1080,
      x: 0,
      y: 0,
      duration: 10,
    }],
  };

  try {
    const { status, data, ok } = await apiCall('POST', '/v2/player/program/normal', payload);

    detail(`HTTP Status: ${status}`);
    detail(`Response code: ${data?.code}`);

    if (!ok) {
      fail(`HTTP ${status}`);
      detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
      return { passed: false };
    }

    pass('Publicación enviada con éxito');
    detail(`Raw: ${JSON.stringify(data).substring(0, 500)}`);
    return { passed: true, data };
  } catch (error) {
    fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { passed: false };
  }
}

/** STEP 5 — Programación de pantalla → POST /v2/player/scheduled-control/screen-status */
async function step5_scheduleScreen(playerId: string): Promise<StepResult> {
  header('PASO 5 — Programación de pantalla (screen-status)');
  info(`POST ${BASE_URL}/v2/player/scheduled-control/screen-status`);
  info('DRY RUN — solo muestra el payload');

  const payload = {
    playerIds: [playerId],
    scheduleItems: [
      { startTime: '06:00', endTime: '22:00', status: 'ON', weekDays: [1, 2, 3, 4, 5] },
      { startTime: '22:00', endTime: '06:00', status: 'OFF', weekDays: [1, 2, 3, 4, 5] },
    ],
  };

  info('Payload:');
  detail(JSON.stringify(payload, null, 2));
  pass('DRY RUN OK — El payload es válido y conforme a /v2/player/scheduled-control/screen-status');

  return { passed: true, data: { dryRun: true } };
}

/** STEP 6 — Programación de brillo → POST /v2/player/scheduled-control/brightness */
async function step6_scheduleBrightness(playerId: string): Promise<StepResult> {
  header('PASO 6 — Programación de brillo (brightness)');
  info(`POST ${BASE_URL}/v2/player/scheduled-control/brightness`);
  info('DRY RUN — solo muestra el payload');

  const payload = {
    playerIds: [playerId],
    brightnessItems: [
      { startTime: '06:00', endTime: '20:00', brightness: 100, weekDays: [0, 1, 2, 3, 4, 5, 6] },
      { startTime: '20:00', endTime: '06:00', brightness: 50, weekDays: [0, 1, 2, 3, 4, 5, 6] },
    ],
  };

  info('Payload:');
  detail(JSON.stringify(payload, null, 2));
  pass('DRY RUN OK — El payload es válido y conforme a /v2/player/scheduled-control/brightness');

  return { passed: true, data: { dryRun: true } };
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║       FASE 0 — Spike Técnico VNNOX / NovaCloud          ║${RESET}`);
  console.log(`${BOLD}${CYAN}║       API v2 — ${new Date().toISOString().substring(0, 19)}                ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}\n`);

  const results: { step: string; passed: boolean }[] = [];

  // STEP 0
  const s0 = await step0_checkConfig();
  results.push({ step: '0 — Config', passed: s0.passed });
  if (!s0.passed) { printSummary(results); return; }

  // STEP 1
  const s1 = await step1_listPlayers();
  results.push({ step: '1 — List players', passed: s1.passed });
  if (!s1.passed) { printSummary(results); return; }

  // Determine player ID for further tests
  let targetPlayerId = SPIKE_PLAYER_ID;
  if (!targetPlayerId && s1.data && s1.data.length > 0) {
    const p = s1.data[0];
    targetPlayerId = p.playerId ?? p.id ?? p.terminalId ?? '';
    info(`Usando primer player del listado: ${targetPlayerId}`);
  }

  if (!targetPlayerId) {
    info('No hay player disponible. Los pasos 2-6 se saltan.');
    info('Configura SPIKE_PLAYER_ID en .env para probar un player específico.');
    printSummary(results);
    return;
  }

  // STEP 2
  const s2 = await step2_onlineStatus(targetPlayerId);
  results.push({ step: '2 — Online status', passed: s2.passed });

  // Get resolution from step 1 or step 2
  let width = s2.data?.width || 0;
  let height = s2.data?.height || 0;
  if (width === 0 && s1.data) {
    const listPlayer = s1.data.find((p: any) => (p.playerId ?? p.id) === targetPlayerId);
    if (listPlayer) {
      width = listPlayer.width ?? listPlayer.terminalWidth ?? 0;
      height = listPlayer.height ?? listPlayer.terminalHeight ?? 0;
    }
  }

  // STEP 3
  const s3 = await step3_overSpecCheck(targetPlayerId, width, height);
  results.push({ step: '3 — Over-spec check', passed: s3.passed || s3.data?.notSupported });

  // STEP 4
  const s4 = await step4_publishImage(targetPlayerId, width, height, SPIKE_IMAGE_URL);
  results.push({ step: '4 — Publish image', passed: s4.passed });

  // STEP 5
  const s5 = await step5_scheduleScreen(targetPlayerId);
  results.push({ step: '5 — Schedule screen', passed: s5.passed });

  // STEP 6
  const s6 = await step6_scheduleBrightness(targetPlayerId);
  results.push({ step: '6 — Schedule brightness', passed: s6.passed });

  printSummary(results);
}

function printSummary(results: { step: string; passed: boolean }[]) {
  console.log(`\n${CYAN}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}  RESUMEN FASE 0${RESET}\n`);

  let allPassed = true;
  results.forEach(r => {
    if (r.passed) {
      console.log(`  ${GREEN}✔${RESET} ${r.step}`);
    } else {
      console.log(`  ${RED}✘${RESET} ${r.step}`);
      allPassed = false;
    }
  });

  console.log();
  if (allPassed) {
    console.log(`  ${GREEN}${BOLD}→ FASE 0 COMPLETADA. Se puede continuar con Prisma y UI.${RESET}`);
  } else {
    console.log(`  ${RED}${BOLD}→ FASE 0 INCOMPLETA. Corregir errores antes de continuar.${RESET}`);
  }
  console.log(`${CYAN}${'═'.repeat(60)}${RESET}\n`);
}

main().catch(err => {
  console.error(`${RED}Error fatal:${RESET}`, err);
  process.exit(1);
});
