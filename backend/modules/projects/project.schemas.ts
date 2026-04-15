import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  cohort: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  riskLevel: z.enum(['Bajo', 'Medio', 'Alto']).optional(),
});

export const updateStep0Schema = z.object({
  nombreParticipante: z.string().optional(),
  rolArea: z.string().optional(),
  origen: z.enum(['', 'problema', 'oportunidad', 'idea', 'explorando', 'otra']).optional(),
  quePasaQueQuieres: z.string().optional(),
  impacta: z.array(z.string()).optional(),
  parteProceso: z.enum(['', 'antes', 'durante', 'despues', 'transversal', 'otra']).optional(),
  impacto3meses: z.enum(['', 'ingresos', 'costos', 'riesgo', 'cliente', 'productividad', 'no_claro', 'otro']).optional(),
  respaldo: z.enum(['', 'datos', 'testimonios', 'benchmark', 'hipotesis', 'otro']).optional(),
  quienEscuchar: z.string().optional(),
  siMinimo: z.array(z.string()).optional(),
  status: z.enum(['No iniciado', 'En progreso', 'Completado']).optional(),
});

export const projectIdParam = z.object({
  id: z.string().uuid(),
});

export const updateSponsorDataSchema = z.object({
  sponsorTouchpoints: z.array(z.record(z.unknown())).optional(),
  sponsorComments: z.array(z.record(z.unknown())).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateStep0Input = z.infer<typeof updateStep0Schema>;
export type UpdateSponsorDataInput = z.infer<typeof updateSponsorDataSchema>;
