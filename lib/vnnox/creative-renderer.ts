/**
 * Creative Renderer — Generates display content for gas station screens
 * 
 * Renders prices, promotions, and messages into images suitable for
 * VNNOX display screens. Uses server-side canvas rendering.
 * 
 * Templates are designed for highway-readable content:
 * - Large typography for prices
 * - High contrast colors
 * - Branding support
 * - Multiple selectable templates
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
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  default: {
    id: 'default',
    name: 'Estándar SEL',
    description: 'Fondo oscuro, precios blancos con alto contraste',
    bgColors: ['#0f172a', '#1e293b'],
    priceColor: '#ffffff',
    labelColor: '#94a3b8',
    promoColors: { bg: '#f59e0b', text: '#0f172a' },
    messageColors: { bg: 'rgba(255,255,255,0.1)', text: '#e2e8f0' },
    accentColor: '#3b82f6',
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
  },
  premium: {
    id: 'premium',
    name: 'Premium Rojo',
    description: 'Estilo premium con acentos rojos',
    bgColors: ['#1a1a2e', '#16213e'],
    priceColor: '#ffffff',
    labelColor: '#94a3b8',
    promoColors: { bg: '#ef4444', text: '#ffffff' },
    messageColors: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
    accentColor: '#ef4444',
  },
  daylight: {
    id: 'daylight',
    name: 'Diurno',
    description: 'Fondo claro para visibilidad diurna',
    bgColors: ['#f1f5f9', '#e2e8f0'],
    priceColor: '#0f172a',
    labelColor: '#64748b',
    promoColors: { bg: '#2563eb', text: '#ffffff' },
    messageColors: { bg: 'rgba(0,0,0,0.05)', text: '#334155' },
    accentColor: '#2563eb',
  },
  corporate: {
    id: 'corporate',
    name: 'Corporativo SEL',
    description: 'Azul corporativo con branding SEL',
    bgColors: ['#1e3a5f', '#0d2137'],
    priceColor: '#ffffff',
    labelColor: '#7dd3fc',
    promoColors: { bg: '#f97316', text: '#ffffff' },
    messageColors: { bg: 'rgba(255,255,255,0.08)', text: '#bae6fd' },
    accentColor: '#0ea5e9',
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
// SVG-based renderer (server-compatible, no Canvas dependency)
// ============================================================

/**
 * Generates an SVG string that represents the display content.
 * This SVG can be used directly as preview or converted to PNG via API.
 */
export function renderToSvg(options: RenderOptions): string {
  const { width, height, templateId, prices, promo, message } = options;
  const tpl = TEMPLATES[templateId] || TEMPLATES.default;

  const hasPrices = prices && (prices.diesel || prices.gasolina || prices.dieselPlus || (prices.showAdBlue && prices.adBlue));
  const hasPromo = promo && (promo.title || promo.text);
  const hasMessage = message && message.text;

  // Layout calculations
  const padding = Math.round(width * 0.03);
  const priceAreaWidth = hasPrices ? (hasPromo || hasMessage ? Math.round(width * 0.55) : width) : 0;
  const sideAreaX = priceAreaWidth;
  const sideAreaWidth = width - priceAreaWidth;

  // Font sizes (proportional)
  const priceFontSize = Math.round(height * 0.18);
  const labelFontSize = Math.round(height * 0.055);
  const euroSymbolSize = Math.round(priceFontSize * 0.5);
  const promoTitleSize = Math.round(height * 0.08);
  const promoTextSize = Math.round(height * 0.05);
  const messageFontSize = Math.round(height * 0.045);
  const headerFontSize = Math.round(height * 0.035);

  // Build prices section
  const fuelItems: Array<{ label: string; value: number; color: string }> = [];
  if (prices?.diesel) fuelItems.push({ label: 'DIÉSEL', value: prices.diesel, color: '#fbbf24' });
  if (prices?.gasolina) fuelItems.push({ label: 'GASOLINA', value: prices.gasolina, color: '#ef4444' });
  if (prices?.dieselPlus) fuelItems.push({ label: 'DIÉSEL+', value: prices.dieselPlus, color: '#8b5cf6' });
  if (prices?.showAdBlue && prices?.adBlue) fuelItems.push({ label: 'AdBlue', value: prices.adBlue, color: '#06b6d4' });

  const priceRowHeight = fuelItems.length > 0 ? Math.round((height - padding * 2) / Math.max(fuelItems.length, 1)) : 0;

  let pricesSvg = '';
  fuelItems.forEach((item, idx) => {
    const y = padding + idx * priceRowHeight;
    const centerY = y + priceRowHeight / 2;

    // Color bar indicator
    pricesSvg += `<rect x="${padding}" y="${y + 4}" width="6" height="${priceRowHeight - 8}" rx="3" fill="${item.color}" />`;

    // Label
    pricesSvg += `<text x="${padding + 20}" y="${centerY - priceFontSize * 0.15}" 
      font-family="Inter, Arial, sans-serif" font-size="${labelFontSize}" 
      fill="${tpl.labelColor}" font-weight="600" letter-spacing="2">${item.label}</text>`;

    // Price value
    const priceStr = item.value.toFixed(3);
    const parts = priceStr.split('.');
    const intPart = parts[0];
    const decPart = parts[1] || '000';

    pricesSvg += `<text x="${padding + 20}" y="${centerY + priceFontSize * 0.45}" 
      font-family="Inter, Arial, sans-serif" font-size="${priceFontSize}" 
      fill="${tpl.priceColor}" font-weight="800">${intPart}<tspan font-size="${Math.round(priceFontSize * 0.9)}">,${decPart}</tspan>
      <tspan font-size="${euroSymbolSize}" dy="-${Math.round(priceFontSize * 0.3)}"> €/L</tspan></text>`;
  });

  // Side area (promo + message)
  let sideSvg = '';
  if (sideAreaWidth > 0 && (hasPromo || hasMessage)) {
    // Separator line
    sideSvg += `<line x1="${sideAreaX}" y1="${padding}" x2="${sideAreaX}" y2="${height - padding}" 
      stroke="${tpl.accentColor}" stroke-width="2" opacity="0.5" />`;

    let sideY = padding + 10;

    if (hasPromo) {
      // Promo banner
      const promoH = hasMessage ? Math.round((height - padding * 2) * 0.6) : height - padding * 2 - 20;
      sideSvg += `<rect x="${sideAreaX + padding}" y="${sideY}" width="${sideAreaWidth - padding * 2}" height="${promoH}" 
        rx="12" fill="${tpl.promoColors.bg}" />`;

      if (promo?.title) {
        sideSvg += `<text x="${sideAreaX + sideAreaWidth / 2}" y="${sideY + promoH * 0.35}" 
          font-family="Inter, Arial, sans-serif" font-size="${promoTitleSize}" 
          fill="${tpl.promoColors.text}" font-weight="800" text-anchor="middle"
          letter-spacing="1">${escapeXml(promo.title)}</text>`;
      }

      if (promo?.text) {
        // Wrap promo text
        const maxCharsPerLine = Math.floor((sideAreaWidth - padding * 4) / (promoTextSize * 0.55));
        const lines = wrapText(promo.text, maxCharsPerLine);
        lines.forEach((line, i) => {
          sideSvg += `<text x="${sideAreaX + sideAreaWidth / 2}" y="${sideY + promoH * 0.55 + i * (promoTextSize + 4)}" 
            font-family="Inter, Arial, sans-serif" font-size="${promoTextSize}" 
            fill="${tpl.promoColors.text}" font-weight="500" text-anchor="middle"
            opacity="0.9">${escapeXml(line)}</text>`;
        });
      }

      sideY += promoH + 10;
    }

    if (hasMessage) {
      const msgH = height - sideY - padding;
      sideSvg += `<rect x="${sideAreaX + padding}" y="${sideY}" width="${sideAreaWidth - padding * 2}" height="${msgH}" 
        rx="8" fill="${tpl.messageColors.bg}" />`;

      if (message?.text) {
        const maxCharsPerLine = Math.floor((sideAreaWidth - padding * 4) / (messageFontSize * 0.55));
        const lines = wrapText(message.text, maxCharsPerLine);
        const startY = sideY + msgH / 2 - ((lines.length - 1) * (messageFontSize + 4)) / 2;
        lines.forEach((line, i) => {
          sideSvg += `<text x="${sideAreaX + sideAreaWidth / 2}" y="${startY + i * (messageFontSize + 4)}" 
            font-family="Inter, Arial, sans-serif" font-size="${messageFontSize}" 
            fill="${tpl.messageColors.text}" font-weight="400" text-anchor="middle">${escapeXml(line)}</text>`;
        });
      }
    }
  }

  // If no prices but has message/promo only
  if (!hasPrices && (hasPromo || hasMessage)) {
    // Center content
    let centerY = padding + 20;

    if (hasPromo) {
      const promoH = hasMessage ? Math.round((height - padding * 2) * 0.65) : height - padding * 2;
      sideSvg += `<rect x="${padding}" y="${centerY}" width="${width - padding * 2}" height="${promoH}" 
        rx="16" fill="${tpl.promoColors.bg}" />`;

      if (promo?.title) {
        sideSvg += `<text x="${width / 2}" y="${centerY + promoH * 0.4}" 
          font-family="Inter, Arial, sans-serif" font-size="${Math.round(promoTitleSize * 1.5)}" 
          fill="${tpl.promoColors.text}" font-weight="800" text-anchor="middle">${escapeXml(promo.title)}</text>`;
      }

      if (promo?.text) {
        const maxChars = Math.floor((width - padding * 4) / (promoTextSize * 0.55));
        const lines = wrapText(promo.text, maxChars);
        lines.forEach((line, i) => {
          sideSvg += `<text x="${width / 2}" y="${centerY + promoH * 0.6 + i * (promoTextSize + 6)}" 
            font-family="Inter, Arial, sans-serif" font-size="${Math.round(promoTextSize * 1.2)}" 
            fill="${tpl.promoColors.text}" font-weight="500" text-anchor="middle">${escapeXml(line)}</text>`;
        });
      }

      centerY += promoH + 10;
    }
  }

  // Header bar
  const headerSvg = `<rect x="0" y="0" width="${width}" height="${Math.round(height * 0.01)}" fill="${tpl.accentColor}" />`;

  // Timestamp watermark
  const now = new Date();
  const timestamp = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  const watermark = `<text x="${width - padding}" y="${height - 8}" 
    font-family="monospace" font-size="${Math.round(height * 0.025)}" 
    fill="${tpl.labelColor}" text-anchor="end" opacity="0.4">Actualizado: ${timestamp}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${tpl.bgColors[0]}" />
        <stop offset="100%" style="stop-color:${tpl.bgColors[1]}" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    ${headerSvg}
    ${pricesSvg}
    ${sideSvg}
    ${watermark}
  </svg>`;
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
