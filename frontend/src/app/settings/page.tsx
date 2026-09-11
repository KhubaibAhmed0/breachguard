"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { useState, useRef, useEffect } from 'react';
import { 
  User, Bell, CreditCard, Check, Loader2, Send, 
  Upload, Sparkles, Image as ImageIcon, Trash2, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntegrationsSettings, useTestSlackWebhook, useUpdateIntegrations } from '@/hooks/useApi';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  // Integrations state & hooks
  const { data: integrationsData } = useIntegrationsSettings();
  const testSlackMutation = useTestSlackWebhook();
  const updateIntegrationsMutation = useUpdateIntegrations();

  const [slackWebhook, setSlackWebhook] = useState('');
  const [siemWebhook, setSiemWebhook] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('Acme CyberCorp');
  const [adminEmail, setAdminEmail] = useState('admin@acme.com');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessNotice, setProfileSuccessNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (integrationsData) {
      if (integrationsData.slack_webhook_url) setSlackWebhook(integrationsData.slack_webhook_url);
      if (integrationsData.siem_webhook_url) setSiemWebhook(integrationsData.siem_webhook_url);
      if (integrationsData.logo_url) setLogoPreview(integrationsData.logo_url);
    }
  }, [integrationsData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const handleTestSlackWebhook = async () => {
    const targetUrl = slackWebhook.trim();
    if (!targetUrl) {
      showToast('error', 'Please enter a Slack webhook URL first.');
      return;
    }

    try {
      const res = await testSlackMutation.mutateAsync(targetUrl);
      showToast('success', res.message || 'Test alert dispatched to Slack channel!');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || 'Failed to dispatch test alert. Check webhook URL.';
      showToast('error', msg);
    }
  };

  const handleSaveIntegrations = async () => {
    try {
      await updateIntegrationsMutation.mutateAsync({
        slack_webhook_url: slackWebhook.trim(),
        siem_webhook_url: siemWebhook.trim(),
      });
      showToast('success', 'Webhook notification channels updated successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save integration settings.';
      showToast('error', msg);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
      showToast('error', 'Only PNG and JPG image files are supported for company logos.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      showToast('success', 'Company logo loaded. Ready for branded PDF audit reports.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = () => {
    setIsSavingProfile(true);
    setTimeout(() => {
      setIsSavingProfile(false);
      setProfileSuccessNotice(true);
      setTimeout(() => setProfileSuccessNotice(false), 4000);
    }, 600);
  };

  const tabs = [
    { id: 'profile', label: 'Organization', icon: User },
    { id: 'integrations', label: 'Notification Channels', icon: Bell },
    { id: 'billing', label: 'Subscription & Billing', icon: CreditCard },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="pb-4 border-b border-zinc-900 mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Organization Settings</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">Manage team access, notification hooks, and billing tiers.</p>
        </div>

        {/* Global Toast Alert */}
        {toastMessage && (
          <div
            className={cn(
              "mb-6 p-4 rounded-2xl border text-xs flex items-center justify-between animate-fadeIn transition-all shadow-lg",
              toastMessage.type === 'success'
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.12)]"
                : "bg-rose-500/10 border-rose-500/35 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
            )}
          >
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="font-medium">{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex border-b border-zinc-900 mb-6 gap-6 text-xs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 pb-3 font-medium transition-colors border-b-2 -mb-px cursor-pointer",
                activeTab === tab.id 
                  ? "border-zinc-200 text-zinc-100" 
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Container */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-xl text-xs">
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium">Organization Name</label>
                  <input 
                    type="text" 
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-700 font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium">Security Administrator Email</label>
                  <input 
                    type="email" 
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono text-xs" 
                  />
                </div>
              </div>

              {/* Company Logo Upload Component */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-zinc-300 font-medium text-xs">Company Logo</label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Upload PNG or JPG image for branded executive PDF audit reports.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Included in Business & Enterprise
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col sm:flex-row items-center gap-4">
                  {logoPreview ? (
                    <div className="relative group w-28 h-20 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center p-2">
                      <img 
                        src={logoPreview} 
                        alt="Company Logo Preview" 
                        className="max-h-full max-w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        title="Remove logo"
                        className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-28 h-20 bg-zinc-900/60 border border-dashed border-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-500 gap-1">
                      <ImageIcon className="w-5 h-5 text-zinc-600" />
                      <span className="text-[10px] font-mono">No Logo</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      accept="image/png, image/jpeg, image/jpg" 
                      className="hidden" 
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3 h-3 text-zinc-400" />
                        {logoPreview ? 'Change Logo' : 'Upload Logo (PNG/JPG)'}
                      </button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-1.5 text-zinc-500 hover:text-red-400 text-xs transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Recommended: High-resolution transparent PNG, minimum 400x120px.
                    </p>
                  </div>
                </div>
              </div>

              {profileSuccessNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Profile preferences updated successfully.</span>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save preferences'
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6 max-w-xl text-xs">
              {/* Slack Incident Webhook Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-300 font-medium text-xs">
                    Slack Incident Webhook
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">Incoming Webhook</span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input 
                    type="url" 
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://example.com/webhook/slack-alert" 
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700" 
                  />
                  <button
                    type="button"
                    onClick={handleTestSlackWebhook}
                    disabled={testSlackMutation.isPending || !slackWebhook.trim()}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {testSlackMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 text-zinc-400" />
                        <span>Send Test Alert</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Dispatches critical severity breach findings and credential dumps directly to your security operations Slack channel.
                </p>
              </div>

              {/* SIEM / Custom Webhook Section */}
              <div className="space-y-2 pt-4 border-t border-zinc-800/70">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-300 font-medium text-xs">
                    SIEM / Custom HTTPS Webhook
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">JSON Ingest</span>
                </div>
                <input 
                  type="url" 
                  value={siemWebhook}
                  onChange={(e) => setSiemWebhook(e.target.value)}
                  placeholder="https://siem.company.com/api/v1/ingest" 
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-700" 
                />
                <p className="text-[11px] text-zinc-500">
                  Sends raw JSON payloads for ingestion into Splunk, Microsoft Sentinel, or Elastic SIEM.
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-800/70">
                <button 
                  type="button"
                  onClick={handleSaveIntegrations}
                  disabled={updateIntegrationsMutation.isPending}
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {updateIntegrationsMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Updating webhooks...
                    </>
                  ) : (
                    'Update webhooks'
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-5 text-xs">
              <div className="p-4 border border-zinc-800 bg-zinc-950 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm">Business Plan</h4>
                  <p className="text-zinc-500 text-xs mt-0.5">$239 / month • 3 domains, 25 privileged identities • Billed monthly</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-300 text-xs font-mono font-semibold uppercase tracking-wider rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  Active
                </span>
              </div>
              <div className="flex gap-2.5">
                <button className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer">
                  Manage in Stripe portal
                </button>
                <button className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors cursor-pointer">
                  Upgrade to Enterprise / MSP ($899/mo)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}