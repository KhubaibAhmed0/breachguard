"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant } from '@/types';
import api from '@/lib/api';

interface TenantContextType {
  tenants: Tenant[];
  activeTenant: Tenant;
  setActiveTenant: (tenant: Tenant) => void;
  addTenant: (name: string, primaryDomain?: string, adminEmail?: string) => Promise<Tenant>;
  isLoading: boolean;
  isMspUser: boolean;
}

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'primary',
    name: 'Acme MSP (Primary)',
    type: 'primary',
    plan: 'Enterprise / MSP',
    domainCount: 3,
    exposureCount: 18,
  },
  {
    id: 'client-1',
    name: 'Client: MedTech Clinic',
    type: 'client',
    plan: 'Business Client',
    domainCount: 2,
    exposureCount: 7,
  },
  {
    id: 'client-2',
    name: 'Client: Apex Law',
    type: 'client',
    plan: 'Business Client',
    domainCount: 1,
    exposureCount: 4,
  },
];

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(DEFAULT_TENANTS);
  const [activeTenant, setActiveTenantState] = useState<Tenant>(DEFAULT_TENANTS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMspUser] = useState(true);

  // Load from API or localStorage on mount
  useEffect(() => {
    const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem('bg_active_tenant_id') : null;
    
    // Fetch MSP tenants from API if available
    api.get('/msp/tenants')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped: Tenant[] = res.data.map((t: any) => ({
            id: String(t.id),
            name: t.name,
            type: t.type || (t.name.includes('(Primary)') ? 'primary' : 'client'),
            plan: t.plan || 'Business Client',
            domainCount: t.domain_count ?? t.domainCount ?? 0,
            exposureCount: t.exposure_count ?? t.exposureCount ?? 0,
          }));
          setTenants(mapped);

          if (savedTenantId) {
            const found = mapped.find(m => m.id === savedTenantId);
            if (found) {
              setActiveTenantState(found);
              return;
            }
          }
          setActiveTenantState(mapped[0]);
        }
      })
      .catch(() => {
        // Fall back to default tenants if API is unavailable
        if (savedTenantId) {
          const found = DEFAULT_TENANTS.find(t => t.id === savedTenantId);
          if (found) setActiveTenantState(found);
        }
      });
  }, []);

  const setActiveTenant = (tenant: Tenant) => {
    setActiveTenantState(tenant);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bg_active_tenant_id', tenant.id);
    }
  };

  const addTenant = async (name: string, primaryDomain?: string, adminEmail?: string): Promise<Tenant> => {
    setIsLoading(true);
    try {
      const res = await api.post('/msp/tenants', {
        name,
        primary_domain: primaryDomain,
        admin_email: adminEmail,
      });
      const newTenant: Tenant = {
        id: String(res.data.id || `client-${Date.now()}`),
        name: res.data.name.startsWith('Client:') ? res.data.name : `Client: ${res.data.name}`,
        type: 'client',
        plan: res.data.plan || 'Business Client',
        domainCount: res.data.domain_count ?? (primaryDomain ? 1 : 0),
        exposureCount: 0,
      };
      const updated = [...tenants, newTenant];
      setTenants(updated);
      setActiveTenant(newTenant);
      return newTenant;
    } catch {
      // Optimistic creation fallback
      const newTenant: Tenant = {
        id: `client-${Date.now()}`,
        name: name.startsWith('Client:') ? name : `Client: ${name}`,
        type: 'client',
        plan: 'Business Client',
        domainCount: primaryDomain ? 1 : 0,
        exposureCount: 0,
      };
      const updated = [...tenants, newTenant];
      setTenants(updated);
      setActiveTenant(newTenant);
      return newTenant;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenant,
        setActiveTenant,
        addTenant,
        isLoading,
        isMspUser,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
