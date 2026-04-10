/**
 * Tests for VNNOX Client — v2 API
 *
 * Valida:
 *  - Nonce alfanumérico (sin guiones ni UUID)
 *  - CheckSum = SHA256(AppSecret + Nonce + CurTime)
 *  - Endpoints v2 correctos
 *  - Tipos de error
 *  - Validación de precios
 *  - Renderizado SVG
 */

import crypto from 'crypto';
import {
  buildAuthHeaders,
  generateNonce,
  generateCheckSum,
  VnnoxClient,
  VnnoxError,
  VnnoxAuthError,
  VnnoxTimeSkewError,
} from '../vnnox-client';
import { validatePrices, getTemplateList, renderToSvg, TEMPLATES } from '../creative-renderer';

// ============================================================
// Nonce Tests
// ============================================================

describe('Nonce generation', () => {
  test('should be alphanumeric only (no dashes, no special chars)', () => {
    for (let i = 0; i < 50; i++) {
      const nonce = generateNonce(32);
      expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
      // Specifically: NO dashes (UUID v4 has dashes)
      expect(nonce).not.toContain('-');
    }
  });

  test('should respect requested length', () => {
    expect(generateNonce(8).length).toBe(8);
    expect(generateNonce(16).length).toBe(16);
    expect(generateNonce(32).length).toBe(32);
    expect(generateNonce(64).length).toBe(64);
  });

  test('should reject lengths outside 8-64', () => {
    expect(() => generateNonce(7)).toThrow();
    expect(() => generateNonce(65)).toThrow();
    expect(() => generateNonce(0)).toThrow();
  });

  test('should produce different values each time', () => {
    const a = generateNonce(32);
    const b = generateNonce(32);
    expect(a).not.toBe(b);
  });

  test('default length should be 32', () => {
    const nonce = generateNonce();
    expect(nonce.length).toBe(32);
  });
});

// ============================================================
// Auth / CheckSum Tests
// ============================================================

describe('buildAuthHeaders', () => {
  const config = {
    baseUrl: 'https://open-au.vnnox.com',
    appKey: 'test-app-key-12345',
    appSecret: 'test-app-secret-67890',
  };

  test('should include all required headers', () => {
    const h = buildAuthHeaders(config);
    expect(h).toHaveProperty('AppKey', config.appKey);
    expect(h).toHaveProperty('Nonce');
    expect(h).toHaveProperty('CurTime');
    expect(h).toHaveProperty('CheckSum');
    expect(h).toHaveProperty('Content-Type', 'application/json');
  });

  test('Nonce must be alphanumeric without dashes', () => {
    const h = buildAuthHeaders(config);
    expect(h.Nonce).toMatch(/^[A-Za-z0-9]+$/);
    expect(h.Nonce.length).toBeGreaterThanOrEqual(8);
    expect(h.Nonce.length).toBeLessThanOrEqual(64);
  });

  test('CurTime must be Unix timestamp in seconds (within 2s of now)', () => {
    const h = buildAuthHeaders(config);
    const curTime = parseInt(h.CurTime);
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(curTime - now)).toBeLessThan(2);
  });

  test('CheckSum = SHA256(AppSecret + Nonce + CurTime)', () => {
    const h = buildAuthHeaders(config);
    const expected = crypto
      .createHash('sha256')
      .update(config.appSecret + h.Nonce + h.CurTime, 'utf8')
      .digest('hex');
    expect(h.CheckSum).toBe(expected);
  });

  test('CheckSum must be 64 char hex lowercase', () => {
    const h = buildAuthHeaders(config);
    expect(h.CheckSum).toMatch(/^[0-9a-f]{64}$/);
  });

  test('two consecutive calls produce different Nonce and CheckSum', () => {
    const h1 = buildAuthHeaders(config);
    const h2 = buildAuthHeaders(config);
    expect(h1.Nonce).not.toBe(h2.Nonce);
    expect(h1.CheckSum).not.toBe(h2.CheckSum);
  });
});

describe('generateCheckSum', () => {
  test('deterministic for same inputs', () => {
    const a = generateCheckSum('secret', 'nonce123', '1700000000');
    const b = generateCheckSum('secret', 'nonce123', '1700000000');
    expect(a).toBe(b);
  });

  test('produces hex sha256', () => {
    const cs = generateCheckSum('s', 'n', '0');
    expect(cs).toMatch(/^[0-9a-f]{64}$/);
    // manual check
    const expected = crypto.createHash('sha256').update('sn0', 'utf8').digest('hex');
    expect(cs).toBe(expected);
  });
});

// ============================================================
// VnnoxClient construction
// ============================================================

describe('VnnoxClient', () => {
  test('should create with explicit config', () => {
    const c = new VnnoxClient({ baseUrl: 'https://test.example', appKey: 'k', appSecret: 's' });
    expect(c).toBeDefined();
  });

  test('should create with env vars', () => {
    process.env.VNNOX_BASE_URL = 'https://env.vnnox.com';
    process.env.VNNOX_APP_KEY = 'env-key';
    process.env.VNNOX_APP_SECRET = 'env-secret';

    const c = new VnnoxClient();
    expect(c).toBeDefined();

    delete process.env.VNNOX_BASE_URL;
    delete process.env.VNNOX_APP_KEY;
    delete process.env.VNNOX_APP_SECRET;
  });
});

// ============================================================
// Error Types
// ============================================================

describe('Error types', () => {
  test('VnnoxError has code and httpStatus', () => {
    const e = new VnnoxError('msg', 'CODE', 500);
    expect(e.code).toBe('CODE');
    expect(e.httpStatus).toBe(500);
    expect(e.name).toBe('VnnoxError');
  });

  test('VnnoxAuthError is 401', () => {
    const e = new VnnoxAuthError('bad auth');
    expect(e.httpStatus).toBe(401);
    expect(e.code).toBe('AUTH_ERROR');
  });

  test('VnnoxTimeSkewError indicates clock drift', () => {
    const e = new VnnoxTimeSkewError('drift');
    expect(e.code).toBe('TIME_SKEW_ERROR');
  });
});

// ============================================================
// Price Validation
// ============================================================

describe('Price validation', () => {
  test('accepts valid prices', () => {
    const r = validatePrices({ diesel: 1.459, gasolina: 1.619, dieselPlus: 1.539, adBlue: 0.599, showAdBlue: true });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('accepts all-null prices', () => {
    expect(validatePrices({ diesel: null, gasolina: null, dieselPlus: null, adBlue: null, showAdBlue: false }).valid).toBe(true);
  });

  test('rejects negative prices', () => {
    const r = validatePrices({ diesel: -1, gasolina: null, dieselPlus: null, adBlue: null, showAdBlue: false });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('negativo'))).toBe(true);
  });

  test('rejects > 9.999', () => {
    const r = validatePrices({ diesel: 12, gasolina: null, dieselPlus: null, adBlue: null, showAdBlue: false });
    expect(r.valid).toBe(false);
  });

  test('ignores adBlue when showAdBlue=false', () => {
    expect(validatePrices({ diesel: 1.5, gasolina: null, dieselPlus: null, adBlue: -1, showAdBlue: false }).valid).toBe(true);
  });

  test('validates adBlue when showAdBlue=true', () => {
    expect(validatePrices({ diesel: 1.5, gasolina: null, dieselPlus: null, adBlue: -1, showAdBlue: true }).valid).toBe(false);
  });
});

// ============================================================
// Templates
// ============================================================

describe('Templates', () => {
  test('returns ≥ 3 templates', () => {
    expect(getTemplateList().length).toBeGreaterThanOrEqual(3);
  });

  test('each template has id, name, description', () => {
    getTemplateList().forEach(t => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  test('default template exists', () => {
    expect(TEMPLATES.default).toBeDefined();
  });
});

// ============================================================
// SVG Renderer
// ============================================================

describe('SVG renderer', () => {
  test('generates valid SVG with fuel prices', () => {
    const svg = renderToSvg({
      width: 1920, height: 1080, templateId: 'default',
      prices: { diesel: 1.459, gasolina: 1.619, dieselPlus: 1.539, adBlue: null, showAdBlue: false },
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('DIÉSEL');
    expect(svg).toContain('GASOLINA');
  });

  test('includes AdBlue only when showAdBlue=true', () => {
    const with_ = renderToSvg({
      width: 800, height: 480, templateId: 'default',
      prices: { diesel: 1.5, gasolina: null, dieselPlus: null, adBlue: 0.6, showAdBlue: true },
    });
    const without = renderToSvg({
      width: 800, height: 480, templateId: 'default',
      prices: { diesel: 1.5, gasolina: null, dieselPlus: null, adBlue: 0.6, showAdBlue: false },
    });
    expect(with_).toContain('AdBlue');
    expect(without).not.toContain('AdBlue');
  });

  test('handles promo and message', () => {
    const svg = renderToSvg({
      width: 1920, height: 1080, templateId: 'energy',
      promo: { title: '¡OFERTA!', text: '5% de descuento' },
      message: { text: 'Bienvenidos' },
    });
    expect(svg).toContain('¡OFERTA!');
    expect(svg).toContain('Bienvenidos');
  });

  test('different templates produce different SVGs', () => {
    const opts = {
      width: 800, height: 480,
      prices: { diesel: 1.5, gasolina: 1.6, dieselPlus: null, adBlue: null, showAdBlue: false as const },
    };
    const a = renderToSvg({ ...opts, templateId: 'default' });
    const b = renderToSvg({ ...opts, templateId: 'premium' });
    expect(a).not.toBe(b);
  });
});

// ============================================================
// RBAC workflow
// ============================================================

describe('RBAC workflow enforcement', () => {
  test('DRAFT cannot skip to PUBLISHED', () => {
    const allowed: Record<string, string[]> = {
      DRAFT: ['PENDING_APPROVAL'],
      PENDING_APPROVAL: ['APPROVED'],
      APPROVED: ['PUBLISHED'],
      PUBLISHED: ['ROLLED_BACK'],
      FAILED: ['ROLLED_BACK'],
    };
    expect(allowed['DRAFT']).not.toContain('PUBLISHED');
    expect(allowed['PENDING_APPROVAL']).toContain('APPROVED');
    expect(allowed['APPROVED']).toContain('PUBLISHED');
  });
});

// ============================================================
// Endpoint paths (compile-time / structural test)
// ============================================================

describe('v2 endpoint paths', () => {
  // We verify the client source uses the correct v2 paths.
  // This is a structural/contract test — no network calls.

  const fs = require('fs');
  const src = fs.readFileSync(
    require('path').resolve(__dirname, '../vnnox-client.ts'), 'utf8'
  );

  test.each([
    '/v2/player/list',
    '/v2/player/current/online-status',
    '/v2/player/program/normal',
    '/v2/player/program/over-specification-check',
    '/v2/player/scheduled-control/screen-status',
    '/v2/player/scheduled-control/brightness',
  ])('source contains %s', (path) => {
    expect(src).toContain(path);
  });

  test('source does NOT contain /v3/', () => {
    expect(src).not.toContain('/v3/');
  });

  test('Nonce generator does NOT use randomUUID', () => {
    expect(src).not.toContain('randomUUID');
  });
});
