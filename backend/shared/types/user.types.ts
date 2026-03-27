export type Role = 'owner' | 'mentor' | 'admin' | 'leader';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  skills: string[];
  cohort?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  status: 'Activo' | 'Pendiente';
  initials: string;
}
