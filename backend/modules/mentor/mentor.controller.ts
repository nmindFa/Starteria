import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { MentorService } from './mentor.service';
import { ApiResponse } from '../../shared/types/api.types';

export class MentorController {
  constructor(private service: MentorService) {}

  listReviews = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const reviews = await this.service.listPendingReviews(user.id);
      res.json({ success: true, data: reviews });
    } catch (err) {
      next(err);
    }
  };

  getReview = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const review = await this.service.getReviewDetails(req.params.id, user.id);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  };

  submitReview = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const review = await this.service.submitReview(req.params.id, user.id, req.body);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  };

  sendHelp = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const result = await this.service.sendHelpRequest(req.params.projectId, user.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
