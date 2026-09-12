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
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
      <div className="w-full max-w-sm p-6 bg-[#121214] border border-zinc-800 rounded-lg shadow-xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2.5">
            <Shield className="w-4 h-4 text-zinc-200" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Account Recovery</h1>
          <p className="text-xs text-zinc-400 mt-0.5 text-center">
            Enter your work email to receive a password reset link
          </p>
        </div>

        {error && (
          <div className="p-2.5 mb-3.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
              <MailCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block text-emerald-200 font-semibold mb-1">Check your inbox</strong>
                If an account exists for <span className="text-white font-mono font-medium">{email}</span>, a secure recovery link has been dispatched. The link expires in 60 minutes.
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-md transition-colors text-xs flex items-center justify-center gap-2"
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
                className="w-full px-3 py-2 bg-[#0e0e10] border border-zinc-800 rounded-md focus:outline-none focus:border-zinc-700 text-zinc-100 font-mono text-xs"
                placeholder="you@company.com"
                required
                autoFocus
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
