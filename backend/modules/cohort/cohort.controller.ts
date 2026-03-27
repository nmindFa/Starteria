import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { CohortService } from './cohort.service';
import { ApiResponse } from '../../shared/types/api.types';

export class CohortController {
  constructor(private service: CohortService) {}

  list = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.listCohorts({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json({ success: true, data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  getWithKPIs = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.getCohortWithKPIs(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getProjects = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.getCohortProjects(req.params.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        status: req.query.status as string | undefined,
      });
      res.json({ success: true, data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  getFunnel = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.getFunnelAnalytics(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const includeEvidence = req.query.includeEvidence === 'true';
      const csv = await this.service.exportCohortData(req.params.id, includeEvidence);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="cohort-${req.params.id}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };
}
