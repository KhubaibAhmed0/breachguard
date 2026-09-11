"use client";

import Link from 'next/link';
import { Shield, Loader2, ArrowLeft, MailCheck, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to dispatch reset email. Please try again.');
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
          <h1 className="text-lg font-semibold text-white tracking-tight">Account Recovery</h1>
          <p className="text-xs text-zinc-400 mt-1 text-center">
            Enter your work email to receive a password reset link
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <MailCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block text-emerald-200 font-semibold mb-1">Check your inbox</strong>
                If an account exists for <span className="text-white font-roboto font-medium">{email}</span>, a secure recovery link has been dispatched. The link expires in 60 minutes.
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to sign in</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1.5 font-medium">Work email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-700 text-zinc-100 font-roboto text-xs"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg transition-colors mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Dispatching reset link...</span>
                </>
              ) : (
                'Send password reset link'
              )}
            </button>

            <div className="text-center pt-2">
              <Link 
                href="/login" 
                className="text-zinc-500 hover:text-zinc-300 text-xs inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
