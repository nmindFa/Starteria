import { z } from 'zod';

export const stepParams = z.object({
  projectId: z.string().uuid(),
  number: z.coerce.number().int().min(1).max(4),
});

export const updateStepStatusSchema = z.object({
  status: z.enum([
    'No iniciado', 'En progreso', 'Enviado',
    'Feedback IA', 'Ajustado', 'Sesion experto pendiente',
    'Aprobado', 'Bloqueado',
  ]),
});

export const updateModuleSchema = z.object({
  status: z.enum([
    'Draft', 'En progreso', 'Completado', 'Bloqueado',
    'Enviado', 'Feedback IA', 'Ajustado', 'Aprobado',
  ]).optional(),
  data: z.record(z.unknown()).optional(),
});

export const saveStepDataSchema = z.record(z.unknown());

export const submitAiReviewSchema = z.object({
  stepNumber: z.number().int().min(1).max(4).optional(),
});

export const requestSessionSchema = z.object({
  preferredDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateStepStatusInput = z.infer<typeof updateStepStatusSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
