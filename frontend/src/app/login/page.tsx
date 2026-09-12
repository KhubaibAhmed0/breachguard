"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err?.message === 'Network Error' || !err?.response) {
        setError('Unable to connect to authentication server. Please check your network or server connectivity.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
      <div className="w-full max-w-sm p-6 bg-bg-surface border border-border-default rounded-lg shadow-xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-8 h-8 rounded bg-bg-surface border border-border-default flex items-center justify-center mb-2.5">
            <Shield className="w-4 h-4 text-text-secondary" />
          </div>
          <h1 className="text-sm font-semibold text-text-primary tracking-tight">Sign in to BreachGuard</h1>
          <p className="text-xs text-text-muted mt-0.5">Access your organization security workspace</p>
        </div>

        {error && (
          <div className="p-2.5 mb-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-text-muted mb-1.5 font-medium">Work email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-border-default rounded-md focus:outline-none focus:border-border-strong text-text-primary font-mono text-xs"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-text-muted font-medium">Password</label>
              <Link href="/forgot-password" className="text-text-faint hover:text-text-secondary">Forgot?</Link>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-border-default rounded-md focus:outline-none focus:border-border-strong text-text-primary font-mono text-xs"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-accent-text font-medium rounded-md transition-colors mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
                <span>Authenticating...</span>
              </>
            ) : (
              'Continue to dashboard'
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-border-default text-center text-xs text-text-faint">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-text-secondary hover:text-text-primary underline underline-offset-4">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}