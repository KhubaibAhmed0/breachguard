"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, orgName);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
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
          <h1 className="text-sm font-semibold text-text-primary tracking-tight">Create your workspace</h1>
          <p className="text-xs text-text-muted mt-0.5">Start monitoring your workforce exposure</p>
          <div className="mt-2.5 px-2 py-1 rounded bg-[#0e0e10] border border-border-default text-text-secondary text-2xs font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Includes 7-Day Business Trial &bull; No card required
          </div>
        </div>

        {error && (
          <div className="p-2.5 mb-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-text-muted mb-1 font-medium">Company or workspace name</label>
            <input 
              type="text" 
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-border-default rounded-md focus:outline-none focus:border-border-strong text-text-primary font-mono text-xs" 
              placeholder="Acme Corp" 
              required 
            />
          </div>
          <div>
            <label className="block text-text-muted mb-1 font-medium">Work email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-border-default rounded-md focus:outline-none focus:border-border-strong text-text-primary font-mono text-xs" 
              placeholder="alex@acme.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-text-muted mb-1 font-medium">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-border-default rounded-md focus:outline-none focus:border-border-strong text-text-primary font-mono text-xs" 
              placeholder="••••••••••••" 
              required 
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-accent-text font-medium rounded-md transition-colors mt-3 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
                <span>Starting 7-day trial...</span>
              </>
            ) : (
              'Start 7-Day Free Trial'
            )}
          </button>
          <p className="text-2xs text-text-faint text-center mt-2 font-normal">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-text-muted hover:text-text-primary underline underline-offset-2">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-text-muted hover:text-text-primary underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </form>

        <div className="mt-5 pt-4 border-t border-border-default text-center text-xs text-text-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-text-secondary hover:text-text-primary underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}