import { Request, Response, NextFunction } from 'express';
import { SponsorService } from './sponsor.service';
import { prisma } from '../../shared/db/prisma';

const service = new SponsorService(prisma);

export async function createCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const checkpoint = await service.createCheckpoint(req.body);
    res.status(201).json({ ok: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
}

export async function respondToCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const checkpoint = await service.respondToCheckpoint(
      req.params.id,
      req.user!.id,
      req.body,
    );
    res.json({ ok: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
}

export async function skipCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const checkpoint = await service.skipCheckpoint(req.params.id, req.user!.id);
    res.json({ ok: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
}

export async function getCheckpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const checkpoint = await service.getCheckpoint(req.params.id);
    res.json({ ok: true, data: checkpoint });
  } catch (err) {
    next(err);
  }
}

export async function listProjectCheckpoints(req: Request, res: Response, next: NextFunction) {
  try {
    const checkpoints = await service.listByProject(req.params.projectId);
    res.json({ ok: true, data: checkpoints });
  } catch (err) {
    next(err);
  }
}
