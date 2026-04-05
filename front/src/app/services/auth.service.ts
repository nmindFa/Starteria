import api from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'participante' | 'mentor' | 'admin' | 'sponsor' | 'colaborador' | 'viewer';
  initials: string;
  cohort?: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/login', { email, password });
    const result = data.data;
    const token = result.tokens?.accessToken || result.accessToken;
    sessionStorage.setItem('accessToken', token);
    return result;
  },

  async register(name: string, email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
      role: 'participante',
    });
    const result = data.data;
    const token = result.tokens?.accessToken || result.accessToken;
    sessionStorage.setItem('accessToken', token);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('accessToken');
    }
  },

  async getMe(): Promise<AuthUser> {
    const { data } = await api.get('/auth/me');
    return data.data;
  },

  async refreshToken(): Promise<string> {
    const { data } = await api.post('/auth/refresh');
    const token = data.data.accessToken;
    sessionStorage.setItem('accessToken', token);
    return token;
  },

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem('accessToken');
  },
};
