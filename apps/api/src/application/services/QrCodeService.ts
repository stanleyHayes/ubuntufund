import QRCode from 'qrcode';

/**
 * Shared render options: a tight quiet-zone margin, medium error correction
 * (survives a logo overlay / light print wear), and a crisp raster size.
 */
const RENDER_OPTIONS = {
  margin: 1,
  errorCorrectionLevel: 'M' as const,
  width: 512,
};

/**
 * Thin wrapper over the `qrcode` library that renders a piece of text (a short
 * URL, in our case) as an inline SVG string, a PNG data URL, or a raw PNG
 * buffer. Kept tiny and dependency-injected so controllers stay lib-agnostic.
 */
export class QrCodeService {
  /** Render `text` as a standalone inline `<svg>…</svg>` string. */
  async toSvg(text: string): Promise<string> {
    return QRCode.toString(text, { ...RENDER_OPTIONS, type: 'svg' });
  }

  /** Render `text` as a `data:image/png;base64,…` URL. */
  async toPngDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, RENDER_OPTIONS);
  }

  /** Render `text` as a raw PNG buffer. */
  async toPngBuffer(text: string): Promise<Buffer> {
    return QRCode.toBuffer(text, RENDER_OPTIONS);
  }
}
