"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Shield, FileText, Check, Loader2, Building, Mail, 
  CreditCard, CheckCircle2, ArrowRight, DollarSign, Calendar
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface InvoiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: 'business' | 'enterprise';
  defaultPlan?: 'business' | 'enterprise';
}

export function InvoiceRequestModal({ 
  isOpen, 
  onClose, 
  initialPlan,
  defaultPlan = 'enterprise'
}: InvoiceRequestModalProps) {
  const { user } = useAuth();
  const effectiveDefault = initialPlan || defaultPlan || 'enterprise';

  const [companyName, setCompanyName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'business' | 'enterprise'>(effectiveDefault);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderSummary, setOrderSummary] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (user?.org_name) setCompanyName(user.org_name);
      else if (user?.name) setCompanyName(user.name);
      if (user?.email) setBillingEmail(user.email);
      setSelectedPlan(effectiveDefault);
      setIsSuccess(false);
      setError(null);
    }
  }, [isOpen, user, effectiveDefault]);

  if (!isOpen) return null;

  const pricing = {
    business: {
      annual: { total: '$2,438', perMonth: '$203', badge: 'Save 15%' },
      monthly: { total: '$239', perMonth: '$239', badge: 'Billed Monthly' }
    },
    enterprise: {
      annual: { total: '$9,170', perMonth: '$764', badge: 'Save 15% (Recommended)' },
      monthly: { total: '$899', perMonth: '$899', badge: 'Billed Monthly' }
    }
  };

  const currentPricing = pricing[selectedPlan][billingCycle];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !billingEmail.trim()) {
      setError('Please provide company legal name and billing contact email.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/billing/invoice-request', {
        company_name: companyName.trim(),
        billing_email: billingEmail.trim(),
        plan: selectedPlan,
        billing_cycle: billingCycle,
        po_number: poNumber.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setOrderSummary(res.data?.order_summary || {
        company_name: companyName,
        billing_email: billingEmail,
        plan: selectedPlan,
        billing_cycle: billingCycle,
        investment_total: currentPricing.total
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit invoice request. Please verify network or login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Enterprise Procurement &amp; Invoicing</h3>
              <p className="text-[11px] text-zinc-400">Corporate Purchase Orders &bull; Net-30 International Wire / ACH</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          /* Success State */
          <div className="p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-white">Order &amp; Invoice Request Received</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                A formal Pro-Forma Invoice and SWIFT/ACH wire transfer coordinates have been dispatched to:
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-emerald-300">
                {orderSummary?.billing_email}
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-zinc-400">
                <span>Organization:</span>
                <span className="font-medium text-white">{orderSummary?.company_name}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>License Tier:</span>
                <span className="font-semibold text-indigo-300 uppercase">{orderSummary?.plan} Plan</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Payment Terms:</span>
                <span className="text-zinc-200 font-mono">Net-30 Corporate Wire / ACH</span>
              </div>
              <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                <span className="font-semibold text-white">Total Amount:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{orderSummary?.investment_total}</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Your security workspace remains active while your accounting team processes the invoice.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              Return to Console
            </button>
          </div>
        ) : (
          /* Request Form */
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Plan Selector Pills */}
            <div>
              <label className="block text-zinc-400 mb-1.5 font-medium">Select License Tier</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('business')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'business'
                      ? 'bg-zinc-800/90 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <div className="font-semibold text-xs text-white">Business Tier</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">3 Domains &bull; 25 Identities</div>
                  <div className="text-xs font-semibold text-zinc-200 mt-1 font-mono">$239<span className="text-[10px] font-normal text-zinc-500">/mo</span></div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                    selectedPlan === 'enterprise'
                      ? 'bg-zinc-800/90 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <div className="font-semibold text-xs text-white flex items-center justify-between">
                    <span>Enterprise / MSP</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">POPULAR</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Unlimited Assets &bull; Continuous ASM</div>
                  <div className="text-xs font-semibold text-indigo-300 mt-1 font-mono">$899<span className="text-[10px] font-normal text-zinc-500">/mo</span></div>
                </button>
              </div>
            </div>

            {/* Cadence Selector */}
            <div>
              <label className="block text-zinc-400 mb-1.5 font-medium">Billing Cadence</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                    billingCycle === 'annual'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <span className="font-medium text-xs">Annual License</span>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Save 15%</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                    billingCycle === 'monthly'
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <span className="font-medium text-xs">Monthly Billing</span>
                  <span className="text-[10px] text-zinc-500">Standard</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Legal Company Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Cybersecurity Corp"
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                  />
                  <Building className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Billing Contact Email *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="ap@company.com"
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                  />
                  <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Purchase Order (PO) Number <span className="text-zinc-600 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO-2026-XXXX"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Tax / VAT ID <span className="text-zinc-600 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="EU / US Tax Identifier"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Pricing Callout Banner */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-zinc-500">Total Invoice Amount ({billingCycle}):</div>
                <div className="text-base font-bold text-white font-mono mt-0.5">
                  {currentPricing.total} <span className="text-xs text-zinc-400 font-normal">USD</span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Net-30 Terms &bull; SWIFT / ACH Wire
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Issuing Invoice Request...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Net-30 Invoice</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
