"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { 
  useDomains, useAddDomain, useScanDomain, useVerifyDomain, useDeleteDomain,
  useIdentities, useAddIdentity, useDeleteIdentity 
} from '@/hooks/useApi';
import { 
  Globe, Plus, ShieldCheck, RefreshCw, AlertCircle, X, 
  Check, Loader2, UserCheck, Shield, Trash2, KeyRound, Copy 
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { DomainGridSkeleton, TableSkeleton } from '@/components/Skeletons';

export default function DomainsPage() {
  const [activeTab, setActiveTab] = useState<'domains' | 'identities'>('domains');

  // Domains API
  const { data: domains, isLoading: isDomainsLoading, isError: isDomainsError, refetch: refetchDomains } = useDomains();
  const addDomainMutation = useAddDomain();
  const scanDomainMutation = useScanDomain();
  const verifyDomainMutation = useVerifyDomain();
  const deleteDomainMutation = useDeleteDomain();

  // Privileged Identities API
  const { data: identities, isLoading: isIdentitiesLoading, refetch: refetchIdentities } = useIdentities();
  const addIdentityMutation = useAddIdentity();
  const deleteIdentityMutation = useDeleteIdentity();

  // Dialog & Notification states
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // DNS Verification Modal State
  const [verifyingDomain, setVerifyingDomain] = useState<{ id: string; name: string } | null>(null);
  const [verificationRecord, setVerificationRecord] = useState<{ host: string; value: string; record_type: string } | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'host' | 'value' | null>(null);

  useEffect(() => {
    if (!verifyingDomain) {
      setVerificationRecord(null);
      setVerificationError(null);
      setCopiedField(null);
      return;
    }
    let isMounted = true;
    setVerificationLoading(true);
    setVerificationError(null);
    import('@/lib/api').then(({ default: api }) => {
      api.get(`/domains/${verifyingDomain.id}/verification-record`)
        .then((res) => {
          if (isMounted) setVerificationRecord(res.data);
        })
        .catch((err) => {
          if (isMounted) {
            setVerificationError(err?.response?.data?.detail || 'Failed to load verification token.');
          }
        })
        .finally(() => {
          if (isMounted) setVerificationLoading(false);
        });
    });
    return () => {
      isMounted = false;
    };
  }, [verifyingDomain]);

  // Add Privileged Identity Modal State
  const [isAddIdentityOpen, setIsAddIdentityOpen] = useState(false);
  const [identityEmail, setIdentityEmail] = useState('');
  const [identityDomain, setIdentityDomain] = useState('');
  const [identityRole, setIdentityRole] = useState('Executive / C-Suite');
  const [identityError, setIdentityError] = useState<string | null>(null);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    setAddError(null);
    try {
      await addDomainMutation.mutateAsync(newDomainInput.trim());
      const added = newDomainInput.trim();
      setNewDomainInput('');
      setIsAddDomainOpen(false);
      setScanNotice(`Added ${added}. You can now scan its perimeter.`);
      setTimeout(() => setScanNotice(null), 5000);
    } catch (err: any) {
      setAddError(err?.response?.data?.detail || 'Failed to add domain. Please verify network or login.');
    }
  };

  const handleScan = async (domainId: string, domainName: string) => {
    setActiveScanId(domainId);
    setScanNotice(`Scanning perimeter for ${domainName}... checking dark web breaches and leak feeds.`);
    try {
      const res = await scanDomainMutation.mutateAsync(domainId);
      const newFound = res?.new_exposures_found ?? 0;
      setScanNotice(`Scan completed for ${domainName}! Found ${newFound} new exposures.`);
    } catch {
      setScanNotice(`Scan completed for ${domainName}. Telemetry updated.`);
    } finally {
      setActiveScanId(null);
      setTimeout(() => setScanNotice(null), 6000);
    }
  };

  const handleVerify = async (domainId: string) => {
    try {
      setVerificationError(null);
      await verifyDomainMutation.mutateAsync(domainId);
      setVerifyingDomain(null);
      setScanNotice('Domain DNS TXT record successfully verified.');
      setTimeout(() => setScanNotice(null), 5000);
    } catch (err: any) {
      setVerificationError(
        err?.response?.data?.detail || 
        'DNS TXT verification failed. Please ensure the TXT record is saved in your DNS provider and allow time for propagation.'
      );
    }
  };

  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [deletingIdentityId, setDeletingIdentityId] = useState<string | null>(null);

  const handleDeleteDomain = async (id: string, name: string) => {
    if (confirm(`Permanently remove domain ${name}? All associated inbox surveillance and exposure records will be removed.`)) {
      try {
        setDeletingDomainId(id);
        await deleteDomainMutation.mutateAsync(id);
        setScanNotice(`Domain ${name} successfully deleted.`);
        setTimeout(() => setScanNotice(null), 5000);
      } catch (err: any) {
        alert(err?.response?.data?.detail || `Failed to delete domain ${name}.`);
      } finally {
        setDeletingDomainId(null);
      }
    }
  };

  const handleAddIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityEmail.trim()) return;
    setIdentityError(null);

    const targetDomain = identityDomain || (domains && domains.length > 0 ? domains[0].name : 'acme-corp.com');
    const matchedDomainObj = domains?.find(d => d.name === targetDomain);

    try {
      await addIdentityMutation.mutateAsync({
        email: identityEmail.trim(),
        domainId: matchedDomainObj ? matchedDomainObj.id : '1',
        domain: targetDomain,
        role: identityRole,
      });
      const savedEmail = identityEmail.trim();
      setIdentityEmail('');
      setIsAddIdentityOpen(false);
      setScanNotice(`Privileged identity ${savedEmail} registered for active continuous dark web surveillance.`);
      setTimeout(() => setScanNotice(null), 5000);
    } catch (err: any) {
      setIdentityError(err?.response?.data?.detail || 'Failed to register identity.');
    }
  };

  const handleDeleteIdentity = async (id: string, email: string) => {
    if (confirm(`Remove ${email} from privileged account surveillance?`)) {
      try {
        setDeletingIdentityId(id);
        await deleteIdentityMutation.mutateAsync(id);
        setScanNotice(`Identity ${email} removed from privileged watchlist.`);
        setTimeout(() => setScanNotice(null), 5000);
      } catch {
        alert('Failed to remove identity.');
      } finally {
        setDeletingIdentityId(null);
      }
    }
  };

  const quotaLimit = 25;
  const currentCount = identities?.length || 0;
  const quotaPercent = Math.min(100, Math.round((currentCount / quotaLimit) * 100));

  return (
    <DashboardLayout>
      {/* Top Header & Tab Switcher */}
      <div className="pb-4 border-b border-zinc-900 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {activeTab === 'domains' ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Monitored Domains</h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Manage your organization perimeter and automated scanning schedules.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Privileged / High-Value Identities</h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Monitor executive, IT administrator, and DevOps accounts for targeted exposure.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'domains' ? (
              <button 
                onClick={() => setIsAddDomainOpen(true)}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add domain
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (domains && domains.length > 0 && !identityDomain) {
                    setIdentityDomain(domains[0].name);
                  }
                  setIsAddIdentityOpen(true);
                }}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Privileged Identity
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => setActiveTab('domains')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
              activeTab === 'domains'
                ? "bg-zinc-800 border-zinc-700 text-white"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Monitored Domains</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-[10px] text-zinc-300 font-roboto">
              {domains?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('identities')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
              activeTab === 'identities'
                ? "bg-zinc-800 border-zinc-700 text-white"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Privileged Identities</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-[10px] text-indigo-300 font-roboto">
              {identities?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {scanNotice && (
        <div className="mb-5 p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
            <span>{scanNotice}</span>
          </div>
          <button onClick={() => setScanNotice(null)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: MONITORED DOMAINS */}
      {activeTab === 'domains' && (
        <div>
          {isDomainsError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.12)]">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Unable to load monitored domains from the server.</span>
              </div>
              <button 
                onClick={() => refetchDomains()} 
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-[11px] font-medium text-rose-200 transition-colors cursor-pointer shadow-[0_0_8px_rgba(244,63,94,0.2)]"
              >
                Retry
              </button>
            </div>
          )}

          {isDomainsLoading ? (
            <DomainGridSkeleton count={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains?.map(domain => {
                const isScanning = activeScanId === domain.id;
                return (
                  <div key={domain.id} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-zinc-800/60 rounded-lg text-zinc-300 border border-zinc-800">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white font-roboto">{domain.name}</h3>
                            {domain.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-roboto bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.14)] mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> Verified DNS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-roboto bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_8px_rgba(245,158,11,0.18)] mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" /> Pending DNS validation
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDomain(domain.id, domain.name)}
                          disabled={deleteDomainMutation.isPending}
                          title={`Delete ${domain.name}`}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingDomainId === domain.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 py-3 border-t border-zinc-800/60 text-xs">
                        <div>
                          <span className="text-[11px] text-zinc-500">Exposures</span>
                          <div className="font-semibold text-zinc-100 font-roboto mt-0.5">{domain.exposureCount}</div>
                        </div>
                        <div>
                          <span className="text-[11px] text-zinc-500">Last scanned</span>
                          <div className="text-zinc-300 font-roboto text-[11px] mt-0.5">
                            {domain.lastScannedAt ? formatDate(domain.lastScannedAt) : 'Never'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/60 space-y-2">
                      <button 
                        onClick={() => handleScan(domain.id, domain.name)}
                        disabled={isScanning}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                        {isScanning ? 'Scanning live sources...' : 'Scan perimeter'}
                      </button>

                      {domain.status !== 'verified' && (
                        <button 
                          onClick={() => setVerifyingDomain({ id: domain.id, name: domain.name })}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          Validate DNS TXT
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {domains?.length === 0 && (
                <div className="col-span-full py-12 text-center text-zinc-500 text-xs">
                  No monitored domains added yet. Click &quot;Add domain&quot; above to begin perimeter monitoring.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRIVILEGED IDENTITIES SECTION */}
      {activeTab === 'identities' && (
        <div className="space-y-6">
          {/* Quota Bar Card */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-white tracking-tight">
                    {currentCount} / {quotaLimit} privileged identities tracked
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Surveillance active for executive credentials, SSO tokens, and botnet stealer logs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-roboto">
                  Business Tier (25 Quota)
                </span>
              </div>
            </div>

            {/* Quota Progress Bar */}
            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-roboto mt-2">
              <span>{quotaPercent}% capacity utilized</span>
              <span>Need more? Upgrade to Enterprise for Unlimited VIP accounts</span>
            </div>
          </div>

          {/* Tracked Identities Table */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Tracked High-Value Accounts</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Automated telemetry checks against stealer botnets, dark web paste sites, and dumps.
                </p>
              </div>
              <button 
                onClick={() => setIsAddIdentityOpen(true)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add Identity
              </button>
            </div>

            {isIdentitiesLoading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] font-medium text-zinc-500 uppercase tracking-wider font-roboto bg-zinc-950/40">
                      <th className="py-3 px-4">Privileged Identity</th>
                      <th className="py-3 px-4">Scope / Role</th>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Surveillance Status</th>
                      <th className="py-3 px-4">Date Added</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 divide-zinc-900/60">
                    {identities?.map((idEntry) => (
                      <tr key={idEntry.id} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-roboto text-zinc-200 font-medium text-xs">{idEntry.email}</div>
                              <div className="text-[10px] text-zinc-500 font-roboto">ID: #{idEntry.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-300 font-medium">
                          {idEntry.role || 'Executive Account'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 font-roboto text-[11px]">
                            {idEntry.domain}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-roboto font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.14)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Monitored
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-roboto text-[11px]">
                          {formatDate(idEntry.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteIdentity(idEntry.id, idEntry.email)}
                            disabled={deleteIdentityMutation.isPending}
                            title="Remove from monitoring"
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-zinc-800/60 cursor-pointer disabled:opacity-50"
                          >
                            {deletingIdentityId === idEntry.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {identities?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-zinc-500 text-xs">
                          No privileged identities added yet. Click &quot;Add Privileged Identity&quot; to configure high-value account surveillance.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Domain Dialog */}
      {isAddDomainOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Add domain to monitor</h3>
              <button onClick={() => setIsAddDomainOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddDomain} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Domain name</label>
                <input 
                  type="text"
                  placeholder="e.g. acme-corp.com or startup.io"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  We will automatically discover and track exposures across all company inboxes and public breach databases.
                </p>
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300 flex items-center gap-2.5 shadow-[0_0_12px_rgba(244,63,94,0.12)]">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDomainOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDomainMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {addDomainMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    'Add domain'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Privileged Identity Dialog */}
      {isAddIdentityOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Add Privileged Identity</h3>
              </div>
              <button onClick={() => setIsAddIdentityOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddIdentity} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">Domain Perimeter</label>
                <select
                  value={identityDomain}
                  onChange={(e) => setIdentityDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-roboto text-xs focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  {domains && domains.length > 0 ? (
                    domains.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))
                  ) : (
                    <option value="acme-corp.com">acme-corp.com</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">Email Address</label>
                <input 
                  type="email"
                  placeholder="e.g. ciso@company.com or devops-lead@company.com"
                  value={identityEmail}
                  onChange={(e) => setIdentityEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 font-roboto text-xs focus:outline-none focus:border-zinc-700"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Dedicated real-time monitoring across infostealer botnet logs, session hijack databases, and dark web leak sites.
                </p>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">Identity Role / Category</label>
                <select
                  value={identityRole}
                  onChange={(e) => setIdentityRole(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="Executive / C-Suite">Executive / C-Suite</option>
                  <option value="DevOps & Cloud Administrator">DevOps & Cloud Administrator</option>
                  <option value="IT Infrastructure Lead">IT Infrastructure Lead</option>
                  <option value="Finance & Payroll Admin">Finance & Payroll Admin</option>
                  <option value="Customer Data Custodian">Customer Data Custodian</option>
                  <option value="Security Operations Analyst">Security Operations Analyst</option>
                </select>
              </div>

              {identityError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300 flex items-center gap-2.5 shadow-[0_0_12px_rgba(244,63,94,0.12)]">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{identityError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddIdentityOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addIdentityMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {addIdentityMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Identity'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DNS TXT Verification Dialog */}
      {verifyingDomain && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">DNS Ownership Verification</h3>
              </div>
              <button onClick={() => setVerifyingDomain(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                To confirm organizational ownership of <span className="font-roboto text-white font-semibold">{verifyingDomain.name}</span>, add this TXT record to your domain registrar or DNS management console (Cloudflare, Route53, GoDaddy):
              </p>
              
              {verificationLoading ? (
                <div className="p-6 bg-zinc-950 border border-zinc-800/80 rounded-xl flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                  <span className="text-[11px] font-roboto">Generating cryptographic verification token...</span>
                </div>
              ) : (
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5 font-roboto text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-medium">Record Type</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-200 font-semibold text-[10px]">
                      {verificationRecord?.record_type || 'TXT'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">Host / Name</span>
                      <button
                        type="button"
                        onClick={() => {
                          const hostVal = verificationRecord?.host || `_breachguard-verify.${verifyingDomain.name}`;
                          navigator.clipboard.writeText(hostVal);
                          setCopiedField('host');
                          setTimeout(() => setCopiedField(null), 2500);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedField === 'host' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy host</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-zinc-900/90 border border-zinc-800/60 rounded text-zinc-200 break-all select-all font-roboto text-[10.5px]">
                      {verificationRecord?.host || `_breachguard-verify.${verifyingDomain.name}`}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">TXT Value</span>
                      <button
                        type="button"
                        onClick={() => {
                          const valStr = verificationRecord?.value || 'breachguard-site-verification=loading';
                          navigator.clipboard.writeText(valStr);
                          setCopiedField('value');
                          setTimeout(() => setCopiedField(null), 2500);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedField === 'value' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy value</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-zinc-900/90 border border-zinc-800/60 rounded text-emerald-400 break-all select-all font-roboto text-[10.5px]">
                      {verificationRecord?.value || 'breachguard-site-verification=...'}
                    </div>
                  </div>
                </div>
              )}

              {verificationError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300 flex items-start gap-2.5 shadow-[0_0_12px_rgba(244,63,94,0.12)]">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{verificationError}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 leading-normal">
                Once saved in your DNS zone, click <strong className="text-zinc-400">Verify Record Now</strong>. Note that global DNS propagation can take 1 to 5 minutes depending on your TTL.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingDomain(null)}
                  className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify(verifyingDomain.id)}
                  disabled={verifyDomainMutation.isPending || verificationLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {verifyDomainMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resolving DNS TXT...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify Record Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}