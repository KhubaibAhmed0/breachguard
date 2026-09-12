"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Globe, AlertTriangle, FileText, Settings, LogOut, 
  Shield, Building2, ChevronDown, Check, Plus, X, Loader2,
  Network, MailCheck, Radar, KeyRound
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Sidebar({ isMobile, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { tenants, activeTenant, setActiveTenant, addTenant, isMspUser } = useTenant();

  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  
  // New Client Tenant form states
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      await addTenant(newOrgName.trim(), newOrgDomain.trim(), newOrgAdminEmail.trim());
      setNewOrgName('');
      setNewOrgDomain('');
      setNewOrgAdminEmail('');
      setIsAddTenantOpen(false);
    } catch {
      setCreateError('Failed to provision client tenant organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/attack-surface', label: 'Attack Surface', icon: Network },
    { href: '/dashboard/email-security', label: 'Email Security', icon: MailCheck },
    { href: '/dashboard/threat-intelligence', label: 'Threat Intel', icon: Radar },
    { href: '/exposures', label: 'Credential Exposure', icon: KeyRound },
    { href: '/domains', label: 'Monitored Domains', icon: Globe },
    { href: '/reports', label: 'Audit Reports', icon: FileText },
    { href: '/settings', label: 'Organization Settings', icon: Settings },
  ];

  return (
    <>
      <aside className={cn("w-64 border-r border-border-default bg-bg-base flex flex-col h-full select-none shrink-0", className)}>
        {/* Brand Header */}
        <div className="p-4 border-b border-border-default">
          <div className="flex items-center justify-between mb-3">
            <Link 
              href="/dashboard" 
              onClick={() => onClose?.()}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-text-primary" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-text-primary">
                BreachGuard
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-bg-inset text-text-muted border border-border-default text-2xs font-mono">
                MSP
              </span>
              {isMobile && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Multi-Tenant MSP Switcher */}
          {isMspUser && (
            <div className="relative">
              <div className="text-2xs uppercase font-semibold text-text-faint tracking-wide mb-1 px-1 flex items-center justify-between">
                <span>Active Scope</span>
                <span className="text-text-muted font-normal lowercase">{tenants.length} tenants</span>
              </div>
              
              <button
                type="button"
                onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-bg-surface border border-border-default hover:border-border-strong hover:bg-bg-hover transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-medium text-text-secondary truncate leading-tight">
                      {activeTenant.name}
                    </div>
                    <div className="text-2xs text-text-faint leading-tight mt-0.5">
                      {activeTenant.type === 'primary' ? 'Primary MSP' : 'Client Tenant'}
                    </div>
                  </div>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-text-muted transition-transform duration-200 shrink-0", isTenantDropdownOpen && "rotate-180")} />
              </button>

              {/* Dropdown Menu */}
              {isTenantDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-bg-base border border-border-default rounded-xl shadow-2xl p-1.5 space-y-1">
                  <div className="px-2 py-1 text-2xs font-semibold uppercase text-text-faint tracking-wide">
                    Switch Client Tenant
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5">
                    {tenants.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTenant(t);
                          setIsTenantDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer",
                          activeTenant.id === t.id
                            ? "bg-bg-inset text-text-primary font-medium"
                            : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            t.type === 'primary' ? "bg-indigo-400" : "bg-green-400"
                          )} />
                          <span className="truncate">{t.name}</span>
                        </div>
                        {activeTenant.id === t.id && (
                          <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1.5 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTenantDropdownOpen(false);
                        setIsAddTenantOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-primary hover:text-text-primary hover:bg-bg-hover rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Client Tenant</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive 
                    ? "bg-bg-hover text-text-primary font-semibold" 
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-text-primary" : "text-text-muted")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border-default">
          <div className="flex items-center justify-between p-2 rounded-lg bg-bg-surface border border-border-default">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-bg-inset border border-border-strong flex items-center justify-center text-2xs font-medium text-text-secondary">
                AU
              </div>
              <div className="truncate text-xs">
                <div className="font-medium text-text-secondary truncate">admin@acme.com</div>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Sign out"
              className="p-1 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Add Client Tenant Modal */}
      {isAddTenantOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-base border border-border-default rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-text-secondary">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">Provision Client Tenant Organization</h3>
              </div>
              <button 
                onClick={() => setIsAddTenantOpen(false)} 
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">
                  Client Organization Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. MedTech Clinic or Apex Law"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary placeholder-text-faint text-xs focus:outline-none focus:border-border-strong"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">
                  Primary Client Domain
                </label>
                <input 
                  type="text"
                  placeholder="e.g. medtech-clinic.com"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary placeholder-text-faint text-xs focus:outline-none focus:border-border-strong"
                />
                <p className="text-2xs text-text-faint mt-1">
                  Domain will be automatically scheduled for continuous dark web exposure discovery.
                </p>
              </div>

              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">
                  Client Administrator Email
                </label>
                <input 
                  type="email"
                  placeholder="e.g. security-lead@medtech-clinic.com"
                  value={newOrgAdminEmail}
                  onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-default rounded-md text-text-primary placeholder-text-faint text-xs focus:outline-none focus:border-border-strong"
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded bg-red-500/8 border border-red-500/20 text-xs text-red-300">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTenantOpen(false)}
                  className="px-3.5 py-1.5 rounded-md text-text-muted hover:text-text-primary border border-border-default hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    'Provision Client Tenant'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}