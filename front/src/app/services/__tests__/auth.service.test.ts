import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock the api module: replace the default export with a stub axios-like object
// whose methods are vi.fn(). We also re-export setAccessToken/getAccessToken as
// real spies so we can assert they were called.
const tokenStore: { value: string | null } = { value: null };

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, put, patch, delete: del },
    setAccessToken: vi.fn((t: string | null) => {
      tokenStore.value = t;
    }),
    getAccessToken: vi.fn(() => tokenStore.value),
  };
});

import api, { setAccessToken, getAccessToken } from '../api';
import { authService } from '../auth.service';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('authService', () => {
  beforeEach(() => {
    tokenStore.value = null;
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
    (setAccessToken as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it('login sends credentials and stores accessToken from tokens object', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u1', name: 'A', email: 'a@b.c', role: 'participante', initials: 'A' },
          tokens: { accessToken: 'tok-A', refreshToken: 'r-A' },
        },
      },
    });

    const res = await authService.login('a@b.c', 'pw');

    expect(apiMock.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'pw' });
    expect(setAccessToken).toHaveBeenCalledWith('tok-A');
    expect(res.user.email).toBe('a@b.c');
  });

  it('login falls back to top-level accessToken when tokens object is missing', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u1', name: 'A', email: 'a@b.c', role: 'mentor', initials: 'A' },
          accessToken: 'flat-token',
        },
      },
    });

    await authService.login('a@b.c', 'pw');
    expect(setAccessToken).toHaveBeenCalledWith('flat-token');
  });

  it('register hits /auth/register with role=participante and stores token', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u2', name: 'B', email: 'b@c.d', role: 'participante', initials: 'B' },
          tokens: { accessToken: 'tok-B', refreshToken: 'r-B' },
        },
      },
    });

    const res = await authService.register('B', 'b@c.d', 'pw');

    expect(apiMock.post).toHaveBeenCalledWith('/auth/register', {
      name: 'B',
      email: 'b@c.d',
      password: 'pw',
      role: 'participante',
    });
    expect(setAccessToken).toHaveBeenCalledWith('tok-B');
    expect(res.user.id).toBe('u2');
  });

  it('register also accepts top-level accessToken shape', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u3', name: 'C', email: 'c@d.e', role: 'participante', initials: 'C' },
          accessToken: 'flat-reg-token',
        },
      },
    });
    await authService.register('C', 'c@d.e', 'pw');
    expect(setAccessToken).toHaveBeenCalledWith('flat-reg-token');
  });

  it('logout calls backend and clears token even on error', async () => {
    tokenStore.value = 'still-here';
    apiMock.post.mockRejectedValueOnce(new Error('network'));
    await expect(authService.logout()).rejects.toThrow('network');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('logout clears token on success too', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true } });
    await authService.logout();
    expect(apiMock.post).toHaveBeenCalledWith('/auth/logout');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('getMe returns user payload', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { data: { id: 'u9', name: 'Z', email: 'z@a.b', role: 'admin', initials: 'Z' } },
    });
    const me = await authService.getMe();
    expect(apiMock.get).toHaveBeenCalledWith('/auth/me');
    expect(me.role).toBe('admin');
  });

  it('refreshToken stores and returns new token', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { data: { accessToken: 'new-rotated' } },
    });
    const t = await authService.refreshToken();
    expect(t).toBe('new-rotated');
    expect(setAccessToken).toHaveBeenCalledWith('new-rotated');
  });

  it('isAuthenticated reflects token presence', () => {
    expect(authService.isAuthenticated()).toBe(false);
    tokenStore.value = 'x';
    expect(authService.isAuthenticated()).toBe(true);
    expect(getAccessToken).toHaveBeenCalled();
  });
});
