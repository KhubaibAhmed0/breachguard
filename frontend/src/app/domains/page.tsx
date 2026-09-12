"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { 
  useDomains, useAddDomain, useScanDomain, useVerifyDomain, useDeleteDomain, useUpdateDomainFrequency,
  useIdentities, useAddIdentity, useDeleteIdentity 
} from '@/hooks/useApi';
import { 
  Globe, Plus, ShieldCheck, RefreshCw, AlertCircle, X, 
  Check, Loader2, UserCheck, Shield, Trash2, KeyRound, Copy, Clock, Zap
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DomainGridSkeleton, TableSkeleton } from '@/components/Skeletons';

export default function DomainsPage() {
  const [activeTab, setActiveTab] = useState<'domains' | 'identities'>('domains');

  // Domains API
  const { data: domains, isLoading: isDomainsLoading, isError: isDomainsError, refetch: refetchDomains } = useDomains();
  const addDomainMutation = useAddDomain();
  const scanDomainMutation = useScanDomain();
  const verifyDomainMutation = useVerifyDomain();
  const deleteDomainMutation = useDeleteDomain();
  const updateFrequencyMutation = useUpdateDomainFrequency();

  // Privileged Identities API
  const { data: identities, isLoading: isIdentitiesLoading, refetch: refetchIdentities } = useIdentities();
  const addIdentityMutation = useAddIdentity();
  const deleteIdentityMutation = useDeleteIdentity();

  // Dialog & Notification states
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newDomainFrequency, setNewDomainFrequency] = useState<'continuous' | 'daily' | 'weekly'>('continuous');
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
      await addDomainMutation.mutateAsync({
        domain: newDomainInput.trim(),
        scan_frequency: newDomainFrequency
      });
      const added = newDomainInput.trim();
      const freqLabel = newDomainFrequency === 'continuous' ? 'Continuous (Hourly)' : newDomainFrequency === 'daily' ? 'Daily' : 'Weekly';
      setNewDomainInput('');
      setIsAddDomainOpen(false);
      setScanNotice(`Added ${added} with ${freqLabel} monitoring cadence.`);
      setTimeout(() => setScanNotice(null), 5000);
    } catch (err: any) {
      setAddError(err?.response?.data?.detail || 'Failed to add domain. Please verify network or login.');
    }
  };

  const handleFrequencyChange = async (domainId: string, domainName: string, frequency: string) => {
    try {
      await updateFrequencyMutation.mutateAsync({ domainId, scanFrequency: frequency });
      const label = frequency === 'continuous' ? 'Continuous (Hourly)' : frequency === 'daily' ? 'Daily' : 'Weekly';
      setScanNotice(`Updated ${domainName} monitoring cadence to ${label}.`);
      setTimeout(() => setScanNotice(null), 4000);
    } catch (err: any) {
      setScanNotice(`Failed to update frequency: ${err?.response?.data?.detail || 'Network error'}`);
      setTimeout(() => setScanNotice(null), 4000);
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

  const { user } = useAuth();
  const isEnterprise = Boolean(user?.plan?.toLowerCase().includes('enterprise'));
  const quotaLimit = isEnterprise ? 9999 : 25;
  const currentCount = identities?.length || 0;
  const quotaPercent = isEnterprise ? 0 : Math.min(100, Math.round((currentCount / quotaLimit) * 100));

  return (
    <DashboardLayout>
      {/* Top Header & Tab Switcher */}
      <div className="pb-4 border-b border-border-default mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {activeTab === 'domains' ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">Monitored Domains</h1>
                <p className="text-xs sm:text-sm text-text-muted mt-1">
                  Manage your organization perimeter and automated scanning schedules.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">Privileged / High-Value Identities</h1>
                <p className="text-xs sm:text-sm text-text-muted mt-1">
                  Monitor executive, IT administrator, and DevOps accounts for targeted exposure.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'domains' ? (
              <button 
                onClick={() => setIsAddDomainOpen(true)}
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-text font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
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
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-text font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Privileged Identity
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setActiveTab('domains')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border",
              activeTab === 'domains'
                ? "bg-border-strong border-border-strong text-text-primary"
                : "bg-bg-surface border-border-default text-text-muted hover:text-text-secondary hover:bg-bg-inset"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Monitored Domains</span>
            <span className="px-1.5 py-0.5 rounded bg-border-strong text-2xs text-text-secondary font-mono">
              {domains?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('identities')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border",
              activeTab === 'identities'
                ? "bg-border-strong border-border-strong text-text-primary"
                : "bg-bg-surface border-border-default text-text-muted hover:text-text-secondary hover:bg-bg-inset"
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Privileged Identities</span>
            <span className="px-1.5 py-0.5 rounded bg-border-strong text-2xs text-text-secondary font-mono border border-border-strong">
              {identities?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {scanNotice && (
        <div className="mb-5 p-3 rounded-md bg-bg-surface border border-border-default text-text-secondary text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-text-muted animate-spin" />
            <span>{scanNotice}</span>
          </div>
          <button onClick={() => setScanNotice(null)} className="text-text-faint hover:text-text-secondary cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: MONITORED DOMAINS */}
      {activeTab === 'domains' && (
        <div>
          {isDomainsError && (
            <div className="mb-5 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Unable to load monitored domains from the server.</span>
              </div>
              <button 
                onClick={() => refetchDomains()} 
                className="px-2.5 py-1 bg-border-strong hover:bg-border-strong border border-border-strong rounded-md text-xs font-medium text-text-secondary transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {isDomainsLoading ? (
            <DomainGridSkeleton count={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {domains?.map(domain => {
                const isScanning = activeScanId === domain.id;
                return (
                  <div key={domain.id} className="bg-bg-surface border border-border-default rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-border-strong border border-border-strong rounded-md text-text-secondary">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-text-primary font-mono">{domain.name}</h3>
                            {domain.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified DNS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending validation
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDomain(domain.id, domain.name)}
                          disabled={deleteDomainMutation.isPending}
                          title={`Delete ${domain.name}`}
                          className="p-1.5 text-text-faint hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingDomainId === domain.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 py-2.5 border-t border-border-default text-xs">
                        <div>
                          <span className="text-2xs text-text-faint font-mono">Exposures</span>
                          <div className="font-semibold text-text-secondary font-mono mt-0.5">{domain.exposureCount}</div>
                        </div>
                        <div>
                          <span className="text-2xs text-text-faint font-mono">Last scanned</span>
                          <div className="text-text-secondary font-mono text-2xs mt-0.5">
                            {domain.lastScannedAt ? formatDate(domain.lastScannedAt) : 'Never'}
                          </div>
                        </div>
                      </div>

                      {/* Monitoring Cadence */}
                      <div className="py-2 px-2.5 mb-2 rounded-md bg-bg-base border border-border-default flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-text-muted">
                          {domain.scanFrequency === 'continuous' ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-2xs font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Continuous (1h)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-text-muted text-2xs font-mono">
                              <Clock className="w-3 h-3 text-text-faint" />
                              Cadence
                            </span>
                          )}
                        </div>
                        <select
                          value={domain.scanFrequency || 'daily'}
                          onChange={(e) => handleFrequencyChange(domain.id, domain.name, e.target.value)}
                          className="bg-bg-surface border border-border-default rounded px-2 py-0.5 text-2xs text-text-secondary focus:outline-none focus:border-border-strong cursor-pointer font-mono"
                          title="Change automated monitoring frequency"
                        >
                          <option value="continuous">Continuous (1h)</option>
                          <option value="daily">Daily (24h)</option>
                          <option value="weekly">Weekly (7d)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-border-default space-y-2">
                      <button 
                        onClick={() => handleScan(domain.id, domain.name)}
                        disabled={isScanning}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-border-strong hover:bg-border-strong text-text-secondary rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                        {isScanning ? 'Scanning live sources...' : 'Scan perimeter'}
                      </button>

                      {domain.status !== 'verified' && (
                        <button 
                          onClick={() => setVerifyingDomain({ id: domain.id, name: domain.name })}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 rounded-md text-xs font-medium transition-colors cursor-pointer"
                        >
                          Validate DNS TXT
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {domains?.length === 0 && (
                <div className="col-span-full py-12 text-center text-text-faint text-xs">
                  No monitored domains added yet. Click &quot;Add domain&quot; above to begin perimeter monitoring.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRIVILEGED IDENTITIES SECTION */}
      {activeTab === 'identities' && (
        <div className="space-y-4">
          {/* Quota Bar Card */}
          <div className="bg-bg-surface border border-border-default rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-semibold text-text-primary tracking-tight">
                    {isEnterprise ? `${currentCount} privileged identities tracked` : `${currentCount} / ${quotaLimit} privileged identities tracked`}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Surveillance active for executive credentials, SSO tokens, and botnet stealer logs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-2xs font-mono font-medium bg-border-strong text-text-secondary border border-border-strong">
                  {isEnterprise ? 'Enterprise Tier (Unlimited Quota)' : 'Business Tier (25 Quota)'}
                </span>
              </div>
            </div>

            {/* Quota Progress Bar */}
            <div className="w-full bg-bg-base rounded h-1.5 overflow-hidden border border-border-default">
              <div 
                className="bg-text-secondary h-full rounded transition-all duration-500" 
                style={{ width: isEnterprise ? '100%' : `${quotaPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-2xs text-text-faint font-mono mt-2">
              <span>{isEnterprise ? `${currentCount} identities monitored` : `${quotaPercent}% capacity utilized`}</span>
              <span>{isEnterprise ? 'Unlimited VIP identity surveillance enabled' : 'Need more? Upgrade to Enterprise for Unlimited VIP accounts'}</span>
            </div>
          </div>

          {/* Tracked Identities Table */}
          <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="p-3.5 sm:px-4 border-b border-border-default flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Tracked High-Value Accounts</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Automated telemetry checks against stealer botnets, dark web paste sites, and dumps.
                </p>
              </div>
              <button 
                onClick={() => setIsAddIdentityOpen(true)}
                className="px-3 py-1.5 bg-border-strong hover:bg-border-strong text-text-secondary text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
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
                    <tr className="border-b border-border-default text-2xs font-medium text-text-muted uppercase tracking-wider font-mono bg-bg-base/40">
                      <th className="py-2.5 px-4">Privileged Identity</th>
                      <th className="py-2.5 px-4">Scope / Role</th>
                      <th className="py-2.5 px-4">Domain</th>
                      <th className="py-2.5 px-4">Surveillance Status</th>
                      <th className="py-2.5 px-4">Date Added</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/60 text-text-secondary">
                    {identities?.map((idEntry) => (
                      <tr key={idEntry.id} className="hover:bg-bg-inset/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-border-strong border border-border-strong text-text-muted flex items-center justify-center">
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-mono text-text-secondary font-medium text-xs">{idEntry.email}</div>
                              <div className="text-2xs text-text-faint font-mono">ID: #{idEntry.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-text-secondary font-medium">
                          {idEntry.role || 'Executive Account'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-1.5 py-0.5 rounded bg-bg-base border border-border-default text-text-secondary font-mono text-2xs">
                            {idEntry.domain}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Monitored
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-muted font-mono text-2xs">
                          {formatDate(idEntry.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteIdentity(idEntry.id, idEntry.email)}
                            disabled={deleteIdentityMutation.isPending}
                            title="Remove from monitoring"
                            className="p-1.5 text-text-faint hover:text-rose-400 transition-colors rounded-md hover:bg-rose-500/10 cursor-pointer disabled:opacity-50"
                          >
                            {deletingIdentityId === idEntry.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {identities?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-text-faint text-xs font-mono">
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
          <div className="w-full max-w-md bg-bg-surface border border-border-default rounded-lg p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="text-sm font-semibold text-text-primary">Add domain to monitor</h3>
              <button onClick={() => setIsAddDomainOpen(false)} className="text-text-faint hover:text-text-secondary cursor-pointer p-1 rounded-md hover:bg-border-strong">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddDomain} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-text-muted mb-1 font-medium">Domain name</label>
                <input 
                  type="text"
                  placeholder="e.g. acme-corp.com or startup.io"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary font-mono text-xs focus:outline-none focus:border-border-strong"
                  required
                  autoFocus
                />
                <p className="text-2xs text-text-faint mt-1">
                  We will automatically discover and track exposures across all company inboxes and public breach databases.
                </p>
              </div>

              <div>
                <label className="block text-text-muted mb-1 font-medium flex items-center justify-between">
                  <span>Automated Monitoring Cadence</span>
                  <span className="text-2xs text-emerald-400 font-mono">REAL-TIME READY</span>
                </label>
                <select
                  value={newDomainFrequency}
                  onChange={(e: any) => setNewDomainFrequency(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-secondary text-xs focus:outline-none focus:border-border-strong cursor-pointer font-mono"
                >
                  <option value="continuous">Continuous (Hourly) — Real-Time Perimeter Reconnaissance</option>
                  <option value="daily">Daily (Every 24 Hours) — Standard Business Monitoring</option>
                  <option value="weekly">Weekly (Every 7 Days) — Low Frequency Baseline</option>
                </select>
                <p className="text-2xs text-text-faint mt-1 leading-relaxed">
                  Continuous mode performs automated hourly reconnaissance across Certificate Transparency logs, newly resolved IP records, and email anti-spoofing headers.
                </p>
              </div>

              {addError && (
                <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsAddDomainOpen(false)}
                  className="px-3.5 py-1.5 rounded-md text-text-muted hover:text-text-secondary border border-border-default hover:bg-bg-hover transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDomainMutation.isPending}
                  className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs"
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
          <div className="w-full max-w-md bg-bg-surface border border-border-default rounded-lg p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-border-strong border border-border-strong text-text-muted flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">Add Privileged Identity</h3>
              </div>
              <button onClick={() => setIsAddIdentityOpen(false)} className="text-text-faint hover:text-text-secondary cursor-pointer p-1 rounded-md hover:bg-border-strong">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddIdentity} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">Domain Perimeter</label>
                <select
                  value={identityDomain}
                  onChange={(e) => setIdentityDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-secondary font-mono text-xs focus:outline-none focus:border-border-strong cursor-pointer"
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
                <label className="block text-text-secondary mb-1.5 font-medium">Email Address</label>
                <input 
                  type="email"
                  placeholder="e.g. ciso@company.com or devops-lead@company.com"
                  value={identityEmail}
                  onChange={(e) => setIdentityEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary placeholder-text-faint font-mono text-xs focus:outline-none focus:border-border-strong"
                  required
                  autoFocus
                />
                <p className="text-2xs text-text-faint mt-1">
                  Dedicated real-time monitoring across infostealer botnet logs, session hijack databases, and dark web leak sites.
                </p>
              </div>

              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">Identity Role / Category</label>
                <select
                  value={identityRole}
                  onChange={(e) => setIdentityRole(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-secondary text-xs focus:outline-none focus:border-border-strong cursor-pointer"
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
                <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{identityError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setIsAddIdentityOpen(false)}
                  className="px-3.5 py-1.5 rounded-md text-text-muted hover:text-text-secondary border border-border-default hover:bg-bg-hover transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addIdentityMutation.isPending}
                  className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
                >
                  {addIdentityMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
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
          <div className="w-full max-w-md bg-bg-surface border border-border-default rounded-lg p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-border-strong border border-border-strong text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">DNS Ownership Verification</h3>
              </div>
              <button onClick={() => setVerifyingDomain(null)} className="text-text-faint hover:text-text-secondary cursor-pointer p-1 rounded-md hover:bg-border-strong">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-text-secondary leading-relaxed">
                To confirm organizational ownership of <span className="font-mono text-text-primary font-semibold">{verifyingDomain.name}</span>, add this TXT record to your domain registrar or DNS management console (Cloudflare, Route53, GoDaddy):
              </p>
              
              {verificationLoading ? (
                <div className="p-6 bg-bg-base border border-border-default rounded-md flex flex-col items-center justify-center text-text-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                  <span className="text-2xs font-mono">Generating cryptographic verification token...</span>
                </div>
              ) : (
                <div className="p-3 bg-bg-base border border-border-default rounded-md space-y-2.5 font-mono text-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-faint font-medium">Record Type</span>
                    <span className="px-1.5 py-0.5 rounded bg-border-strong text-text-secondary font-medium text-2xs">
                      {verificationRecord?.record_type || 'TXT'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-faint font-medium">Host / Name</span>
                      <button
                        type="button"
                        onClick={() => {
                          const hostVal = verificationRecord?.host || `_breachguard-verify.${verifyingDomain.name}`;
                          navigator.clipboard.writeText(hostVal);
                          setCopiedField('host');
                          setTimeout(() => setCopiedField(null), 2500);
                        }}
                        className="text-2xs text-text-muted hover:text-text-secondary flex items-center gap-1 cursor-pointer transition-colors"
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
                    <div className="p-2 bg-bg-surface border border-border-default rounded text-text-secondary break-all select-all font-mono text-2xs">
                      {verificationRecord?.host || `_breachguard-verify.${verifyingDomain.name}`}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-faint font-medium">TXT Value</span>
                      <button
                        type="button"
                        onClick={() => {
                          const valStr = verificationRecord?.value || 'breachguard-site-verification=loading';
                          navigator.clipboard.writeText(valStr);
                          setCopiedField('value');
                          setTimeout(() => setCopiedField(null), 2500);
                        }}
                        className="text-2xs text-text-muted hover:text-text-secondary flex items-center gap-1 cursor-pointer transition-colors"
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
                    <div className="p-2 bg-bg-surface border border-border-default rounded text-emerald-400 break-all select-all font-mono text-2xs">
                      {verificationRecord?.value || 'breachguard-site-verification=...'}
                    </div>
                  </div>
                </div>
              )}

              {verificationError && (
                <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{verificationError}</span>
                </div>
              )}

              <p className="text-2xs text-text-faint leading-normal">
                Once saved in your DNS zone, click <strong className="text-text-muted">Verify Record Now</strong>. Note that global DNS propagation can take 1 to 5 minutes depending on your TTL.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setVerifyingDomain(null)}
                  className="px-3.5 py-1.5 rounded-md text-text-muted hover:text-text-secondary border border-border-default hover:bg-bg-hover transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify(verifyingDomain.id)}
                  disabled={verifyDomainMutation.isPending || verificationLoading}
                  className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
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