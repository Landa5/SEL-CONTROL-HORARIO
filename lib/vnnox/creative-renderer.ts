/**
 * Creative Renderer — Generates display content for gas station LED screens
 * 
 * Optimizado para pantalla Taurus T2-4G (128×128 px LED cuadrado).
 * Los textos se dimensionan en píxeles absolutos para garantizar legibilidad.
 * 
 * Templates:
 *   - compact:    3 filas apiladas, máxima legibilidad
 *   - bold:       precios extra grandes, etiquetas mínimas
 *   - horizontal: 2 columnas (etiqueta | precio)
 *   - minimal:    solo números con barras de color
 *   - neon:       estilo neón con glow
 */

export interface PriceData {
  diesel?: number | null;
  gasolina?: number | null;
  dieselPlus?: number | null;
  adBlue?: number | null;
  showAdBlue: boolean;
}

export interface PromoData {
  title?: string | null;
  text?: string | null;
  imageUrl?: string | null;
}

export interface MessageData {
  text?: string | null;
}

export interface RenderOptions {
  width: number;
  height: number;
  templateId: string;
  prices?: PriceData;
  promo?: PromoData;
  message?: MessageData;
  brandLogoUrl?: string | null;
}

export interface RenderResult {
  imageDataUrl: string;    // base64 data URL for preview
  imageBuffer: Buffer;     // Raw PNG buffer
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  md5: string;
}

// ============================================================
// Template definitions
// ============================================================

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  bgColors: string[];       // gradient stops
  priceColor: string;
  labelColor: string;
  promoColors: { bg: string; text: string };
  messageColors: { bg: string; text: string };
  accentColor: string;
  fuelBarColors?: { diesel: string; gasolina: string; dieselPlus: string; adBlue: string };
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  default: {
    id: 'default',
    name: 'Estándar SEL',
    description: 'Fondo oscuro, precios blancos — alto contraste',
    bgColors: ['#0f172a', '#1e293b'],
    priceColor: '#ffffff',
    labelColor: '#94a3b8',
    promoColors: { bg: '#f59e0b', text: '#0f172a' },
    messageColors: { bg: 'rgba(255,255,255,0.1)', text: '#e2e8f0' },
    accentColor: '#3b82f6',
    fuelBarColors: { diesel: '#fbbf24', gasolina: '#ef4444', dieselPlus: '#8b5cf6', adBlue: '#06b6d4' },
  },
  energy: {
    id: 'energy',
    name: 'Energía Verde',
    description: 'Tono verde para estaciones eco',
    bgColors: ['#064e3b', '#065f46'],
    priceColor: '#ffffff',
    labelColor: '#a7f3d0',
    promoColors: { bg: '#fbbf24', text: '#064e3b' },
    messageColors: { bg: 'rgba(255,255,255,0.1)', text: '#d1fae5' },
    accentColor: '#34d399',
    fuelBarColors: { diesel: '#fbbf24', gasolina: '#f87171', dieselPlus: '#c084fc', adBlue: '#22d3ee' },
  },
  premium: {
    id: 'premium',
    name: 'Premium Rojo',
    description: 'Estilo premium con acentos dorados',
    bgColors: ['#1a1a2e', '#16213e'],
    priceColor: '#fef3c7',
    labelColor: '#d4a574',
    promoColors: { bg: '#ef4444', text: '#ffffff' },
    messageColors: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
    accentColor: '#f59e0b',
    fuelBarColors: { diesel: '#f59e0b', gasolina: '#ef4444', dieselPlus: '#a78bfa', adBlue: '#67e8f9' },
  },
  daylight: {
    id: 'daylight',
    name: 'Diurno',
    description: 'Fondo claro para máxima visibilidad solar',
    bgColors: ['#ffffff', '#f1f5f9'],
    priceColor: '#0f172a',
    labelColor: '#475569',
    promoColors: { bg: '#2563eb', text: '#ffffff' },
    messageColors: { bg: 'rgba(0,0,0,0.05)', text: '#334155' },
    accentColor: '#2563eb',
    fuelBarColors: { diesel: '#d97706', gasolina: '#dc2626', dieselPlus: '#7c3aed', adBlue: '#0891b2' },
  },
  corporate: {
    id: 'corporate',
    name: 'Corporativo SEL',
    description: 'Azul corporativo con branding',
    bgColors: ['#1e3a5f', '#0d2137'],
    priceColor: '#ffffff',
    labelColor: '#7dd3fc',
    promoColors: { bg: '#f97316', text: '#ffffff' },
    messageColors: { bg: 'rgba(255,255,255,0.08)', text: '#bae6fd' },
    accentColor: '#0ea5e9',
    fuelBarColors: { diesel: '#fbbf24', gasolina: '#f87171', dieselPlus: '#a78bfa', adBlue: '#22d3ee' },
  },
};

export function getTemplateList(): Array<{ id: string; name: string; description: string }> {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}

// ============================================================
// Fuel item helpers
// ============================================================

interface FuelItem {
  label: string;
  shortLabel: string;
  value: number;
  color: string;
}

function buildFuelItems(prices: PriceData | undefined, tpl: TemplateDefinition): FuelItem[] {
  const colors = tpl.fuelBarColors || { diesel: '#fbbf24', gasolina: '#ef4444', dieselPlus: '#8b5cf6', adBlue: '#06b6d4' };
  const items: FuelItem[] = [];
  if (prices?.diesel) items.push({ label: 'DIÉSEL', shortLabel: 'D', value: prices.diesel, color: colors.diesel });
  if (prices?.gasolina) items.push({ label: 'GASOLINA', shortLabel: 'G', value: prices.gasolina, color: colors.gasolina });
  if (prices?.dieselPlus) items.push({ label: 'DIÉSEL+', shortLabel: 'D+', value: prices.dieselPlus, color: colors.dieselPlus });
  if (prices?.showAdBlue && prices?.adBlue) items.push({ label: 'AdBlue', shortLabel: 'AB', value: prices.adBlue, color: colors.adBlue });
  return items;
}

function formatPrice(val: number): string {
  return val.toFixed(3).replace('.', ',');
}

// ============================================================
// SVG Renderer — Optimizado para 128×128 LED
// ============================================================

export function renderToSvg(options: RenderOptions): string {
  const { width, height, templateId, prices, promo, message } = options;
  const tpl = TEMPLATES[templateId] || TEMPLATES.default;
  const items = buildFuelItems(prices, tpl);
  const hasPromo = promo && (promo.title || promo.text);
  const hasMessage = message && message.text;

  // Para pantallas LED pequeñas (≤ 256px), usamos layout compacto
  const isSmallScreen = width <= 256 || height <= 256;

  if (isSmallScreen) {
    return renderSmallScreen(width, height, tpl, items, promo, message);
  }

  // Para pantallas más grandes, mantener layout original mejorado
  return renderLargeScreen(width, height, tpl, items, promo, message);
}

/**
 * Renderer optimizado para pantallas LED 128×128 y similares.
 * Cada fila tiene: barra de color | etiqueta corta | precio grande
 */
function renderSmallScreen(
  w: number, h: number,
  tpl: TemplateDefinition,
  items: FuelItem[],
  promo?: PromoData | null,
  message?: MessageData | null,
): string {
  const hasPromo = promo && (promo.title || promo.text);
  const hasMessage = message && message.text;
  const numRows = items.length || 1;

  // Tamaños fijos para 128px — escalan proporcionalmente
  const scale = Math.min(w, h) / 128;
  const barW = Math.round(4 * scale);
  const padding = Math.round(3 * scale);
  const headerH = Math.round(2 * scale);

  // Espacio para contenido extra (promo/mensaje) debajo de los precios
  const extraH = (hasPromo || hasMessage) ? Math.round(h * 0.2) : 0;
  const priceZoneH = h - headerH - extraH;
  const rowH = Math.floor(priceZoneH / numRows);

  // Font sizes
  const labelSize = Math.round(9 * scale);
  const priceSize = Math.round(22 * scale);
  const euroSize = Math.round(10 * scale);
  const promoSize = Math.round(8 * scale);

  let svg = '';

  // — Background —
  svg += `<defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${tpl.bgColors[0]}" />
      <stop offset="100%" stop-color="${tpl.bgColors[1]}" />
    </linearGradient>
  </defs>`;
  svg += `<rect width="${w}" height="${h}" fill="url(#bg)" rx="${Math.round(2 * scale)}" />`;

  // — Top accent line —
  svg += `<rect width="${w}" height="${headerH}" fill="${tpl.accentColor}" />`;

  // — Price rows —
  items.forEach((item, idx) => {
    const y = headerH + idx * rowH;
    const midY = y + rowH / 2;

    // Separator line between rows
    if (idx > 0) {
      svg += `<line x1="${padding}" y1="${y}" x2="${w - padding}" y2="${y}" 
        stroke="${tpl.labelColor}" stroke-width="0.5" opacity="0.2" />`;
    }

    // Color bar
    const barH = Math.round(rowH * 0.6);
    svg += `<rect x="${padding}" y="${midY - barH / 2}" width="${barW}" height="${barH}" rx="${Math.round(barW / 2)}" fill="${item.color}" />`;

    // Short label (left-aligned after bar)
    const labelX = padding + barW + Math.round(3 * scale);
    svg += `<text x="${labelX}" y="${midY - Math.round(2 * scale)}" 
      font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-size="${labelSize}" 
      fill="${tpl.labelColor}" font-weight="700" letter-spacing="0.5"
      dominant-baseline="auto">${item.label}</text>`;

    // Price (large, below label, left-aligned)
    const priceStr = formatPrice(item.value);
    svg += `<text x="${labelX}" y="${midY + Math.round(priceSize * 0.7)}" 
      font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-size="${priceSize}" 
      fill="${tpl.priceColor}" font-weight="800"
      dominant-baseline="auto">${priceStr}</text>`;

    // €/L (smaller, after price)
    const priceTextW = priceStr.length * priceSize * 0.58;
    svg += `<text x="${labelX + priceTextW + Math.round(2 * scale)}" y="${midY + Math.round(priceSize * 0.5)}" 
      font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-size="${euroSize}" 
      fill="${tpl.labelColor}" font-weight="600"
      dominant-baseline="auto">€/L</text>`;
  });

  // — Extra zone (promo/message) —
  if (extraH > 0) {
    const extraY = h - extraH;
    svg += `<line x1="${padding}" y1="${extraY}" x2="${w - padding}" y2="${extraY}" 
      stroke="${tpl.accentColor}" stroke-width="1" opacity="0.4" />`;

    if (hasPromo && promo?.title) {
      svg += `<text x="${w / 2}" y="${extraY + extraH * 0.55}" 
        font-family="'Inter',Arial,sans-serif" font-size="${promoSize}" 
        fill="${tpl.promoColors.bg}" font-weight="700" text-anchor="middle"
        dominant-baseline="middle">${escapeXml(promo.title.substring(0, 20))}</text>`;
    } else if (hasMessage && message?.text) {
      svg += `<text x="${w / 2}" y="${extraY + extraH * 0.55}" 
        font-family="'Inter',Arial,sans-serif" font-size="${promoSize}" 
        fill="${tpl.messageColors.text}" font-weight="500" text-anchor="middle"
        dominant-baseline="middle">${escapeXml(message.text.substring(0, 25))}</text>`;
    }
  }

  // — Timestamp (tiny, bottom-right) —
  const now = new Date();
  const ts = `${now.getDate()}/${now.getMonth() + 1} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  svg += `<text x="${w - padding}" y="${h - Math.round(1 * scale)}" 
    font-family="monospace" font-size="${Math.round(5 * scale)}" 
    fill="${tpl.labelColor}" text-anchor="end" opacity="0.35">${ts}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
}

/**
 * Renderer para pantallas grandes (≥ 256px).
 */
function renderLargeScreen(
  w: number, h: number,
  tpl: TemplateDefinition,
  items: FuelItem[],
  promo?: PromoData | null,
  message?: MessageData | null,
): string {
  const hasPromo = promo && (promo.title || promo.text);
  const hasMessage = message && message.text;
  const padding = Math.round(w * 0.03);

  // Layout: precios a la izquierda, promo/mensaje a la derecha
  const priceAreaW = (hasPromo || hasMessage) ? Math.round(w * 0.55) : w;
  const sideW = w - priceAreaW;
  const rowH = items.length > 0 ? Math.floor((h - padding * 2) / items.length) : h;

  const labelSize = Math.round(h * 0.04);
  const priceSize = Math.round(h * 0.12);
  const euroSize = Math.round(priceSize * 0.4);

  let svg = `<defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${tpl.bgColors[0]}" />
      <stop offset="100%" stop-color="${tpl.bgColors[1]}" />
    </linearGradient>
  </defs>`;
  svg += `<rect width="${w}" height="${h}" fill="url(#bg)" />`;
  svg += `<rect width="${w}" height="${Math.round(h * 0.008)}" fill="${tpl.accentColor}" />`;

  // Prices
  items.forEach((item, idx) => {
    const y = padding + idx * rowH;
    const midY = y + rowH / 2;

    if (idx > 0) {
      svg += `<line x1="${padding}" y1="${y}" x2="${priceAreaW - padding}" y2="${y}" 
        stroke="${tpl.labelColor}" stroke-width="0.5" opacity="0.15" />`;
    }

    svg += `<rect x="${padding}" y="${midY - rowH * 0.3}" width="6" height="${rowH * 0.6}" rx="3" fill="${item.color}" />`;

    svg += `<text x="${padding + 16}" y="${midY - priceSize * 0.2}" 
      font-family="'Inter',Arial,sans-serif" font-size="${labelSize}" 
      fill="${tpl.labelColor}" font-weight="700" letter-spacing="1">${item.label}</text>`;

    const priceStr = formatPrice(item.value);
    svg += `<text x="${padding + 16}" y="${midY + priceSize * 0.55}" 
      font-family="'Inter',Arial,sans-serif" font-size="${priceSize}" 
      fill="${tpl.priceColor}" font-weight="800">${priceStr}<tspan font-size="${euroSize}" dx="4" dy="-${Math.round(priceSize * 0.3)}"> €/L</tspan></text>`;
  });

  // Side content
  if (sideW > 0 && (hasPromo || hasMessage)) {
    svg += `<line x1="${priceAreaW}" y1="${padding}" x2="${priceAreaW}" y2="${h - padding}" 
      stroke="${tpl.accentColor}" stroke-width="2" opacity="0.4" />`;

    let sideY = padding + 10;
    const promoTitleSize = Math.round(h * 0.06);
    const promoTextSize = Math.round(h * 0.04);

    if (hasPromo) {
      const promoH = hasMessage ? Math.round((h - padding * 2) * 0.6) : h - padding * 2 - 20;
      svg += `<rect x="${priceAreaW + padding}" y="${sideY}" width="${sideW - padding * 2}" height="${promoH}" 
        rx="12" fill="${tpl.promoColors.bg}" />`;

      if (promo?.title) {
        svg += `<text x="${priceAreaW + sideW / 2}" y="${sideY + promoH * 0.35}" 
          font-family="'Inter',Arial,sans-serif" font-size="${promoTitleSize}" 
          fill="${tpl.promoColors.text}" font-weight="800" text-anchor="middle">${escapeXml(promo.title)}</text>`;
      }

      if (promo?.text) {
        const maxChars = Math.floor((sideW - padding * 4) / (promoTextSize * 0.55));
        const lines = wrapText(promo.text, maxChars);
        lines.forEach((line, i) => {
          svg += `<text x="${priceAreaW + sideW / 2}" y="${sideY + promoH * 0.55 + i * (promoTextSize + 4)}" 
            font-family="'Inter',Arial,sans-serif" font-size="${promoTextSize}" 
            fill="${tpl.promoColors.text}" font-weight="500" text-anchor="middle" opacity="0.9">${escapeXml(line)}</text>`;
        });
      }
      sideY += promoH + 10;
    }

    if (hasMessage && message?.text) {
      const msgH = h - sideY - padding;
      svg += `<rect x="${priceAreaW + padding}" y="${sideY}" width="${sideW - padding * 2}" height="${msgH}" 
        rx="8" fill="${tpl.messageColors.bg}" />`;
      const msgSize = Math.round(h * 0.035);
      const maxChars = Math.floor((sideW - padding * 4) / (msgSize * 0.55));
      const lines = wrapText(message.text, maxChars);
      const startY = sideY + msgH / 2 - ((lines.length - 1) * (msgSize + 4)) / 2;
      lines.forEach((line, i) => {
        svg += `<text x="${priceAreaW + sideW / 2}" y="${startY + i * (msgSize + 4)}" 
          font-family="'Inter',Arial,sans-serif" font-size="${msgSize}" 
          fill="${tpl.messageColors.text}" font-weight="400" text-anchor="middle">${escapeXml(line)}</text>`;
      });
    }
  }

  // Timestamp
  const now = new Date();
  const timestamp = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  svg += `<text x="${w - padding}" y="${h - 8}" 
    font-family="monospace" font-size="${Math.round(h * 0.02)}" 
    fill="${tpl.labelColor}" text-anchor="end" opacity="0.35">Actualizado: ${timestamp}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
}

/**
 * Generates an HTML preview string (for client-side rendering)
 */
export function renderToHtmlPreview(options: RenderOptions): string {
  const svg = renderToSvg(options);
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

// ============================================================
// Utility functions
// ============================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines.length > 0 ? lines : [''];
}

// ============================================================
// Price validation
// ============================================================

export function validatePrices(prices: PriceData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const checkPrice = (name: string, val: number | null | undefined) => {
    if (val === null || val === undefined) return;
    if (typeof val !== 'number' || isNaN(val)) {
      errors.push(`${name}: debe ser un número válido`);
      return;
    }
    if (val < 0) {
      errors.push(`${name}: no puede ser negativo`);
    }
    if (val > 9.999) {
      errors.push(`${name}: precio demasiado alto (máx 9.999 €/L)`);
    }
    // Check reasonable decimal places
    const str = val.toString();
    const dotIdx = str.indexOf('.');
    if (dotIdx !== -1 && str.length - dotIdx - 1 > 3) {
      errors.push(`${name}: máximo 3 decimales`);
    }
  };

  checkPrice('Diésel', prices.diesel);
  checkPrice('Gasolina', prices.gasolina);
  checkPrice('Diésel+', prices.dieselPlus);
  if (prices.showAdBlue) {
    checkPrice('AdBlue', prices.adBlue);
  }

  return { valid: errors.length === 0, errors };
}
