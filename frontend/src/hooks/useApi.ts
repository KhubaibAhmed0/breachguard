import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_BASE_URL } from '@/lib/api';
import { Domain, Exposure, ExposureStats, Report, PrivilegedIdentity } from '@/types';

export function useDomains() {
  return useQuery<Domain[]>({
    queryKey: ['domains'],
    queryFn: async () => {
      try {
        const res = await api.get('/domains');
        const list = Array.isArray(res.data) ? res.data : (res.data?.domains || []);
        if (Array.isArray(list)) {
          return list.map((d: any) => ({
            id: String(d.id),
            name: d.domain || d.name,
            status: d.verified ? 'verified' : 'unverified',
            lastScannedAt: d.last_scanned_at,
            exposureCount: d.exposure_count || 0,
            scanFrequency: d.scan_frequency || 'daily',
          }));
        }
      } catch (err) {
        console.warn('Could not load domains:', err);
      }
      return [];
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
          e.upgradeRequired === true
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

      return items;
    },
  });
}

export function useExposureTimeline() {
  return useQuery<{ month: string; count: number }[]>({
    queryKey: ['exposureTimeline'],
    queryFn: async () => {
      const res = await api.get('/exposures/timeline');
      return res.data?.timeline || [];
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
        riskScore: d.risk_score ?? 0,
      };
    },
  });
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      try {
        const res = await api.get('/reports');
        const list = Array.isArray(res.data) ? res.data : (res.data?.reports || []);
        if (Array.isArray(list)) {
          return list.map((r: any) => ({
            id: String(r.id),
            type: r.report_type || 'Executive',
            domainName: r.domain_name || null,
            generatedAt: r.generated_at || new Date().toISOString(),
            downloadUrl: `${API_BASE_URL}/reports/${r.id}/download`,
          }));
        }
      } catch (err) {
        console.warn('Could not load reports from API:', err);
      }
      return [];
    },
  });
}

export function useAddDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { domain: string; scan_frequency?: string }) => {
      const payload = typeof arg === 'string' ? { domain: arg, scan_frequency: 'daily' } : arg;
      const res = await api.post('/domains', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useUpdateDomainFrequency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ domainId, scanFrequency }: { domainId: string | number; scanFrequency: string }) => {
      const res = await api.patch(`/domains/${domainId}`, { scan_frequency: scanFrequency });
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

export function useDeleteDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string | number) => {
      const res = await api.delete(`/domains/${domainId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['exposures'] });
      queryClient.invalidateQueries({ queryKey: ['exposureStats'] });
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
      let reportType = 'executive';
      let domainName: string | null = null;
      if (typeof args === 'string') {
        reportType = args.toLowerCase();
      } else {
        reportType = (args.reportType || 'executive').toLowerCase();
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
        const list = Array.isArray(res.data) ? res.data : (res.data?.identities || []);
        if (Array.isArray(list)) {
          return list.map((item: any) => ({
            id: String(item.id),
            domainId: String(item.domain_id || item.domainId || ''),
            domain: item.domain || '',
            email: item.email,
            role: item.role || 'Executive / High-Value Account',
            status: item.status || 'monitored',
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn('Could not load identities from API:', err);
      }
      return [];
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

export function useRiskOverview(domainId?: number) {
  return useQuery<any>({
    queryKey: ['riskOverview', domainId],
    queryFn: async () => {
      const url = domainId ? `/risk/overview?domain_id=${domainId}` : '/risk/overview';
      const res = await api.get(url);
      return res.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useFindings(filter: { status?: string; category?: string; domainId?: number; limit?: number } = {}) {
  return useQuery<any[]>({
    queryKey: ['findings', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.category) params.append('category', filter.category);
      if (filter.domainId) params.append('domain_id', String(filter.domainId));
      const qs = params.toString();
      const res = await api.get(`/findings${qs ? `?${qs}` : ''}`);
      let list = res.data || [];
      if (filter.limit && list.length > filter.limit) {
        list = list.slice(0, filter.limit);
      }
      return list;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAttackSurfaceAssets(domainId?: number) {
  return useQuery<any[]>({
    queryKey: ['attackSurfaceAssets', domainId],
    queryFn: async () => {
      const url = domainId ? `/attack-surface/assets?domain_id=${domainId}` : '/attack-surface/assets';
      const res = await api.get(url);
      return res.data || [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

export function useAttackSurfaceFindings(filter: { domainId?: number; severity?: string; status?: string } = {}) {
  return useQuery<any[]>({
    queryKey: ['attackSurfaceFindings', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.domainId) params.append('domain_id', String(filter.domainId));
      if (filter.severity && filter.severity !== 'all') params.append('severity', filter.severity);
      if (filter.status && filter.status !== 'all') params.append('status', filter.status);
      const qs = params.toString();
      const res = await api.get(`/attack-surface/findings${qs ? `?${qs}` : ''}`);
      return res.data || [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

export function useEmailSecurityOverview(domainId?: number) {
  return useQuery<any>({
    queryKey: ['emailSecurityOverview', domainId],
    queryFn: async () => {
      const url = domainId ? `/email-security?domain_id=${domainId}` : '/email-security';
      const res = await api.get(url);
      return res.data;
    },
    staleTime: 1000 * 60 * 3,
  });
}

