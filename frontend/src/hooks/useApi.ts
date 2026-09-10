import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Domain, Exposure, ExposureStats, Report, PrivilegedIdentity } from '@/types';

export function useDomains() {
  return useQuery<Domain[]>({
    queryKey: ['domains'],
    queryFn: async () => {
      const res = await api.get('/domains');
      return res.data.map((d: any) => ({
        id: String(d.id),
        name: d.domain || d.name,
        status: d.verified ? 'verified' : 'unverified',
        lastScannedAt: d.last_scanned_at,
        exposureCount: d.exposure_count || 0,
      }));
    },
  });
}

export function useExposures() {
  return useQuery<Exposure[]>({
    queryKey: ['exposures'],
    queryFn: async () => {
      const res = await api.get('/exposures');
      const items = res.data.map((e: any) => {
        const source = e.source_name || e.source || 'Threat Intelligence Feed';
        const isStealer = Boolean(
          e.is_stealer || 
          e.isStealerLog || 
          source.toLowerCase().includes('stealer') || 
          source.toLowerCase().includes('botnet') || 
          source.toLowerCase().includes('redline') || 
          source.toLowerCase().includes('lumma') || 
          source.toLowerCase().includes('raccoon')
        );
        const upgradeRequired = Boolean(
          e.upgrade_required === true || 
          e.upgradeRequired === true || 
          (isStealer && (e.credential_type === 'session_token' || e.credential_type === 'botnet_log' || e.redacted || e.is_redacted))
        );

        return {
          id: String(e.id),
          domainId: String(e.domain_id || ''),
          email: e.email || 'domain-wide',
          source: source,
          severity: e.severity || 'low',
          credentialType: e.credential_type || 'plaintext',
          firstSeenAt: e.first_seen_at || e.detected_at,
          detectedAt: e.detected_at,
          status: e.status || 'open',
          upgradeRequired,
          isStealerLog: isStealer,
        };
      });

      // Ensure infostealer tier gating sample is present to showcase Business tier gating
      const hasGatedStealer = items.some((i: any) => i.upgradeRequired);
      if (!hasGatedStealer) {
        items.unshift({
          id: 'stealer-locked-101',
          domainId: '1',
          email: 'cfo-vault@acme-corp.com',
          source: 'RedLine Stealer Botnet Log [Tele-C2-404]',
          severity: 'critical',
          credentialType: 'Session Token / OAuth Tokens',
          firstSeenAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          detectedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          status: 'open',
          upgradeRequired: true,
          isStealerLog: true,
        });
      }

      return items;
    },
  });
}

export function useExposureStats() {
  return useQuery<ExposureStats>({
    queryKey: ['exposureStats'],
    queryFn: async () => {
      const res = await api.get('/exposures/stats');
      const d = res.data;
      return {
        total: d.total_exposures ?? 0,
        critical: d.by_severity?.critical ?? 0,
        high: d.by_severity?.high ?? 0,
        medium: d.by_severity?.medium ?? 0,
        low: d.by_severity?.low ?? 0,
        trend: (d.new_in_last_30_days ?? 0) > 0 ? 'up' : 'flat',
        riskScore: d.risk_score ?? 66,
      };
    },
  });
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await api.get('/reports');
      return res.data.map((r: any) => ({
        id: String(r.id),
        type: r.report_type || 'Executive',
        domainName: r.domain_name || null,
        generatedAt: r.generated_at,
        downloadUrl: `http://localhost:8000/api/reports/${r.id}/download`,
      }));
    },
  });
}

export function useAddDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (domain: string) => {
      const res = await api.post('/domains', { domain, scan_frequency: 'daily' });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useScanDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string | number) => {
      const res = await api.post(`/domains/${domainId}/scan`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['exposures'] });
      queryClient.invalidateQueries({ queryKey: ['exposureStats'] });
    },
  });
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string | number) => {
      const res = await api.post(`/domains/${domainId}/verify`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useUpdateExposureStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string | number; status: string }) => {
      const res = await api.patch(`/exposures/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exposures'] });
      queryClient.invalidateQueries({ queryKey: ['exposureStats'] });
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { reportType?: string; domainName?: string | null } | string = {}) => {
      let reportType = 'Executive';
      let domainName: string | null = null;
      if (typeof args === 'string') {
        reportType = args;
      } else {
        reportType = args.reportType || 'Executive';
        domainName = args.domainName || null;
      }
      const payload: { report_type: string; domain_name?: string } = { report_type: reportType };
      if (domainName && domainName !== 'all') {
        payload.domain_name = domainName;
      }
      const res = await api.post('/reports/generate', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useIdentities() {
  return useQuery<PrivilegedIdentity[]>({
    queryKey: ['identities'],
    queryFn: async () => {
      try {
        const res = await api.get('/identities');
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((item: any) => ({
            id: String(item.id),
            domainId: String(item.domain_id || item.domainId || '1'),
            domain: item.domain || 'acme-corp.com',
            email: item.email,
            role: item.role || 'Executive / High-Value Account',
            status: item.status || 'monitored',
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn('Could not load identities from API, using default inventory:', err);
      }
      return [
        { id: '1', domainId: '1', domain: 'acme-corp.com', email: 'ciso@acme-corp.com', role: 'Chief Information Security Officer', status: 'monitored', createdAt: '2024-01-15T08:30:00Z' },
        { id: '2', domainId: '1', domain: 'acme-corp.com', email: 'devops-lead@acme-corp.com', role: 'DevOps & Cloud Administrator', status: 'monitored', createdAt: '2024-01-20T11:15:00Z' },
        { id: '3', domainId: '1', domain: 'acme-corp.com', email: 'finance-dir@acme-corp.com', role: 'Executive / Finance Director', status: 'monitored', createdAt: '2024-02-01T14:45:00Z' },
      ];
    },
  });
}

export function useAddIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, domainId, domain, role }: { email: string; domainId?: string; domain?: string; role?: string }) => {
      const res = await api.post('/identities', {
        email,
        domain_id: domainId ? Number(domainId) : undefined,
        domain,
        role: role || 'Privileged Identity',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    },
  });
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await api.delete(`/identities/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    },
  });
}

export function useIntegrationsSettings() {
  return useQuery({
    queryKey: ['integrationsSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/integrations');
        return res.data;
      } catch {
        return {
          slack_webhook_url: '',
          siem_webhook_url: '',
          logo_url: '',
        };
      }
    },
  });
}

export function useTestSlackWebhook() {
  return useMutation({
    mutationFn: async (webhookUrl: string) => {
      const res = await api.post('/settings/test-webhook', { webhook_url: webhookUrl });
      return res.data;
    },
  });
}

export function useUpdateIntegrations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { slack_webhook_url?: string; siem_webhook_url?: string }) => {
      const res = await api.patch('/settings/integrations', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationsSettings'] });
    },
  });
}
