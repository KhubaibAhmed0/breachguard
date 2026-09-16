"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { 
  useGrowthStats, 
  useGrowthLeads, 
  useGrowthSocial, 
  useCreateLead, 
  useBulkImportLeads, 
  useScanLead, 
  useScanAllLeads, 
  useUpdateLead, 
  useDeleteLead, 
  useSendLeadEmail, 
  useSendBatchLeads, 
  useCreateSocialPost, 
  useUpdateSocialPost, 
  useDeleteSocialPost,
  useSeedSocialPosts,
  useGoogleSheetConfig,
  useSaveGoogleSheetConfig,
  useSyncGoogleSheet,
  useProspectSignals,
  useTriggerRadarScan,
  useIngestRadarUrl,
  useConvertSignalToLead,
  usePushSignalToSheet,
  useBatchConvertSignals,
  useUpdateSignalStatus
} from '@/hooks/useApi';
import { OutreachLead, SocialPost, ProspectSignal } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { 
  Zap, Mail, Send, Share2, Plus, Upload, RefreshCw, Eye, 
  Trash2, CheckCircle2, AlertTriangle, ShieldAlert, Globe, 
  ExternalLink, Sparkles, Copy, MessageSquare, 
  Clock, Check, Loader2, X, ChevronRight, BarChart3, 
  Flame, ShieldCheck, FileText, ArrowUpRight, Filter,
  FileSpreadsheet, Radio, Target, Download, Link2
} from 'lucide-react';

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function GrowthAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'admin@acme.com';

  const [activeTab, setActiveTab] = useState<'outreach' | 'radar' | 'social' | 'analytics'>('outreach');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [socialPlatformFilter, setSocialPlatformFilter] = useState<string>('all');

  // Buyer Intent Radar filters & states
  const [radarCategoryFilter, setRadarCategoryFilter] = useState<string>('all');
  const [radarPlatformFilter, setRadarPlatformFilter] = useState<string>('all');
  const [radarMinScoreFilter, setRadarMinScoreFilter] = useState<number>(0);
  const [radarStatusFilter, setRadarStatusFilter] = useState<string>('all');

  // Modals state
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [isEmailEditorOpen, setIsEmailEditorOpen] = useState(false);
  const [isAddSocialPostOpen, setIsAddSocialPostOpen] = useState(false);
  const [isIngestUrlModalOpen, setIsIngestUrlModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Radar Interactive states
  const [ingestUrlInput, setIngestUrlInput] = useState('');
  const [ingestTextInput, setIngestTextInput] = useState('');
  const [sheetWebhookUrlInput, setSheetWebhookUrlInput] = useState('');
  const [expandedReplySignalId, setExpandedReplySignalId] = useState<number | null>(null);
  const [editingSignalId, setEditingSignalId] = useState<number | null>(null);
  const [customDomainOverrides, setCustomDomainOverrides] = useState<{ [id: number]: string }>({});
  const [customCompanyOverrides, setCustomCompanyOverrides] = useState<{ [id: number]: string }>({});
  const [copiedReplyId, setCopiedReplyId] = useState<number | null>(null);

  const [activeLead, setActiveLead] = useState<OutreachLead | null>(null);

  // Google Sheets state
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetAutoScan, setSheetAutoScan] = useState(true);

  // Form states - Single Lead
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [emailAngle, setEmailAngle] = useState<'dmarc_spoofing' | 'open_ports' | 'executive_summary'>('dmarc_spoofing');
  const [autoScan, setAutoScan] = useState(true);

  // Form states - Bulk CSV
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkAutoScan, setBulkAutoScan] = useState(false);

  // Form states - Email Inspector / Editor
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [selectedAngle, setSelectedAngle] = useState<'dmarc_spoofing' | 'open_ports' | 'executive_summary'>('dmarc_spoofing');

  // Form states - Social Post
  const [newPostPlatform, setNewPostPlatform] = useState<'twitter' | 'reddit'>('twitter');
  const [newPostCategory, setNewPostCategory] = useState<'attack_surface' | 'email_security' | 'threat_intel' | 'msp_growth'>('email_security');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostHook, setNewPostHook] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostSubreddit, setNewPostSubreddit] = useState('');
  const [newPostCadenceDay, setNewPostCadenceDay] = useState(1);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // React Query data & mutations
  const { data: stats, isLoading: statsLoading } = useGrowthStats();
  const { data: leads = [], isLoading: leadsLoading } = useGrowthLeads(leadStatusFilter);
  const { data: socialPosts = [], isLoading: socialLoading } = useGrowthSocial(socialPlatformFilter);

  const createLeadMutation = useCreateLead();
  const bulkImportMutation = useBulkImportLeads();
  const scanLeadMutation = useScanLead();
  const scanAllMutation = useScanAllLeads();
  const updateLeadMutation = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();
  const sendEmailMutation = useSendLeadEmail();
  const sendBatchMutation = useSendBatchLeads();

  const createSocialMutation = useCreateSocialPost();
  const updateSocialMutation = useUpdateSocialPost();
  const deleteSocialMutation = useDeleteSocialPost();
  const seedSocialMutation = useSeedSocialPosts();

  const { data: sheetConfig } = useGoogleSheetConfig();
  const saveGoogleSheetMutation = useSaveGoogleSheetConfig();
  const syncGoogleSheetMutation = useSyncGoogleSheet();

  // Radar query & mutations
  const { data: radarSignals = [], isLoading: radarLoading, refetch: refetchRadar } = useProspectSignals({
    category: radarCategoryFilter,
    platform: radarPlatformFilter,
    min_score: radarMinScoreFilter || undefined,
    status: radarStatusFilter,
  });
  const triggerRadarScanMutation = useTriggerRadarScan();
  const ingestRadarUrlMutation = useIngestRadarUrl();
  const convertSignalMutation = useConvertSignalToLead();
  const pushSignalToSheetMutation = usePushSignalToSheet();
  const batchConvertSignalsMutation = useBatchConvertSignals();
  const updateSignalStatusMutation = useUpdateSignalStatus();

  useEffect(() => {
    if (sheetConfig?.sheet_url) {
      setSheetUrlInput(sheetConfig.sheet_url);
    }
    if (sheetConfig?.auto_scan !== undefined) {
      setSheetAutoScan(sheetConfig.auto_scan);
    }
  }, [sheetConfig]);

  // Radar Handlers
  const handleTriggerRadarScan = async () => {
    try {
      const res = await triggerRadarScanMutation.mutateAsync({});
      showToast(res.message || 'Social radar scan completed successfully!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to trigger radar scan', 'error');
    }
  };

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrlInput.trim()) return;
    try {
      const res = await ingestRadarUrlMutation.mutateAsync({
        url: ingestUrlInput.trim(),
        text: ingestTextInput.trim() || undefined,
      });
      showToast(res.message || 'Discussion post ingested & scored!', 'success');
      setIngestUrlInput('');
      setIngestTextInput('');
      setIsIngestUrlModalOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to ingest discussion URL', 'error');
    }
  };

  const handleConvertSignal = async (signal: ProspectSignal) => {
    const domain = customDomainOverrides[signal.id] || signal.extracted_domain;
    if (!domain) {
      showToast('Please specify a corporate domain before converting to an outreach lead.', 'error');
      setEditingSignalId(signal.id);
      return;
    }
    try {
      const company = customCompanyOverrides[signal.id] || signal.extracted_company || domain.split('.')[0];
      const res = await convertSignalMutation.mutateAsync({
        signalId: signal.id,
        data: {
          company_name: company,
          domain: domain,
          contact_name: signal.author_name || signal.author_handle,
          contact_email: signal.extracted_email || `security@${domain}`,
          email_angle: signal.suggested_email_angle || 'dmarc_spoofing',
          auto_scan: true,
        }
      });
      showToast(`Converted ${signal.author_handle} (${domain}) into an active Outreach Lead with passive audit!`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to convert prospect to lead', 'error');
    }
  };

  const handlePushSignalToSheet = async (signalId: number) => {
    try {
      const res = await pushSignalToSheetMutation.mutateAsync({
        signalId,
        webhookUrl: sheetWebhookUrlInput || undefined,
      });
      showToast(res.message || 'Prospect pushed to Google Sheet!', 'success');
    } catch (err: any) {
      if (err?.response?.status === 400 && err?.response?.data?.detail?.includes('webhook')) {
        setIsWebhookModalOpen(true);
      } else {
        showToast(err?.response?.data?.detail || 'Failed to push to Google Sheet', 'error');
      }
    }
  };

  const handleBatchConvertSignals = async () => {
    try {
      const res = await batchConvertSignalsMutation.mutateAsync(80);
      showToast(res.message || 'Batch conversion complete!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to batch convert signals', 'error');
    }
  };

  const handleExportRadarCsv = async () => {
    try {
      const params: any = {};
      if (radarCategoryFilter && radarCategoryFilter !== 'all') params.category = radarCategoryFilter;
      if (radarMinScoreFilter) params.min_score = radarMinScoreFilter;

      const res = await api.get('/admin/growth/radar/export', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'breachguard_buyer_radar.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Google Sheet-ready CSV downloaded!', 'success');
    } catch (err: any) {
      showToast('Failed to export radar CSV', 'error');
    }
  };

  const handleCopyReplyHook = (signalId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReplyId(signalId);
    showToast('Suggested reply hook copied to clipboard!');
    setTimeout(() => setCopiedReplyId(null), 3000);
  };

  const handleOpenInGmail = (lead: OutreachLead, customSubject?: string, customBody?: string) => {
    const to = encodeURIComponent(lead.contact_email || '');
    const subject = encodeURIComponent(customSubject || lead.email_subject || `Cybersecurity Exposure Notice regarding ${lead.domain}`);
    const body = encodeURIComponent(customBody || lead.email_body || '');

    // Launch Google Mail web compose URL directly
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');

    if (lead.status !== 'sent') {
      updateLeadMutation.mutate({
        leadId: lead.id,
        data: { status: 'sent' }
      });
    }
    showToast(`Opened Gmail compose for ${lead.contact_email}!`, 'success');
  };

  const handleDownloadPdf = async (lead: OutreachLead) => {
    try {
      showToast(`Generating 12-page executive report for ${lead.company_name}...`, 'info');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const cleanApiBase = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
      const res = await fetch(`${cleanApiBase}/admin/growth/leads/${lead.id}/pdf`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to generate PDF (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = lead.company_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      a.download = `${cleanName}_Executive_Cyber_Risk_Assessment.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Downloaded ${cleanName}_Executive_Cyber_Risk_Assessment.pdf! Ready to attach to Gmail.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download PDF audit', 'error');
    }
  };

  // Handlers
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !domain || !contactEmail) return;
    try {
      await createLeadMutation.mutateAsync({
        company_name: companyName,
        domain: domain,
        contact_email: contactEmail,
        contact_name: contactName,
        email_angle: emailAngle,
        auto_scan: autoScan,
      });
      showToast(`Added ${companyName} (${domain}) to outreach queue.`);
      setCompanyName('');
      setDomain('');
      setContactEmail('');
      setContactName('');
      setIsAddLeadOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to create lead', 'error');
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;

    // Parse CSV lines
    const lines = bulkCsvText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line.toLowerCase().includes('company') && line.toLowerCase().includes('domain')) {
        continue; // skip header row
      }
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 3) {
        parsed.push({
          company_name: parts[0],
          domain: parts[1],
          contact_email: parts[2],
          contact_name: parts[3] || undefined,
        });
      }
    }

    if (parsed.length === 0) {
      showToast('Could not parse any valid rows. Format: Company, Domain, Email, Contact Name', 'error');
      return;
    }

    try {
      const res = await bulkImportMutation.mutateAsync({
        leads: parsed,
        auto_scan: bulkAutoScan,
      });
      showToast(`Imported ${res.imported_count || parsed.length} leads successfully!`);
      setBulkCsvText('');
      setIsBulkImportOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to import bulk CSV', 'error');
    }
  };

  const handleSaveAndSyncSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) return;
    try {
      await saveGoogleSheetMutation.mutateAsync({
        sheet_url: sheetUrlInput.trim(),
        auto_scan: sheetAutoScan,
      });
      const res = await syncGoogleSheetMutation.mutateAsync({
        sheet_url: sheetUrlInput.trim(),
        auto_scan: sheetAutoScan,
      });
      showToast(
        `Google Sheet Synced! Added ${res.new_leads_added} new leads (${res.duplicates_skipped} existing, ${res.scanned_count} scanned).`,
        'success'
      );
      setIsGoogleSheetModalOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || err?.message || 'Failed to sync Google Sheet', 'error');
    }
  };

  const handleQuickSync = async () => {
    if (!sheetConfig?.sheet_url) {
      setIsGoogleSheetModalOpen(true);
      return;
    }
    try {
      const res = await syncGoogleSheetMutation.mutateAsync({
        sheet_url: sheetConfig.sheet_url,
        auto_scan: sheetConfig.auto_scan,
      });
      showToast(
        `Sheet Synced: ${res.new_leads_added} added, ${res.duplicates_skipped} existing, ${res.scanned_count} scanned.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.response?.data?.detail || err?.message || 'Failed to sync Google Sheet', 'error');
    }
  };

  const handleOpenEmailEditor = (lead: OutreachLead) => {
    setActiveLead(lead);
    setEditedSubject(lead.email_subject || `Quick question regarding ${lead.domain}'s email security`);
    setEditedBody(lead.email_body || '');
    setSelectedAngle((lead.email_angle as any) || 'dmarc_spoofing');
    setIsEmailEditorOpen(true);
  };

  const handleSaveEmailDraft = async () => {
    if (!activeLead) return;
    try {
      const res = await updateLeadMutation.mutateAsync({
        leadId: activeLead.id,
        data: {
          email_subject: editedSubject,
          email_body: editedBody,
          email_angle: selectedAngle,
          status: 'ready',
        }
      });
      showToast(`Updated email draft for ${activeLead.company_name}`);
      setActiveLead({
        ...activeLead,
        email_subject: editedSubject,
        email_body: editedBody,
        email_angle: selectedAngle,
        status: 'ready',
      });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to update email draft', 'error');
    }
  };

  const handleSendSingleEmail = async (leadId: number) => {
    try {
      await sendEmailMutation.mutateAsync(leadId);
      showToast('Outreach email dispatched via Resend!');
      if (isEmailEditorOpen && activeLead?.id === leadId) {
        setIsEmailEditorOpen(false);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to dispatch email via Resend', 'error');
    }
  };

  const handleSendBatchReady = async () => {
    try {
      const res = await sendBatchMutation.mutateAsync(5);
      showToast(`Batch dispatch complete: ${res.sent_count} sent, ${res.failed_count} failed.`);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Batch dispatch encountered rate throttling or network error', 'error');
    }
  };

  const handleCreateSocialPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;
    try {
      await createSocialMutation.mutateAsync({
        platform: newPostPlatform,
        category: newPostCategory,
        title: newPostTitle,
        hook: newPostHook,
        content: newPostContent,
        target_subreddit: newPostSubreddit || undefined,
        cadence_day: Number(newPostCadenceDay) || 1,
      });
      showToast('Added post to social media autopilot queue.');
      setNewPostTitle('');
      setNewPostHook('');
      setNewPostContent('');
      setNewPostSubreddit('');
      setIsAddSocialPostOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to schedule social post', 'error');
    }
  };

  const handleCopyPost = (post: SocialPost) => {
    const fullText = `${post.hook ? post.hook + '\n\n' : ''}${post.content}`;
    navigator.clipboard.writeText(fullText);
    setCopiedPostId(post.id);
    showToast('Copied post copy to clipboard!');
    setTimeout(() => setCopiedPostId(null), 2500);
  };

  const handleOpenTwitterIntent = (post: SocialPost) => {
    const text = encodeURIComponent(`${post.hook ? post.hook + '\n\n' : ''}${post.content}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleOpenRedditIntent = (post: SocialPost) => {
    const title = encodeURIComponent(post.title);
    const text = encodeURIComponent(post.content);
    const sub = post.target_subreddit ? post.target_subreddit.replace(/^r\//, '') : 'sysadmin';
    window.open(`https://reddit.com/r/${sub}/submit?title=${title}&text=${text}`, '_blank');
  };

  // Auth Protection Gate
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto my-16 p-8 bg-bg-surface border border-border-default rounded-xl text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Founder Growth Hub is Restricted</h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            This module contains outbound acquisition engines and social autopilot controls reserved strictly for BreachGuard platform administrators.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-bg-inset border border-border-default hover:border-border-strong rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Return to Overview
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Toast alert banner */}
      {toastMessage && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-xs font-medium border shadow-2xl transition-all flex items-center gap-2.5",
          toastMessage.type === 'success' && "bg-[#171514] border-accent/40 text-text-primary",
          toastMessage.type === 'error' && "bg-[#171514] border-red-500/40 text-red-300",
          toastMessage.type === 'info' && "bg-[#171514] border-border-strong text-text-secondary"
        )}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-accent" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Header Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider text-accent">
                Founder Growth Hub
              </span>
              <span className="px-1.5 py-0.5 rounded bg-bg-inset border border-border-default text-[10px] font-mono text-text-muted">
                Admin Exclusive
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Outreach &amp; Marketing Autopilot
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Automated client vulnerability reconnaissance, personalized cold emails via Resend, and viral social media cadence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGoogleSheetModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-bg-surface border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              title="Connect a live Google Sheet for automated lead intake"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google Sheet Sync</span>
              {sheetConfig?.sheet_url && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsBulkImportOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-bg-surface border border-border-default hover:border-border-strong text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-text-muted" />
              <span>Bulk CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddLeadOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Target Lead</span>
            </button>
          </div>
        </div>

        {/* Growth Metric Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider">Total Leads</div>
            <div className="text-xl font-bold text-text-primary font-mono mt-1">
              {stats?.total_leads ?? 0}
            </div>
            <div className="text-2xs text-text-faint mt-0.5">Target pipeline</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider">Scanned &amp; Audited</div>
            <div className="text-xl font-bold text-text-primary font-mono mt-1">
              {stats?.scanned_leads ?? 0}
            </div>
            <div className="text-2xs text-emerald-400 mt-0.5">Perimeter mapped</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider">Ready to Send</div>
            <div className="text-xl font-bold text-accent font-mono mt-1">
              {stats?.ready_leads ?? 0}
            </div>
            <div className="text-2xs text-text-faint mt-0.5">Copy generated</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider">Dispatched Emails</div>
            <div className="text-xl font-bold text-text-primary font-mono mt-1">
              {stats?.sent_leads ?? 0}
            </div>
            <div className="text-2xs text-text-faint mt-0.5">Via Resend</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider">Avg Prospect Risk</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">
              {stats?.average_risk_score ?? 60}/100
            </div>
            <div className="text-2xs text-text-faint mt-0.5">High conversion trigger</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-surface border border-rose-500/20">
            <div className="text-2xs font-medium text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>Buyer Intent Radar</span>
              <Flame className="w-3 h-3 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400 font-mono mt-1">
              {stats?.high_intent_signals ?? radarSignals.length} Urgent
            </div>
            <div className="text-2xs text-text-faint mt-0.5">Reddit &amp; X Prospects</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border-default gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('outreach')}
            className={cn(
              "pb-3 flex items-center gap-2 transition-colors relative cursor-pointer",
              activeTab === 'outreach' ? "text-text-primary font-semibold" : "text-text-muted hover:text-text-primary"
            )}
          >
            <Mail className="w-4 h-4" />
            <span>Client Cold Outreach Engine</span>
            {stats && stats.ready_leads > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent/20 text-accent font-mono text-[10px]">
                {stats.ready_leads}
              </span>
            )}
            {activeTab === 'outreach' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={cn(
              "pb-3 flex items-center gap-2 transition-colors relative cursor-pointer",
              activeTab === 'radar' ? "text-text-primary font-semibold" : "text-text-muted hover:text-text-primary"
            )}
          >
            <Radio className="w-4 h-4 text-rose-400" />
            <span>Buyer Intent Radar</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-400 font-mono text-[10px] flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" />
              <span>{stats?.high_intent_signals ?? radarSignals.length}</span>
            </span>
            {activeTab === 'radar' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={cn(
              "pb-3 flex items-center gap-2 transition-colors relative cursor-pointer",
              activeTab === 'social' ? "text-text-primary font-semibold" : "text-text-muted hover:text-text-primary"
            )}
          >
            <Share2 className="w-4 h-4" />
            <span>Social Media Autopilot (Twitter/X &amp; Reddit)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400 font-mono text-[10px]">
              Every 3 Days
            </span>
            {activeTab === 'social' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "pb-3 flex items-center gap-2 transition-colors relative cursor-pointer",
              activeTab === 'analytics' ? "text-text-primary font-semibold" : "text-text-muted hover:text-text-primary"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Outreach Angles &amp; Playbooks</span>
            {activeTab === 'analytics' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        </div>

        {/* TAB 1: COLD OUTREACH ENGINE */}
        {activeTab === 'outreach' && (
          <div className="space-y-4">
            {/* Filter & Action Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-bg-surface border border-border-default">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {['all', 'ready', 'pending_scan', 'sent', 'failed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLeadStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors capitalize cursor-pointer",
                      leadStatusFilter === st
                        ? "bg-bg-inset text-text-primary font-medium border border-border-strong"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    {st === 'all' ? 'All Leads' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {sheetConfig?.sheet_url && (
                  <button
                    type="button"
                    onClick={handleQuickSync}
                    disabled={syncGoogleSheetMutation.isPending}
                    className="px-3 py-1.5 rounded-md bg-emerald-950/40 border border-emerald-500/40 hover:border-emerald-500 text-xs text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Pull latest rows from connected Google Sheet"
                  >
                    <FileSpreadsheet className={cn("w-3.5 h-3.5", syncGoogleSheetMutation.isPending && "animate-spin")} />
                    <span>{syncGoogleSheetMutation.isPending ? 'Syncing...' : 'Sync Sheet'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => scanAllMutation.mutate()}
                  disabled={scanAllMutation.isPending}
                  className="px-3 py-1.5 rounded-md bg-bg-inset border border-border-default hover:border-border-strong text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", scanAllMutation.isPending && "animate-spin")} />
                  <span>Scan All Pending</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendBatchReady}
                  disabled={sendBatchMutation.isPending || !stats || stats.ready_leads === 0}
                  className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {sendBatchMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Batch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Ready Batch (Max 5)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Leads Table */}
            <div className="border border-border-default rounded-lg bg-bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-inset border-b border-border-default text-text-muted uppercase text-2xs tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Company &amp; Domain</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Passive Vulnerability Audit</th>
                      <th className="py-3 px-4">Risk Score</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default text-text-secondary">
                    {leadsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-text-muted">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-text-muted" />
                          Loading prospective leads...
                        </td>
                      </tr>
                    ) : leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-text-muted">
                          <p className="text-xs">No outreach leads found in this filter.</p>
                          <p className="text-2xs text-text-faint mt-1">
                            Click &quot;New Target Lead&quot; or &quot;Bulk CSV&quot; above to import prospects.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead) => {
                        const hasDmarcIssue = lead.dmarc_status === 'missing' || lead.dmarc_status === 'p=none';
                        const hasPorts = lead.exposed_ports && lead.exposed_ports.length > 0;
                        const scoreColor = (lead.risk_score || 0) >= 65 ? "text-red-400 border-red-500/30 bg-red-500/10" : (lead.risk_score || 0) >= 35 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

                        return (
                          <tr key={lead.id} className="hover:bg-bg-hover transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium text-text-primary">{lead.company_name}</div>
                              <div className="flex items-center gap-1 text-2xs text-text-muted font-mono mt-0.5">
                                <Globe className="w-3 h-3 text-text-faint" />
                                <span>{lead.domain}</span>
                                <a 
                                  href={`/?scan=${lead.domain}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-text-faint hover:text-accent ml-1" 
                                  title="Test scan on landing page"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono text-2xs">
                              <div className="text-text-primary">{lead.contact_email}</div>
                              {lead.contact_name && (
                                <div className="text-text-faint font-sans text-2xs">{lead.contact_name}</div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {hasDmarcIssue && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                                    DMARC: {lead.dmarc_status}
                                  </span>
                                )}
                                {hasPorts && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] font-mono">
                                    {lead.exposed_ports.length} Open Port(s)
                                  </span>
                                )}
                                {lead.breach_count > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono">
                                    {lead.breach_count} Breach(es)
                                  </span>
                                )}
                                {!hasDmarcIssue && !hasPorts && lead.breach_count === 0 && (
                                  <span className="text-text-faint text-2xs italic">
                                    {lead.status === 'pending_scan' ? 'Pending audit...' : 'Clean baseline'}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {lead.risk_score !== null && lead.risk_score !== undefined ? (
                                <span className={cn("px-2 py-0.5 rounded border text-xs font-mono font-semibold", scoreColor)}>
                                  {lead.risk_score}/100
                                </span>
                              ) : (
                                <span className="text-text-faint text-2xs">--</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[11px] font-medium capitalize",
                                lead.status === 'ready' && "bg-accent/15 text-accent border border-accent/30",
                                lead.status === 'sent' && "bg-sky-500/15 text-sky-300 border border-sky-500/30",
                                lead.status === 'pending_scan' && "bg-amber-500/10 text-amber-300 border border-amber-500/20",
                                lead.status === 'failed' && "bg-red-500/10 text-red-400 border border-red-500/20"
                              )}>
                                {lead.status === 'sent' && lead.sent_at ? `Sent ${formatDate(lead.sent_at)}` : lead.status.replace('_', ' ')}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEmailEditor(lead)}
                                  title="Inspect vulnerability findings & customize email"
                                  className="p-1.5 rounded-md hover:bg-bg-inset text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => scanLeadMutation.mutate(lead.id)}
                                  disabled={scanLeadMutation.isPending}
                                  title="Re-run passive scan"
                                  className="p-1.5 rounded-md hover:bg-bg-inset text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                >
                                  <RefreshCw className={cn("w-3.5 h-3.5", scanLeadMutation.isPending && "animate-spin")} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenInGmail(lead)}
                                  title="1-Click Open in Gmail Compose (Zero Setup / 100% Free)"
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Mail className="w-3 h-3 text-red-400" />
                                  <span>Gmail</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDownloadPdf(lead)}
                                  title="Download 12-Page Executive Cyber Risk Assessment PDF"
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 text-amber-400" />
                                  <span>PDF Audit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSendSingleEmail(lead.id)}
                                  disabled={sendEmailMutation.isPending || lead.status === 'pending_scan'}
                                  title={lead.status === 'sent' ? "Resend email via Resend" : "1-Click Send via Resend"}
                                  className={cn(
                                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer",
                                    lead.status === 'ready' 
                                      ? "bg-accent text-accent-text hover:bg-accent-hover" 
                                      : "bg-bg-inset text-text-muted hover:text-text-primary border border-border-default"
                                  )}
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{lead.status === 'sent' ? 'Resend' : 'Send'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteLeadMutation.mutate(lead.id)}
                                  title="Delete lead"
                                  className="p-1.5 rounded-md hover:bg-red-500/10 text-text-faint hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BUYER INTENT RADAR */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            {/* Radar Banner */}
            <div className="p-4 rounded-lg bg-bg-surface border border-border-default flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      Automated Social Buyer Intent Radar
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Live Feed
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Actively monitoring Reddit (<code className="text-text-secondary font-mono">r/sysadmin</code>, <code className="text-text-secondary font-mono">r/msp</code>, <code className="text-text-secondary font-mono">r/cybersecurity</code>) and Twitter/X for companies with urgent DMARC failures, open ports, and credential breaches.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerRadarScan}
                  disabled={triggerRadarScanMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Refresh social discovery feeds"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", triggerRadarScanMutation.isPending && "animate-spin")} />
                  <span>Scan Social Feeds</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsIngestUrlModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Paste any Reddit or X link to extract and score"
                >
                  <Link2 className="w-3.5 h-3.5 text-text-muted" />
                  <span>Analyze URL</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportRadarCsv}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-500 text-xs text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download Google Sheets-ready CSV with all buyer signals"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Sheet CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchConvertSignals}
                  disabled={batchConvertSignalsMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Batch convert all prospects with >=80% intent score"
                >
                  {batchConvertSignalsMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Convert All Ready (&ge;80%)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filter & Topic Bar */}
            <div className="p-3 rounded-lg bg-bg-surface border border-border-default space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Platform filter tabs */}
                <div className="flex items-center gap-1 bg-bg-inset p-1 rounded-lg border border-border-default">
                  {[
                    { id: 'all', label: 'All Feeds' },
                    { id: 'reddit', label: 'Reddit Only' },
                    { id: 'twitter', label: 'Twitter / X' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRadarPlatformFilter(p.id)}
                      className={cn(
                        "px-2.5 py-1 rounded text-2xs font-medium transition-colors cursor-pointer",
                        radarPlatformFilter === p.id
                          ? "bg-bg-surface text-text-primary shadow-sm border border-border-strong"
                          : "text-text-muted hover:text-text-secondary"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Urgency Score Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-text-muted">Min Urgency:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { score: 0, label: 'All Scores' },
                      { score: 80, label: 'High Urgency (>=80%)' },
                      { score: 90, label: 'Critical (>=90%)' },
                    ].map((btn) => (
                      <button
                        key={btn.score}
                        type="button"
                        onClick={() => setRadarMinScoreFilter(btn.score)}
                        className={cn(
                          "px-2.5 py-1 rounded text-2xs font-medium transition-colors cursor-pointer",
                          radarMinScoreFilter === btn.score
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                            : "bg-bg-inset border border-border-default text-text-muted hover:text-text-secondary"
                        )}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-default/60 text-2xs">
                <span className="text-text-muted uppercase tracking-wider font-mono mr-1">Pain Point:</span>
                {[
                  { id: 'all', label: 'All Pain Points' },
                  { id: 'dmarc_spoofing', label: 'DMARC & Email Spoofing' },
                  { id: 'credential_leak', label: 'Infostealer & Dark Web Leaks' },
                  { id: 'attack_surface', label: 'Exposed Ports & Perimeter' },
                  { id: 'msp_compliance', label: 'MSP & Compliance Assessments' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setRadarCategoryFilter(c.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                      radarCategoryFilter === c.id
                        ? "bg-bg-inset text-text-primary border border-border-strong font-medium"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Signals Feed */}
            {radarLoading ? (
              <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-surface">
                <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
                <span>Scanning social feeds and scoring buyer intent...</span>
              </div>
            ) : radarSignals.length === 0 ? (
              <div className="p-12 text-center text-xs text-text-muted rounded-lg border border-border-default bg-bg-surface space-y-3">
                <Radio className="w-8 h-8 text-text-faint mx-auto opacity-50" />
                <div className="text-text-secondary font-medium">No buyer signals match current filters</div>
                <p className="text-2xs text-text-muted max-w-sm mx-auto">
                  Try adjusting the minimum urgency score or topic filter, or click "Scan Social Feeds" to refresh.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRadarCategoryFilter('all');
                    setRadarPlatformFilter('all');
                    setRadarMinScoreFilter(0);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-bg-inset border border-border-default text-xs text-text-primary hover:bg-bg-hover cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {radarSignals.map((signal) => {
                  const isExpanded = expandedReplySignalId === signal.id;
                  const isEditing = editingSignalId === signal.id;
                  const currentDomain = customDomainOverrides[signal.id] || signal.extracted_domain || '';
                  const currentCompany = customCompanyOverrides[signal.id] || signal.extracted_company || '';
                  const isConverting = convertSignalMutation.isPending && convertSignalMutation.variables?.signalId === signal.id;

                  return (
                    <div
                      key={signal.id}
                      className={cn(
                        "p-4 rounded-xl border bg-bg-surface transition-all space-y-3",
                        signal.status === 'converted_to_lead'
                          ? "border-emerald-500/30 bg-emerald-950/10"
                          : signal.intent_score >= 90
                          ? "border-rose-500/30 shadow-sm"
                          : "border-border-default hover:border-border-strong"
                      )}
                    >
                      {/* Top Meta Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-default/60">
                        <div className="flex items-center gap-2">
                          {signal.platform === 'reddit' ? (
                            <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono text-[11px] flex items-center gap-1 font-semibold">
                              <span>Reddit</span>
                              <span className="text-text-muted font-normal">• {signal.author_handle}</span>
                            </span>
                          ) : signal.platform === 'twitter' ? (
                            <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-[11px] flex items-center gap-1 font-semibold">
                              <XTwitterIcon className="w-3 h-3" />
                              <span>{signal.author_handle}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-bg-inset border border-border-default text-text-secondary font-mono text-[11px]">
                              Web Forum
                            </span>
                          )}

                          {/* Category Badge */}
                          <span className="px-2 py-0.5 rounded bg-bg-inset border border-border-default text-[10px] text-text-muted capitalize">
                            {signal.intent_category.replace('_', ' ')}
                          </span>

                          {/* Status Badge */}
                          {signal.status === 'converted_to_lead' && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Converted to Lead
                            </span>
                          )}
                          {signal.status === 'synced_to_sheet' && (
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono flex items-center gap-1 font-medium">
                              <FileSpreadsheet className="w-3 h-3" />
                              In Google Sheet
                            </span>
                          )}
                        </div>

                        {/* Intent Urgency Score Pill */}
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold flex items-center gap-1 border",
                              signal.intent_score >= 90
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                                : signal.intent_score >= 80
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                            )}
                          >
                            <Flame className="w-3 h-3" />
                            <span>{signal.intent_score}% Intent</span>
                            <span className="text-[10px] opacity-75 font-normal uppercase">({signal.urgency_level})</span>
                          </div>
                        </div>
                      </div>

                      {/* Discussion Content */}
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary tracking-tight leading-snug">
                          {signal.post_title}
                        </h3>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed bg-bg-inset/50 p-2.5 rounded-lg border border-border-default/40 font-sans">
                          {signal.post_snippet}
                        </p>
                      </div>

                      {/* Extracted Entity Badge Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-bg-inset border border-border-default text-xs">
                        <div className="flex flex-wrap items-center gap-4">
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                placeholder="Company"
                                value={currentCompany}
                                onChange={(e) => setCustomCompanyOverrides(prev => ({ ...prev, [signal.id]: e.target.value }))}
                                className="px-2 py-1 bg-bg-surface border border-border-default rounded text-xs text-text-primary font-mono"
                              />
                              <input
                                type="text"
                                placeholder="domain.com"
                                value={currentDomain}
                                onChange={(e) => setCustomDomainOverrides(prev => ({ ...prev, [signal.id]: e.target.value }))}
                                className="px-2 py-1 bg-bg-surface border border-border-default rounded text-xs text-text-primary font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingSignalId(null)}
                                className="px-2 py-1 bg-accent text-accent-text rounded text-xs font-medium cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="text-2xs text-text-muted uppercase font-mono block">Company</span>
                                <span className="font-semibold text-text-primary">
                                  {currentCompany || <span className="text-text-muted italic">Unknown</span>}
                                </span>
                              </div>

                              <div>
                                <span className="text-2xs text-text-muted uppercase font-mono block">Target Domain</span>
                                {currentDomain ? (
                                  <span className="font-mono text-xs font-semibold text-accent flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    <span>{currentDomain}</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingSignalId(signal.id)}
                                    className="text-amber-400 text-2xs hover:underline cursor-pointer"
                                  >
                                    + Add Domain
                                  </button>
                                )}
                              </div>

                              <div>
                                <span className="text-2xs text-text-muted uppercase font-mono block">Contact</span>
                                <span className="text-text-secondary font-mono text-2xs">
                                  {signal.extracted_email || signal.author_handle}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditingSignalId(signal.id)}
                            className="text-[11px] text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            Edit details
                          </button>
                        )}
                      </div>

                      {/* Expandable Suggested Social Reply Hook */}
                      {signal.suggested_reply && (
                        <div className="border border-border-default/80 rounded-lg overflow-hidden bg-bg-base/60">
                          <button
                            type="button"
                            onClick={() => setExpandedReplySignalId(isExpanded ? null : signal.id)}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs text-text-muted hover:text-text-primary bg-bg-surface/50 transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 text-text-secondary font-medium text-[11px]">
                              <Sparkles className="w-3 h-3 text-sky-400" />
                              <span>Suggested Value-First Reply Hook (for Reddit / X)</span>
                            </span>
                            <span className="text-2xs text-text-muted underline">
                              {isExpanded ? 'Hide Reply' : 'View Script'}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="p-3 border-t border-border-default/60 space-y-2">
                              <p className="text-xs text-text-primary font-sans leading-relaxed bg-bg-inset p-3 rounded-lg border border-border-default/40 select-all">
                                {signal.suggested_reply}
                              </p>
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyReplyHook(signal.id, signal.suggested_reply || '')}
                                  className="px-2.5 py-1 rounded bg-bg-surface border border-border-default hover:border-border-strong text-2xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  {copiedReplyId === signal.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-accent" />
                                      <span className="text-accent font-medium">Copied to Clipboard!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Reply Hook</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Actions Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-default/60 text-xs">
                        <div className="flex items-center gap-2">
                          <a
                            href={signal.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer text-2xs"
                          >
                            <span>Open Thread</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handlePushSignalToSheet(signal.id)}
                            disabled={pushSignalToSheetMutation.isPending}
                            className="px-2.5 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer text-2xs"
                            title="Push prospect row into Google Sheet webhook"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                            <span>Push to Sheet</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {signal.status !== 'converted_to_lead' ? (
                            <button
                              type="button"
                              onClick={() => handleConvertSignal(signal)}
                              disabled={isConverting}
                              className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                            >
                              {isConverting ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Auditing &amp; Converting...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>Convert to Lead &amp; Auto-Scan</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('outreach');
                                setLeadStatusFilter('all');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                              <span>View in Outreach Pipeline</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateSignalStatusMutation.mutate({ signalId: signal.id, status: 'dismissed' })}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                            title="Dismiss prospect signal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SOCIAL MEDIA AUTOPILOT */}
        {activeTab === 'social' && (
          <div className="space-y-4">
            {/* Cadence Banner */}
            <div className="p-4 rounded-lg bg-bg-surface border border-border-default flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      Automated 3-Day Content Cadence Active
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                      Active Queue
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Pre-loaded with battle-tested cybersecurity hooks, teardowns, and case studies that direct founders &amp; sysadmins to your free landing page scanner.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => seedSocialMutation.mutate()}
                  disabled={seedSocialMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", seedSocialMutation.isPending && "animate-spin")} />
                  <span>Re-seed Queue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSocialPostOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Custom Post</span>
                </button>
              </div>
            </div>

            {/* Platform Filter Bar */}
            <div className="flex items-center gap-2 text-xs">
              {['all', 'twitter', 'reddit'].map((pl) => (
                <button
                  key={pl}
                  type="button"
                  onClick={() => setSocialPlatformFilter(pl)}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-colors cursor-pointer capitalize",
                    socialPlatformFilter === pl
                      ? "bg-bg-inset text-text-primary font-medium border border-border-strong"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  {pl === 'all' ? 'All Platforms' : pl === 'twitter' ? 'Twitter / X' : 'Reddit'}
                </button>
              ))}
            </div>

            {/* Social Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {socialLoading ? (
                <div className="col-span-2 py-12 text-center text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-text-muted" />
                  Loading content queue...
                </div>
              ) : socialPosts.map((post) => {
                const isTwitter = post.platform === 'twitter';
                const isReddit = post.platform === 'reddit';

                return (
                  <div 
                    key={post.id} 
                    className="p-4 rounded-xl bg-bg-surface border border-border-default hover:border-border-strong transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-border-default">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "p-1.5 rounded-md border flex items-center justify-center",
                            isTwitter ? "bg-sky-500/10 border-sky-500/20 text-sky-400" : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                          )}>
                            {isTwitter ? <XTwitterIcon className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <span className="text-xs font-semibold text-text-primary">
                              {post.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-text-faint mt-0.5">
                              <span className="font-mono text-accent">Day {post.cadence_day}</span>
                              <span>•</span>
                              <span>{post.target_subreddit || (isTwitter ? 'Twitter Thread' : 'Reddit Community')}</span>
                            </div>
                          </div>
                        </div>

                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono capitalize",
                          post.status === 'published' 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-bg-inset text-text-muted border border-border-default"
                        )}>
                          {post.status}
                        </span>
                      </div>

                      {/* Hook & Body */}
                      <div className="py-3 space-y-2">
                        {post.hook && (
                          <div className="p-2.5 rounded bg-bg-inset border border-border-default text-xs text-text-primary font-medium italic">
                            &ldquo;{post.hook}&rdquo;
                          </div>
                        )}
                        <p className="text-xs text-text-secondary whitespace-pre-line line-clamp-6 leading-relaxed font-sans">
                          {post.content}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-border-default flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPost(post)}
                          className="px-2.5 py-1 rounded bg-bg-inset border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer text-2xs"
                        >
                          {copiedPostId === post.id ? (
                            <>
                              <Check className="w-3 h-3 text-accent" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-text-muted" />
                              <span>Copy Post</span>
                            </>
                          )}
                        </button>

                        {isTwitter && (
                          <button
                            type="button"
                            onClick={() => handleOpenTwitterIntent(post)}
                            className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-colors flex items-center gap-1 cursor-pointer text-2xs"
                          >
                            <XTwitterIcon className="w-3 h-3" />
                            <span>Share to X</span>
                          </button>
                        )}

                        {isReddit && (
                          <button
                            type="button"
                            onClick={() => handleOpenRedditIntent(post)}
                            className="px-2.5 py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/20 transition-colors flex items-center gap-1 cursor-pointer text-2xs"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Share to Reddit</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateSocialMutation.mutate({
                            postId: post.id,
                            data: { status: post.status === 'published' ? 'scheduled' : 'published' }
                          })}
                          className="px-2 py-1 rounded hover:bg-bg-inset text-text-faint hover:text-text-primary text-2xs transition-colors cursor-pointer"
                        >
                          {post.status === 'published' ? 'Mark Scheduled' : 'Mark Published'}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSocialMutation.mutate(post.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-text-faint hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: OUTREACH ANGLES & PLAYBOOKS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-bg-surface border border-border-default space-y-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Angle A: DMARC Spoofing Risk</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Highlights when a prospect domain has no DMARC record or sets <code className="text-accent">p=none</code>. Emphasizes executive impersonation risks and Google/Yahoo sender deliverability penalties.
              </p>
              <div className="pt-2 border-t border-border-default text-2xs text-text-faint font-mono">
                Historical Conversion: 18.4% scan CTR
              </div>
            </div>

            <div className="p-4 rounded-xl bg-bg-surface border border-border-default space-y-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Angle B: Exposed Administrative Ports</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Highlights exposed administrative services like SSH (22), RDP (3389), or database ports detected via Shodan InternetDB telemetry, explaining how automated internet scanners exploit them.
              </p>
              <div className="pt-2 border-t border-border-default text-2xs text-text-faint font-mono">
                Historical Conversion: 22.1% reply rate
              </div>
            </div>

            <div className="p-4 rounded-xl bg-bg-surface border border-border-default space-y-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Angle C: Executive Risk Briefing</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Delivers an executive snapshot with composite risk score, breach record count, and observable subdomain footprint, inviting leadership to view the full assessment without creating an account.
              </p>
              <div className="pt-2 border-t border-border-default text-2xs text-text-faint font-mono">
                Historical Conversion: 14.8% executive response
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Add Single Target Lead */}
      {isAddLeadOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-accent">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">Add Outreach Prospect</h3>
              </div>
              <button 
                onClick={() => setIsAddLeadOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary mb-1 font-medium">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary placeholder-text-faint focus:outline-none focus:border-border-strong"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Target Domain</label>
                <input
                  type="text"
                  placeholder="e.g. acme.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary placeholder-text-faint focus:outline-none focus:border-border-strong font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Contact Email</label>
                <input
                  type="email"
                  placeholder="e.g. cto@acme.com or security@acme.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary placeholder-text-faint focus:outline-none focus:border-border-strong font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Contact Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary placeholder-text-faint focus:outline-none focus:border-border-strong"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Initial Outreach Angle</label>
                <select
                  value={emailAngle}
                  onChange={(e) => setEmailAngle(e.target.value as any)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-border-strong cursor-pointer"
                >
                  <option value="dmarc_spoofing">DMARC Spoofing Risk (High Urgency)</option>
                  <option value="open_ports">Exposed Ports &amp; Perimeter (Shodan)</option>
                  <option value="executive_summary">Executive Risk Briefing (Composite Score)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_scan"
                  checked={autoScan}
                  onChange={(e) => setAutoScan(e.target.checked)}
                  className="rounded border-border-default text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="auto_scan" className="text-text-secondary cursor-pointer">
                  Auto-run BreachGuard passive perimeter scan immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsAddLeadOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {createLeadMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Adding &amp; Scanning...
                    </>
                  ) : (
                    'Add Lead'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk CSV Import */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-text-primary">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">Bulk CSV Lead Ingestion</h3>
              </div>
              <button 
                onClick={() => setIsBulkImportOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary mb-1 font-medium">
                  Paste CSV Lines (Format: Company, Domain, Email, Contact Name)
                </label>
                <textarea
                  rows={8}
                  placeholder={`Acme Cyber, acme.com, cto@acme.com, John Doe\nBeta Health, betahealth.io, security@betahealth.io, Sarah Connor\nDelta Fin, deltafin.co, founder@deltafin.co, Michael`}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  className="w-full p-3 bg-bg-surface border border-border-default rounded-lg text-text-primary placeholder-text-faint font-mono text-2xs focus:outline-none focus:border-border-strong"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bulk_auto_scan"
                  checked={bulkAutoScan}
                  onChange={(e) => setBulkAutoScan(e.target.checked)}
                  className="rounded border-border-default text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="bulk_auto_scan" className="text-text-secondary cursor-pointer">
                  Auto-run passive scan on all rows during import
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkImportMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {bulkImportMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import Leads'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Google Sheets Sync */}
      {isGoogleSheetModalOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Google Sheets Intake &amp; Sync</h3>
                  <p className="text-[11px] text-text-faint">Direct live spreadsheet sync — zero API credentials required</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGoogleSheetModalOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Setup Instructions */}
            <div className="mt-4 p-3 rounded-lg bg-bg-surface border border-border-default text-xs space-y-2">
              <div className="text-text-secondary font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>How to link your Google Sheet:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-text-muted text-[11px] leading-relaxed">
                <li>Open your Google Sheet and click the green <strong className="text-text-primary font-medium">Share</strong> button.</li>
                <li>Under General access, select <strong className="text-text-primary font-medium">"Anyone with the link"</strong> (Viewer).</li>
                <li>Copy the link and paste it into the field below.</li>
              </ol>
              <div className="pt-1 text-[10px] text-text-faint font-mono">
                Detected columns: Company Name, Domain, Contact Email, Contact Name
              </div>
            </div>

            <form onSubmit={handleSaveAndSyncSheet} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary mb-1 font-medium">
                  Google Sheet Shareable URL
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit?usp=sharing"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-mono text-xs focus:outline-none focus:border-border-strong"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sheet_auto_scan"
                  checked={sheetAutoScan}
                  onChange={(e) => setSheetAutoScan(e.target.checked)}
                  className="rounded border-border-default text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="sheet_auto_scan" className="text-text-secondary cursor-pointer">
                  Auto-run passive vulnerability audit on newly synced leads
                </label>
              </div>

              {sheetConfig?.last_synced_at && (
                <div className="text-[11px] text-text-muted flex items-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Last synced: {formatDate(sheetConfig.last_synced_at)}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsGoogleSheetModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncGoogleSheetMutation.isPending || saveGoogleSheetMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {syncGoogleSheetMutation.isPending || saveGoogleSheetMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Leads...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Save &amp; Sync Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Email Inspector & Editor */}
      {isEmailEditorOpen && activeLead && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-accent">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Cold Outreach Inspector — {activeLead.company_name} ({activeLead.domain})
                  </h3>
                  <p className="text-[11px] text-text-faint">
                    Personalized based on BreachGuard passive perimeter telemetry
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEmailEditorOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
              {/* Telemetry Summary Strip */}
              <div className="p-3 rounded-lg bg-bg-surface border border-border-default grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] uppercase font-mono text-text-faint">Risk Score</div>
                  <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                    {activeLead.risk_score !== null ? `${activeLead.risk_score}/100` : 'Unscanned'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-text-faint">DMARC Policy</div>
                  <div className="text-xs font-semibold text-text-primary mt-0.5 font-mono">
                    {activeLead.dmarc_status || 'missing'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-text-faint">Exposed Ports</div>
                  <div className="text-xs font-semibold text-red-300 mt-0.5 font-mono">
                    {activeLead.exposed_ports && activeLead.exposed_ports.length > 0 ? `${activeLead.exposed_ports.length} services` : '0 detected'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-text-faint">Breach Telemetry</div>
                  <div className="text-xs font-semibold text-purple-300 mt-0.5 font-mono">
                    {activeLead.breach_count || 0} breaches
                  </div>
                </div>
              </div>

              {/* Angle Switcher */}
              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">Outreach Angle</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'dmarc_spoofing', label: 'DMARC Spoofing Risk' },
                    { key: 'open_ports', label: 'Exposed Ports & Perimeter' },
                    { key: 'executive_summary', label: 'Executive Risk Briefing' },
                  ].map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => {
                        setSelectedAngle(a.key as any);
                        // Trigger re-generation of text with this angle
                        updateLeadMutation.mutate({
                          leadId: activeLead.id,
                          data: { email_angle: a.key }
                        }, {
                          onSuccess: (res) => {
                            if (res.subject) setEditedSubject(res.subject);
                            if (res.body) setEditedBody(res.body);
                          }
                        });
                      }}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-colors cursor-pointer text-2xs",
                        selectedAngle === a.key
                          ? "bg-bg-inset border-accent text-accent font-semibold"
                          : "bg-bg-surface border-border-default text-text-muted hover:text-text-primary"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Input */}
              <div>
                <label className="block text-text-secondary mb-1 font-medium">Email Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-medium focus:outline-none focus:border-border-strong"
                />
              </div>

              {/* Body Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-text-secondary font-medium">Email Body (Plain Text &amp; HTML auto-rendered)</label>
                  <span className="text-[10px] text-text-faint font-mono">Personalized for {activeLead.contact_email}</span>
                </div>
                <textarea
                  rows={9}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="w-full p-3 bg-bg-surface border border-border-default rounded-lg text-text-primary font-sans leading-relaxed text-xs focus:outline-none focus:border-border-strong"
                />
              </div>

              {/* Attached 12-Page Assessment Banner */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-amber-500/20 text-amber-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-200">Enclosed Executive Risk Assessment</div>
                    <div className="text-[11px] text-amber-300/80 font-mono">
                      {activeLead.company_name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_Executive_Cyber_Risk_Assessment.pdf (12 Pages)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(activeLead)}
                  className="px-2.5 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download the 12-page PDF assessment"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Audit</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={handleSaveEmailDraft}
                disabled={updateLeadMutation.isPending}
                className="px-3.5 py-1.5 rounded-lg bg-bg-inset border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                Save Draft Changes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmailEditorOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary text-xs cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeLead) {
                      handleDownloadPdf(activeLead);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download 12-page executive report to attach to Gmail"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download PDF Audit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeLead) {
                      handleOpenInGmail(activeLead, editedSubject, editedBody);
                      setIsEmailEditorOpen(false);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Open this personalized draft directly in Gmail compose"
                >
                  <Mail className="w-3.5 h-3.5 text-red-400" />
                  <span>Open in Gmail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSingleEmail(activeLead.id)}
                  disabled={sendEmailMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via Resend...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>1-Click Send via Resend</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Custom Social Post */}
      {isAddSocialPostOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-sky-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">Create Scheduled Social Post</h3>
              </div>
              <button 
                onClick={() => setIsAddSocialPostOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSocialPost} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">Platform</label>
                  <select
                    value={newPostPlatform}
                    onChange={(e) => setNewPostPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none"
                  >
                    <option value="twitter">Twitter / X</option>
                    <option value="reddit">Reddit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">Cadence Offset</label>
                  <input
                    type="number"
                    min={1}
                    value={newPostCadenceDay}
                    onChange={(e) => setNewPostCadenceDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-mono focus:outline-none"
                    placeholder="e.g. Day 1, 4, 7..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Post Topic / Category</label>
                <select
                  value={newPostCategory}
                  onChange={(e) => setNewPostCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none"
                >
                  <option value="email_security">Email Security (DMARC / SPF)</option>
                  <option value="attack_surface">Attack Surface &amp; Open Ports</option>
                  <option value="threat_intel">Threat Intel &amp; Infostealer Leaks</option>
                  <option value="msp_growth">MSP Client Acquisition</option>
                </select>
              </div>

              {newPostPlatform === 'reddit' && (
                <div>
                  <label className="block text-text-secondary mb-1 font-medium">Target Subreddit</label>
                  <input
                    type="text"
                    placeholder="e.g. r/sysadmin, r/msp, r/cybersecurity"
                    value={newPostSubreddit}
                    onChange={(e) => setNewPostSubreddit(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-mono focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Post Title</label>
                <input
                  type="text"
                  placeholder="e.g. The DMARC p=none Illusion"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Opening Hook (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 70% of companies don't know they can be spoofed."
                  value={newPostHook}
                  onChange={(e) => setNewPostHook(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">Post Content</label>
                <textarea
                  rows={6}
                  placeholder="Write the value-first thread or case study..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full p-3 bg-bg-surface border border-border-default rounded-lg text-text-primary font-sans leading-relaxed focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsAddSocialPostOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSocialMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {createSocialMutation.isPending ? 'Scheduling...' : 'Add to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ingest & Analyze Discussion URL */}
      {isIngestUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Analyze Discussion URL or Snippet</h3>
                  <p className="text-[11px] text-text-faint">Extract corporate domain &amp; evaluate buyer intent urgency</p>
                </div>
              </div>
              <button 
                onClick={() => setIsIngestUrlModalOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIngestUrl} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary mb-1 font-medium">
                  Discussion / Thread URL (Reddit, Twitter/X, or Web Forum)
                </label>
                <input
                  type="url"
                  placeholder="https://www.reddit.com/r/sysadmin/comments/... or https://x.com/..."
                  value={ingestUrlInput}
                  onChange={(e) => setIngestUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-mono text-xs focus:outline-none focus:border-border-strong"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-text-secondary font-medium">
                    Post Text Snippet (Optional / Manual Paste)
                  </label>
                  <span className="text-[10px] text-text-faint">Useful if page requires login or API is blocked</span>
                </div>
                <textarea
                  rows={4}
                  placeholder="e.g. We just had a vendor spoof our domain because our DMARC is set to p=none. Boss is furious, what should I do?"
                  value={ingestTextInput}
                  onChange={(e) => setIngestTextInput(e.target.value)}
                  className="w-full p-3 bg-bg-surface border border-border-default rounded-lg text-text-primary font-sans leading-relaxed text-xs focus:outline-none focus:border-border-strong"
                />
              </div>

              <div className="p-3 rounded-lg bg-bg-surface border border-border-default text-2xs text-text-muted space-y-1">
                <div className="text-text-secondary font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>Automated AI Pipeline:</span>
                </div>
                <p>
                  BreachGuard scores urgency (DMARC spoofing, exposed ports, infostealers), extracts company &amp; domain, drafts a value-first reply hook, and prepares 1-click conversion to passive scan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsIngestUrlModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingestRadarUrlMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {ingestRadarUrlMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing &amp; Scoring...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Analyze &amp; Score Intent
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Google Sheet Live Webhook Configuration */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-base border border-border-default rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Google Sheet Webhook Destination</h3>
                  <p className="text-[11px] text-text-faint">Real-time prospect row forwarding to your Google Sheet</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWebhookModalOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-bg-surface border border-border-default space-y-2">
                <div className="text-text-secondary font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Real-time Live Row Ingestion:</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Enter your Google Apps Script Webhook URL (or Zapier / Make / n8n webhook) that appends rows to your sheet. Whenever you click <strong className="text-text-primary">"Push to Sheet"</strong> on any prospect, BreachGuard instantly transmits company, domain, contact info, pain category, urgency score, and discussion link.
                </p>
              </div>

              <div>
                <label className="block text-text-secondary mb-1 font-medium">
                  Webhook URL (Google Apps Script / Webhook Endpoint)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={sheetWebhookUrlInput}
                  onChange={(e) => setSheetWebhookUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-text-primary font-mono text-xs focus:outline-none focus:border-border-strong"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-bg-inset border border-border-default text-2xs text-text-muted flex items-start gap-2">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-text-primary">No webhook configured yet?</strong> You can always click the <span className="font-semibold text-text-primary">&ldquo;Export Sheet CSV&rdquo;</span> button at the top of the Radar to instantly download formatted rows ready to copy/paste into Google Sheets.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast('Google Sheet Webhook URL saved!', 'success');
                    setIsWebhookModalOpen(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
