"use client";

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Loader2, CheckCircle2, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing password reset token. Please request a new link.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: password,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm p-6 bg-[#121214] border border-zinc-800 rounded-lg shadow-xl">
      <div className="flex flex-col items-center mb-5">
        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2.5">
          <KeyRound className="w-4 h-4 text-zinc-200" />
        </div>
        <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Create New Password</h1>
        <p className="text-xs text-zinc-400 mt-0.5 text-center">
          Choose a secure passphrase for your BreachGuard workspace
        </p>
      </div>

      {error && (
        <div className="p-2.5 mb-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block text-emerald-200 font-semibold mb-1">Password updated!</strong>
              Your password has been changed successfully. Redirecting you to sign in...
            </div>
          </div>

          <Link
            href="/login"
            className="w-full py-2 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-md transition-colors text-xs flex items-center justify-center gap-2"
          >
            <span>Continue to sign in</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1.5 font-medium">New password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-700 text-zinc-100 font-mono text-xs"
              placeholder="Minimum 8 characters"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1.5 font-medium">Confirm new password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e0e10] border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-700 text-zinc-100 font-mono text-xs"
              placeholder="Re-enter password"
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
                <span>Updating password...</span>
              </>
            ) : (
              'Reset password'
            )}
          </button>

          <div className="text-center pt-2">
            <Link 
              href="/login" 
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
            >
              Cancel and sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
      <Suspense fallback={
        <div className="p-6 bg-[#121214] border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
          <span className="text-xs font-mono">Loading recovery session...</span>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
