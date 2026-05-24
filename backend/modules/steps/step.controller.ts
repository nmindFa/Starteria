import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { StepService } from './step.service';
import { ApiResponse } from '../../shared/types/api.types';
import { AppError } from '../../shared/errors/AppError';
import { saveStepDataSchemaByNumber } from './step.schemas';

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

  /**
   * PUT /:projectId/steps/:number/data
   *
   * Persists Step 1..4 form data as a polymorphic JSON blob on `Step.stepData`.
   * TASK-010 extended the supported range from {1} to {1, 2, 3, 4}; the Prisma
   * column already supports any payload shape so no schema migration is
   * required. Validation runs per step number via `saveStepDataSchemaByNumber`.
   */
  saveData = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const stepNumber = Number(req.params.number);
      if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 4) {
        throw AppError.badRequest('Numero de paso invalido.', 'STEP_NUMBER_INVALID', {
          hint: 'Solo se aceptan pasos 1, 2, 3 o 4.',
        });
      }
      const schema = saveStepDataSchemaByNumber[stepNumber];
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        // Surface zod errors via the existing error-handler (it maps ZodError → V1 envelope).
        return next(parsed.error);
      }
      await this.service.saveStepData(req.params.projectId, stepNumber, parsed.data);
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
