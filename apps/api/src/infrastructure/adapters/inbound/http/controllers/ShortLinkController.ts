import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateShortLinkUseCase } from '../../../../../application/use-cases/CreateShortLinkUseCase.js';
import type { ListCampaignQrCodesUseCase } from '../../../../../application/use-cases/ListCampaignQrCodesUseCase.js';
import type { ResolveShortLinkUseCase } from '../../../../../application/use-cases/ResolveShortLinkUseCase.js';
import type { ShortLinkRepositoryPort } from '../../../../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import type { QrCodeService } from '../../../../../application/services/QrCodeService.js';
import { buildShortUrl } from '../../../../../application/utils/shortLinkTarget.js';
import { AppError } from '../../middleware/errorHandler.js';

/** UTM/attribution query keys forwarded from a short-link scan onto its target. */
const FORWARDED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
];

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/**
 * Carry a scan's utm and ref params onto the resolved target so downstream
 * attribution survives the redirect, without clobbering params the target
 * already sets.
 */
function forwardParams(target: string, query: Request['query']): string {
  try {
    const url = new URL(target);
    for (const key of FORWARDED_PARAMS) {
      const value = firstQueryValue(query[key]);
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    // target should always be absolute; if not, redirect to it verbatim.
    return target;
  }
}

export class ShortLinkController {
  constructor(
    private readonly createShortLinkUseCase: CreateShortLinkUseCase,
    private readonly listCampaignQrCodesUseCase: ListCampaignQrCodesUseCase,
    private readonly resolveShortLinkUseCase: ResolveShortLinkUseCase,
    private readonly shortLinkRepo: ShortLinkRepositoryPort,
    private readonly qrCodeService: QrCodeService,
    private readonly publicApiUrl: string
  ) {}

  /** POST /campaigns/:id/qr-codes — create a short link + rendered QR (owner/admin). */
  createForCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const view = await this.createShortLinkUseCase.execute(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole }
      );

      const [pngDataUrl, svg] = await Promise.all([
        this.qrCodeService.toPngDataUrl(view.shortUrl),
        this.qrCodeService.toSvg(view.shortUrl),
      ]);

      res.status(201).json({
        data: {
          code: view.code,
          shortUrl: view.shortUrl,
          target: view.target,
          pngDataUrl,
          svg,
        },
        message: 'QR code created',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /campaigns/:id/qr-codes — list a campaign's short links (owner/admin). */
  listForCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const links = await this.listCampaignQrCodesUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({
        data: links,
        message: 'QR codes retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /r/:code — public 302 redirect; records a coarse scan and forwards utm. */
  redirect = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const code = req.params.code as string;
      const source =
        firstQueryValue(req.query.utm_source) ?? firstQueryValue(req.query.ref);

      const resolved = await this.resolveShortLinkUseCase.execute(code, source);
      if (!resolved) {
        throw new AppError('Short link not found', 404);
      }

      const destination = forwardParams(resolved.target, req.query);
      res.setHeader('X-Short-Url', buildShortUrl(this.publicApiUrl, code));
      // Short links are dynamic (target/scan state can change) — never cache.
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, destination);
    } catch (error) {
      next(error);
    }
  };

  /** GET /qr/:code.svg — public inline SVG rendering of the short URL. */
  svg = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const code = req.params.code as string;
      const exists = await this.shortLinkRepo.existsByCode(code);
      if (!exists) {
        throw new AppError('Short link not found', 404);
      }
      const shortUrl = buildShortUrl(this.publicApiUrl, code);
      const svg = await this.qrCodeService.toSvg(shortUrl);
      res.setHeader('X-Short-Url', shortUrl);
      res.type('image/svg+xml').send(svg);
    } catch (error) {
      next(error);
    }
  };

  /** GET /qr/:code.png — public PNG rendering of the short URL. */
  png = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const code = req.params.code as string;
      const exists = await this.shortLinkRepo.existsByCode(code);
      if (!exists) {
        throw new AppError('Short link not found', 404);
      }
      const shortUrl = buildShortUrl(this.publicApiUrl, code);
      const buffer = await this.qrCodeService.toPngBuffer(shortUrl);
      res.setHeader('X-Short-Url', shortUrl);
      res.type('image/png').send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
