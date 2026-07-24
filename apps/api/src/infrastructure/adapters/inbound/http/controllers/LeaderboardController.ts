import type { Request, Response, NextFunction } from 'express';
import type { GetLeaderboardUseCase } from '../../../../../application/use-cases/GetLeaderboardUseCase.js';
import type { GetLeaderboardStatsUseCase } from '../../../../../application/use-cases/GetLeaderboardStatsUseCase.js';

export class LeaderboardController {
  constructor(
    private readonly getLeaderboardUseCase: GetLeaderboardUseCase,
    private readonly getLeaderboardStatsUseCase: GetLeaderboardStatsUseCase
  ) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const entries = await this.getLeaderboardUseCase.execute({
        period: req.query.period as string | undefined,
        category: req.query.category as string | undefined,
        limit: req.query.limit as string | undefined,
      });

      res.json({
        data: entries,
        message: 'Leaderboard retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  stats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.getLeaderboardStatsUseCase.execute({
        period: req.query.period as string | undefined,
        category: req.query.category as string | undefined,
      });

      res.json({
        data: stats,
        message: 'Leaderboard stats retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  // Frontend (useFeaturedDonors, consumed by HomePage) fetches this to render
  // the "All-Time Leaders" / "This Month's Stars" panels. Composed from the
  // existing getLeaderboardUseCase for two fixed periods rather than adding a
  // new constructor dependency, so mount wiring stays unchanged.
  featured = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const limit = (req.query.limit as string | undefined) ?? '5';

      const [topAllTime, topThisMonth] = await Promise.all([
        this.getLeaderboardUseCase.execute({
          period: 'lifetime',
          category,
          limit,
        }),
        this.getLeaderboardUseCase.execute({
          period: 'monthly',
          category,
          limit,
        }),
      ]);

      res.json({
        data: { topAllTime, topThisMonth },
        message: 'Featured donors retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
