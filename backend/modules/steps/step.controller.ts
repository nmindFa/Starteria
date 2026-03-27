import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { StepService } from './step.service';
import { ApiResponse } from '../../shared/types/api.types';

export class StepController {
  constructor(private service: StepService) {}

  getAll = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const steps = await this.service.getSteps(req.params.projectId);
      res.json({ success: true, data: steps });
    } catch (err) {
      next(err);
    }
  };

  getByNumber = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const step = await this.service.getStep(req.params.projectId, Number(req.params.number));
      res.json({ success: true, data: step });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const step = await this.service.updateStepStatus(
        req.params.projectId,
        Number(req.params.number),
        req.body.status
      );
      res.json({ success: true, data: step });
    } catch (err) {
      next(err);
    }
  };

  getData = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.getStepData(req.params.projectId, Number(req.params.number));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  saveData = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await this.service.saveStepData(req.params.projectId, Number(req.params.number), req.body);
      res.json({ success: true, data: { message: 'Datos guardados' } });
    } catch (err) {
      next(err);
    }
  };

  updateModule = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await this.service.updateModule(
        req.params.projectId,
        Number(req.params.number),
        req.params.moduleId,
        req.body.status
      );
      res.json({ success: true, data: { message: 'Modulo actualizado' } });
    } catch (err) {
      next(err);
    }
  };

  submitAiReview = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.submitAiReview(req.params.projectId, Number(req.params.number));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  requestSession = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = await this.service.requestMentorSession(
        req.params.projectId,
        Number(req.params.number),
        req.body.preferredDate,
        req.body.notes
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
