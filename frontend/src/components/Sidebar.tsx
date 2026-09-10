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

export function Sidebar() {
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
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col h-screen select-none shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-900">
          <div className="flex items-center justify-between mb-3">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-zinc-100" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">
                BreachGuard
              </span>
            </Link>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-medium">
              MSP
            </span>
          </div>

          {/* Multi-Tenant MSP Switcher */}
          {isMspUser && (
            <div className="relative">
              <div className="text-[10px] uppercase font-mono font-medium text-zinc-500 mb-1 px-1 flex items-center justify-between">
                <span>Active Scope</span>
                <span className="text-zinc-600 font-mono">{tenants.length} tenants</span>
              </div>
              
              <button
                type="button"
                onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-medium text-zinc-200 truncate leading-tight">
                      {activeTenant.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono leading-tight mt-0.5">
                      {activeTenant.type === 'primary' ? 'Primary MSP' : 'Client Tenant'}
                    </div>
                  </div>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 shrink-0", isTenantDropdownOpen && "rotate-180")} />
              </button>

              {/* Dropdown Menu */}
              {isTenantDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-500">
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
                            ? "bg-zinc-800 text-white font-medium"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            t.type === 'primary' ? "bg-indigo-400" : "bg-emerald-400"
                          )} />
                          <span className="truncate">{t.name}</span>
                        </div>
                        {activeTenant.id === t.id && (
                          <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1.5 border-t border-zinc-850">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTenantDropdownOpen(false);
                        setIsAddTenantOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-zinc-900 rounded-lg font-medium transition-colors cursor-pointer"
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
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive 
                    ? "bg-zinc-900 text-zinc-100 font-semibold" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-zinc-100" : "text-zinc-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-900">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-900">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono font-medium text-zinc-300">
                AU
              </div>
              <div className="truncate text-xs">
                <div className="font-medium text-zinc-200 truncate">admin@acme.com</div>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Sign out"
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Add Client Tenant Modal */}
      {isAddTenantOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Provision Client Tenant Organization</h3>
              </div>
              <button 
                onClick={() => setIsAddTenantOpen(false)} 
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">
                  Client Organization Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. MedTech Clinic or Apex Law"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-700"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">
                  Primary Client Domain
                </label>
                <input 
                  type="text"
                  placeholder="e.g. medtech-clinic.com"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-zinc-700"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Domain will be automatically scheduled for continuous dark web exposure discovery.
                </p>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">
                  Client Administrator Email
                </label>
                <input 
                  type="email"
                  placeholder="e.g. security-lead@medtech-clinic.com"
                  value={newOrgAdminEmail}
                  onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-900/80 text-xs text-red-300">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTenantOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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