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
    <div className="fixed inset-0 z-50 bg-bg-overlay backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-bg-surface border border-border-default rounded-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-default flex items-center justify-between bg-bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-border-strong border border-border-strong flex items-center justify-center text-text-secondary">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Enterprise Procurement &amp; Invoicing</h3>
              <p className="text-2xs text-text-muted">Corporate Purchase Orders &bull; Net-30 International Wire / ACH</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-text-faint hover:text-text-secondary p-1 rounded-md hover:bg-border-strong transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          /* Success State */
          <div className="p-5 sm:p-6 space-y-5 text-center overflow-y-auto flex-1">
            <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-text-primary">Order &amp; Invoice Request Received</h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                A formal Pro-Forma Invoice and SWIFT/ACH wire transfer coordinates have been dispatched to:
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-bg-base border border-border-default rounded-md text-xs font-mono text-text-secondary">
                {orderSummary?.billing_email}
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 bg-bg-surface border border-border-default rounded-lg text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-text-muted">
                <span>Organization:</span>
                <span className="font-medium text-text-secondary">{orderSummary?.company_name}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>License Tier:</span>
                <span className="font-mono text-text-secondary uppercase">{orderSummary?.plan} Plan</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Payment Terms:</span>
                <span className="text-text-secondary font-mono">Net-30 Corporate Wire / ACH</span>
              </div>
              <div className="flex justify-between text-text-muted pt-2 border-t border-border-default">
                <span className="font-medium text-text-secondary">Total Amount:</span>
                <span className="font-semibold text-text-primary font-mono text-sm">{orderSummary?.investment_total}</span>
              </div>
            </div>

            <p className="text-2xs text-text-faint max-w-sm mx-auto leading-relaxed">
              Your security workspace remains active while your accounting team processes the invoice.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2 bg-border-strong hover:bg-border-strong text-text-primary font-medium text-xs rounded-md transition-colors cursor-pointer"
            >
              Return to Console
            </button>
          </div>
        ) : (
          /* Request Form */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
            
            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Plan Selector */}
            <div>
              <label className="block text-text-muted mb-1.5 font-medium">Select License Tier</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('business')}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    selectedPlan === 'business'
                      ? 'bg-bg-hover border-border-strong text-text-primary'
                      : 'bg-bg-surface border-border-default text-text-muted hover:bg-bg-hover'
                  }`}
                >
                  <div className="font-medium text-xs text-text-secondary">Business Tier</div>
                  <div className="text-2xs text-text-muted mt-0.5">3 Domains &bull; 25 Identities</div>
                  <div className="text-xs font-semibold text-text-primary mt-1 font-mono">$239<span className="text-2xs font-normal text-text-faint">/mo</span></div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    selectedPlan === 'enterprise'
                      ? 'bg-bg-hover border-border-strong text-text-primary'
                      : 'bg-bg-surface border-border-default text-text-muted hover:bg-bg-hover'
                  }`}
                >
                  <div className="font-medium text-xs text-text-secondary flex items-center justify-between">
                    <span>Enterprise / MSP</span>
                    <span className="text-2xs px-1.5 py-0.5 bg-border-strong text-text-secondary rounded border border-border-strong font-mono">POPULAR</span>
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">Unlimited Assets &bull; Continuous ASM</div>
                  <div className="text-xs font-semibold text-text-primary mt-1 font-mono">$899<span className="text-2xs font-normal text-text-faint">/mo</span></div>
                </button>
              </div>
            </div>

            {/* Cadence Selector */}
            <div>
              <label className="block text-text-muted mb-1.5 font-medium">Billing Cadence</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-2 rounded-md border text-left transition-colors cursor-pointer flex items-center justify-between ${
                    billingCycle === 'annual'
                      ? 'bg-border-strong border-border-strong text-text-primary'
                      : 'bg-bg-surface border-border-default text-text-muted hover:bg-bg-inset'
                  }`}
                >
                  <span className="font-medium text-xs">Annual License</span>
                  <span className="text-2xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Save 15%</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-2 rounded-md border text-left transition-colors cursor-pointer flex items-center justify-between ${
                    billingCycle === 'monthly'
                      ? 'bg-border-strong border-border-strong text-text-primary'
                      : 'bg-bg-surface border-border-default text-text-muted hover:bg-bg-inset'
                  }`}
                >
                  <span className="font-medium text-xs">Monthly Billing</span>
                  <span className="text-2xs font-mono text-text-faint">Standard</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-text-muted mb-1 font-medium">Legal Company Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Cybersecurity Corp"
                    className="w-full pl-8 pr-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary text-xs focus:outline-none focus:border-border-strong"
                  />
                  <Building className="w-3.5 h-3.5 text-text-faint absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-text-muted mb-1 font-medium">Billing Contact Email *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="ap@company.com"
                    className="w-full pl-8 pr-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary text-xs focus:outline-none focus:border-border-strong"
                  />
                  <Mail className="w-3.5 h-3.5 text-text-faint absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-text-muted mb-1 font-medium">Purchase Order (PO) Number <span className="text-text-muted font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO-2026-XXXX"
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary text-xs focus:outline-none focus:border-border-strong font-mono"
                />
              </div>

              <div>
                <label className="block text-text-muted mb-1 font-medium">Tax / VAT ID <span className="text-text-muted font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="EU / US Tax Identifier"
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary text-xs focus:outline-none focus:border-border-strong font-mono"
                />
              </div>
            </div>

            {/* Pricing Callout Banner */}
            <div className="p-3 rounded-lg bg-bg-base border border-border-default flex items-center justify-between">
              <div>
                <div className="text-2xs text-text-muted">Total Invoice Amount ({billingCycle}):</div>
                <div className="text-sm font-semibold text-text-primary font-mono mt-0.5">
                  {currentPricing.total} <span className="text-xs text-text-muted font-normal font-sans">USD</span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-2xs font-mono bg-bg-surface border border-border-default text-text-muted">
                  Net-30 Terms &bull; SWIFT / ACH Wire
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md text-text-muted hover:text-text-secondary border border-border-default hover:bg-bg-hover text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
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
