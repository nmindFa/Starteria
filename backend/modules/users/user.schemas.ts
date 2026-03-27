import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  skills: z.array(z.string()).optional(),
  initials: z.string().length(2).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['Owner', 'Editor', 'Viewer']).default('Editor'),
  name: z.string().min(2).max(100).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['Owner', 'Editor', 'Viewer']),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
