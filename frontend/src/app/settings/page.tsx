"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { useState, useRef, useEffect } from 'react';
import { 
  User, Bell, CreditCard, Check, Loader2, Send, 
  Upload, Sparkles, Image as ImageIcon, Trash2, AlertCircle, CheckCircle2,
  Users, Plus, Shield, X, ExternalLink, ShieldCheck, UserPlus, FileText
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useIntegrationsSettings, useTestSlackWebhook, useUpdateIntegrations } from '@/hooks/useApi';
import api from '@/lib/api';
import { InvoiceRequestModal } from '@/components/InvoiceRequestModal';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  // Current user / organization details
  const [userMe, setUserMe] = useState<any>(null);
  const [orgName, setOrgName] = useState('Acme CyberCorp');
  const [adminEmail, setAdminEmail] = useState('admin@acme.com');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessNotice, setProfileSuccessNotice] = useState(false);

  // Integrations state & hooks
  const { data: integrationsData } = useIntegrationsSettings();
  const testSlackMutation = useTestSlackWebhook();
  const updateIntegrationsMutation = useUpdateIntegrations();

  const [slackWebhook, setSlackWebhook] = useState('');
  const [siemWebhook, setSiemWebhook] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Team Management state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst' | 'member'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessNotice, setInviteSuccessNotice] = useState<{ email: string; tempPass?: string } | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  // Billing state
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState<'business' | 'enterprise'>('business');

  // Load User & Org info
  const fetchUserMe = async () => {
    try {
      const res = await api.get('/auth/me');
      setUserMe(res.data);
      if (res.data.org_name) setOrgName(res.data.org_name);
      if (res.data.email) setAdminEmail(res.data.email);
    } catch {
      // ignore
    }
  };

  const fetchTeamMembers = async () => {
    setIsTeamLoading(true);
    try {
      const res = await api.get('/team/members');
      setTeamMembers(res.data);
    } catch {
      // ignore
    } finally {
      setIsTeamLoading(false);
    }
  };

  useEffect(() => {
    fetchUserMe();
    fetchTeamMembers();
  }, []);

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

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.patch('/settings/organization', { name: orgName.trim() });
      setProfileSuccessNotice(true);
      showToast('success', 'Organization profile updated successfully.');
      setTimeout(() => setProfileSuccessNotice(false), 4000);
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to update organization profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Team Invite Handler
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await api.post('/team/members', { email: inviteEmail.trim(), role: inviteRole });
      setInviteSuccessNotice({
        email: inviteEmail.trim(),
        tempPass: res.data?.temporary_password,
      });
      setInviteEmail('');
      setIsInviteModalOpen(false);
      showToast('success', `Team member ${inviteEmail} invited.`);
      fetchTeamMembers();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to invite team member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from the organization? They will immediately lose access to the workspace.`)) return;
    try {
      setDeletingMemberId(id);
      await api.delete(`/team/members/${id}`);
      showToast('success', `Member ${email} removed.`);
      fetchTeamMembers();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to remove member.');
    } finally {
      setDeletingMemberId(null);
    }
  };

  // Billing Actions
  const handleStripeCheckout = async (priceId: string) => {
    setIsCheckoutLoading(priceId);
    try {
      const res = await api.post('/billing/checkout', { price_id: priceId });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to initiate checkout.');
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleStripePortal = async () => {
    setIsPortalLoading(true);
    try {
      const res = await api.post('/billing/portal');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || 'Failed to access billing portal.');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Organization', icon: User },
    { id: 'team', label: 'Team Members', icon: Users },
    { id: 'integrations', label: 'Notification Channels', icon: Bell },
    { id: 'billing', label: 'Subscription & Billing', icon: CreditCard },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="pb-4 border-b border-zinc-900 mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Organization Settings</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">Manage team access, notification hooks, and subscription plans.</p>
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

        {/* Tabs Navigation */}
        <div className="flex gap-2 border-b border-zinc-800 pb-px mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap",
                  isActive
                    ? "border-white text-white bg-zinc-900/60"
                    : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {/* 1. Profile / Organization Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-xl text-xs">
              <div className="space-y-1.5">
                <label className="block text-zinc-300 font-medium">Organization Name</label>
                <input 
                  type="text" 
                  value={orgName} 
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-roboto text-zinc-200 focus:outline-none focus:border-zinc-700" 
                />
                <p className="text-[11px] text-zinc-500">
                  Displayed on executive security audit reports and team notifications.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-300 font-medium">Admin Contact Email</label>
                <input 
                  type="email" 
                  value={adminEmail} 
                  disabled
                  className="w-full px-3 py-2 bg-zinc-950/50 border border-zinc-850 rounded-lg text-xs font-roboto text-zinc-400 cursor-not-allowed" 
                />
                <p className="text-[11px] text-zinc-500">
                  Primary security operations contact receiving critical breach alerts.
                </p>
              </div>

              {/* Co-Branded Report Logo */}
              <div className="space-y-2 pt-4 border-t border-zinc-850">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-zinc-300 font-medium text-xs">
                      Executive Report Logo
                    </label>
                    <p className="text-[11px] text-zinc-500">
                      Upload PNG or JPG image for branded executive PDF audit reports.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Included in All Plans
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
                      <span className="text-[10px] font-roboto">No Logo</span>
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
                  <span>Organization preferences saved.</span>
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
                    'Save changes'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 2. Team Members Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Team Access &amp; Roles</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Authorize coworkers to collaborate on threat intelligence, attack surface management, and breach response.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite Teammate
                </button>
              </div>

              {/* Temporary Password Notice */}
              {inviteSuccessNotice && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-3 shadow-lg">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">
                    <strong className="block text-white font-semibold mb-1">
                      Teammate {inviteSuccessNotice.email} has been provisioned
                    </strong>
                    {inviteSuccessNotice.tempPass ? (
                      <div>
                        Temporary sign-in password: <span className="font-roboto text-white font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-750">{inviteSuccessNotice.tempPass}</span>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          An automated invitation email was dispatched. Share this temporary password if your outbound email delivery is restricted.
                        </p>
                      </div>
                    ) : (
                      <span>An invitation email has been dispatched with sign-in instructions.</span>
                    )}
                  </div>
                  <button onClick={() => setInviteSuccessNotice(null)} className="text-zinc-400 hover:text-white text-xs cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* Members Table */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                {isTeamLoading ? (
                  <div className="p-8 flex items-center justify-center text-zinc-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                    <span className="text-xs font-roboto">Loading organization members...</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4 hidden sm:table-cell">Added Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-roboto font-semibold text-zinc-200 uppercase text-xs shrink-0">
                                {member.email.charAt(0)}
                              </div>
                              <div>
                                <div className="font-roboto text-white font-medium flex items-center gap-1.5">
                                  {member.email}
                                  {member.is_current_user && (
                                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-roboto bg-zinc-800 text-zinc-300 border border-zinc-700">
                                      You
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10.5px] font-roboto font-semibold uppercase tracking-wider inline-flex items-center gap-1",
                              member.role === 'admin'
                                ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                                : member.role === 'analyst'
                                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                            )}>
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-400 font-roboto text-[11px] hidden sm:table-cell">
                            {formatDate(member.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {member.is_current_user ? (
                              <span className="text-[11px] text-zinc-600 italic">Current Session</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id, member.email)}
                                disabled={deletingMemberId === member.id}
                                className="text-zinc-500 hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
                              >
                                {deletingMemberId === member.id ? 'Removing...' : 'Revoke'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 3. Notification Channels Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 max-w-xl text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-300 font-medium text-xs">
                    Slack Incident Webhook
                  </label>
                  <span className="text-[11px] text-zinc-500 font-roboto">Incoming Webhook</span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input 
                    type="url" 
                    value={slackWebhook} 
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..." 
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-roboto text-zinc-200 focus:outline-none focus:border-zinc-700" 
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
                  <span className="text-[11px] text-zinc-500 font-roboto">JSON Ingest</span>
                </div>
                <input 
                  type="url" 
                  value={siemWebhook}
                  onChange={(e) => setSiemWebhook(e.target.value)}
                  placeholder="https://siem.company.com/api/v1/ingest" 
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-roboto text-xs focus:outline-none focus:border-zinc-700" 
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

          {/* 4. Subscription & Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6 text-xs max-w-2xl">
              <div className="p-5 border border-zinc-800 bg-zinc-950 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-100 text-sm capitalize">
                      {userMe?.plan ? `${userMe.plan} Plan` : 'Business Plan'}
                    </h4>
                    {userMe?.is_trial && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-roboto font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Trial ({userMe?.trial_days_remaining ?? 7} days left)
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">
                    {userMe?.plan === 'enterprise'
                      ? '$899 / month • 15 domains, continuous scanning, unlimited identities'
                      : '$239 / month • 3 domains, 25 privileged identities • Billed monthly'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-300 text-xs font-roboto font-semibold uppercase tracking-wider rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)] self-start sm:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  Active
                </span>
              </div>

              {/* Plan Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 border border-zinc-800 bg-zinc-900/40 rounded-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="text-white font-semibold text-sm">Business Security</div>
                    <div className="text-2xl font-bold text-white mt-2 font-roboto">$239<span className="text-xs text-zinc-400 font-normal"> / mo</span></div>
                    <ul className="mt-3 space-y-2 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Up to 3 Monitored Domains</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> 25 Privileged Identities</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Daily Automated Scans</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Executive PDF Audit Reports</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoicePlan('business');
                      setIsInvoiceModalOpen(true);
                    }}
                    disabled={userMe?.plan === 'business'}
                    className={`w-full py-2 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs ${
                      userMe?.plan === 'business'
                        ? 'bg-zinc-800/80 text-emerald-400 border border-emerald-500/20 cursor-default'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 cursor-pointer disabled:opacity-50'
                    }`}
                  >
                    {userMe?.plan === 'business' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Current Plan</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Request Business Invoice</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-5 border border-indigo-500/40 bg-zinc-900/70 rounded-xl flex flex-col justify-between space-y-4 relative shadow-[0_0_20px_rgba(99,102,241,0.08)]">
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                    Recommended
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Enterprise / MSP</div>
                    <div className="text-2xl font-bold text-white mt-2 font-roboto">$899<span className="text-xs text-zinc-400 font-normal"> / mo</span></div>
                    <ul className="mt-3 space-y-2 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Up to 15 Monitored Domains</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Multi-Tenant Client Portals</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> Continuous 1-Hour Threat Cadence</li>
                      <li className="flex items-center gap-1.5 text-zinc-300"><Check className="w-3.5 h-3.5 text-emerald-400" /> SIEM &amp; Splunk JSON Hooks</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoicePlan('enterprise');
                      setIsInvoiceModalOpen(true);
                    }}
                    disabled={userMe?.plan === 'enterprise'}
                    className={`w-full py-2 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md text-xs ${
                      userMe?.plan === 'enterprise'
                        ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-50'
                    }`}
                  >
                    {userMe?.plan === 'enterprise' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Current Active Plan</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-white" />
                        <span>Request Enterprise Invoice</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Corporate Invoicing & Wire Coordinates */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800">
                <div className="space-y-0.5">
                  <span className="text-zinc-300 text-xs font-medium block">
                    Enterprise Procurement &amp; Wire Settlement (Net-30)
                  </span>
                  <span className="text-zinc-500 text-[11px] block">
                    Need a formal invoice, vendor W-9 packet, or direct SWIFT/ACH corporate wire coordinates?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInvoicePlan(userMe?.plan === 'enterprise' ? 'enterprise' : 'business');
                    setIsInvoiceModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Generate Corporate Invoice</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Invite Team Member</h3>
              </div>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">Work Email Address</label>
                <input 
                  type="email"
                  placeholder="analyst@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="analyst">Analyst (View &amp; scan telemetry, generate audit reports)</option>
                  <option value="admin">Administrator (Full access, billing, and team management)</option>
                  <option value="member">Member (Read-only dashboard access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Inviting...</span>
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enterprise Procurement & Invoicing Modal */}
      <InvoiceRequestModal 
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        defaultPlan={invoicePlan}
      />
    </DashboardLayout>
  );
}