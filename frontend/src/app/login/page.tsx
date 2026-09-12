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
      <div className="w-full max-w-sm p-6 bg-[#121214] border border-zinc-800 rounded-lg shadow-xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2.5">
            <Shield className="w-4 h-4 text-zinc-200" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Sign in to BreachGuard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Access your organization security workspace</p>
        </div>

        {error && (
          <div className="p-2.5 mb-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1.5 font-medium">Work email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-700 text-zinc-100 font-mono text-xs"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-zinc-400 font-medium">Password</label>
              <Link href="/forgot-password" className="text-zinc-500 hover:text-zinc-300">Forgot?</Link>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-700 text-zinc-100 font-mono text-xs"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-md transition-colors mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                <span>Authenticating...</span>
              </>
            ) : (
              'Continue to dashboard'
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-zinc-300 hover:text-white underline underline-offset-4">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}