import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { PortfolioService } from './portfolio.service';
import { ApiResponse } from '../../shared/types/api.types';

export class PortfolioController {
  constructor(private service: PortfolioService) {}

  // ─── Strategic Fronts ────────────────────────────────────────────────────────

  listStrategicFronts = async (
    _req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listStrategicFronts();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createStrategicFront(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateStrategicFront(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  deleteStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      await this.service.deleteStrategicFront(req.params.id);
      res.json({ success: true, data: { message: 'Frente estrategico eliminado' } });
    } catch (err) {
      next(err);
    }
  };

  // ─── Challenges ──────────────────────────────────────────────────────────────

  listChallenges = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listChallenges(req.params.frontId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createChallenge(req.params.frontId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateChallenge(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  activateOpenCall = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.activateOpenCall(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  publishChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.publishChallenge(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Invitations ─────────────────────────────────────────────────────────────

  addInvitation = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.addInvitation(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateInvitation = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateInvitation(req.params.invId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Squad Members ────────────────────────────────────────────────────────────

  addSquadMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.addSquadMember(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateSquadMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateSquadMember(req.params.memberId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Initiatives ──────────────────────────────────────────────────────────────

  listInitiatives = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listInitiativesForChallenge(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  upsertInitiativeMeta = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.upsertInitiativeMeta(req.params.projectId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Overlaps ─────────────────────────────────────────────────────────────────

  listOverlaps = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listOverlaps(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createOverlap = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createOverlap(req.params.challengeId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Executive Outputs ────────────────────────────────────────────────────────

  listExecutiveOutputs = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listExecutiveOutputs(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createExecutiveOutput = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createExecutiveOutput(req.params.challengeId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateExecutiveOutput = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateExecutiveOutput(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
