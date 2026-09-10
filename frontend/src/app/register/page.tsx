"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm p-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-zinc-100" />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Create your workspace</h1>
          <p className="text-xs text-zinc-400 mt-1">Start monitoring your workforce exposure</p>
          <div className="mt-3 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Includes 7-Day Business Trial &bull; No card required
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Company or workspace name</label>
            <input 
              type="text" 
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-700 text-zinc-100" 
              placeholder="Acme Corp" 
              required 
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Work email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-700 text-zinc-100" 
              placeholder="alex@acme.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-700 text-zinc-100" 
              placeholder="••••••••••••" 
              required 
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg transition-colors mt-3 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Starting 7-day trial...' : 'Start 7-Day Free Trial'}
          </button>
          <p className="text-[11px] text-zinc-500 text-center mt-2 font-normal">Instant activation &bull; Cancel anytime</p>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-850 text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-zinc-300 hover:text-white underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}