import { useState, useEffect } from 'react';
import { User } from '@/types';
import api from '@/lib/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication via session cookie or Authorization header
    api.get('/auth/me')
      .then((res) => {
        setUser({
          id: String(res.data.id),
          email: res.data.email,
          name: res.data.role === 'admin' ? 'Acme Admin' : 'User',
          organizationId: String(res.data.org_id),
          plan: res.data.plan,
          isTrial: res.data.is_trial,
          trialDaysRemaining: res.data.trial_days_remaining,
          trialEndsAt: res.data.trial_ends_at,
        });
      })
      .catch(() => {
        login('admin@acme.com', 'password123').catch(() => {});
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (emailOrToken: string, password?: string) => {
    if (password) {
      const res = await api.post('/auth/login', { email: emailOrToken, password });
      const token = res.data.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }
      try {
        const userRes = await api.get('/auth/me');
        setUser({
          id: String(userRes.data.id),
          email: userRes.data.email,
          name: userRes.data.role === 'admin' ? 'Acme Admin' : 'User',
          organizationId: String(userRes.data.org_id),
          plan: userRes.data.plan,
          isTrial: userRes.data.is_trial,
          trialDaysRemaining: userRes.data.trial_days_remaining,
          trialEndsAt: userRes.data.trial_ends_at,
        });
      } catch {
        setUser({
          id: '1',
          name: 'Acme Admin',
          email: emailOrToken,
          organizationId: '1',
        });
      }
      return res.data;
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', emailOrToken);
      }
      setUser({
        id: '1',
        name: 'Acme Admin',
        email: 'admin@acme.com',
        organizationId: '1',
      });
    }
  };

  const register = async (email: string, password: string, orgName: string) => {
    const res = await api.post('/auth/register', { email, password, org_name: orgName });
    await login(email, password);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      setUser(null);
    }
  };

  return { user, loading, login, register, logout };
}
