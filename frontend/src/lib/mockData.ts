import { Domain, Exposure, ExposureStats, Report } from '@/types';

export const mockDomains: Domain[] = [
  { id: '1', name: 'example.com', status: 'verified', lastScannedAt: '2023-10-27T10:00:00Z', exposureCount: 15 },
  { id: '2', name: 'corp.example.com', status: 'verified', lastScannedAt: '2023-10-26T14:30:00Z', exposureCount: 3 },
  { id: '3', name: 'unverified-test.com', status: 'unverified', lastScannedAt: '', exposureCount: 0 },
];

export const mockExposures: Exposure[] = [
  { id: 'e-stealer-1', domainId: '1', email: 'cfo-vault@acme-corp.com', source: 'RedLine Stealer Botnet Log', severity: 'critical', credentialType: 'Infostealer Log / Exfiltrated Credentials', firstSeenAt: '2023-10-10T00:00:00Z', detectedAt: '2023-10-27T12:00:00Z', status: 'open', upgradeRequired: true, isStealerLog: true },
  { id: 'e1', domainId: '1', email: 'admin@example.com', source: 'LinkedIn Breach', severity: 'high', credentialType: 'Password Hash', firstSeenAt: '2023-05-15T00:00:00Z', detectedAt: '2023-10-25T10:00:00Z', status: 'open' },
  { id: 'e2', domainId: '1', email: 'sales@example.com', source: 'Canva Breach', severity: 'medium', credentialType: 'Plaintext Password', firstSeenAt: '2019-05-24T00:00:00Z', detectedAt: '2023-10-27T10:00:00Z', status: 'acknowledged' },
  { id: 'e3', domainId: '2', email: 'dev@corp.example.com', source: 'GitHub Leak', severity: 'critical', credentialType: 'API Key', firstSeenAt: '2023-10-01T00:00:00Z', detectedAt: '2023-10-26T14:30:00Z', status: 'open' },
  { id: 'e4', domainId: '1', email: 'marketing@example.com', source: 'Apollo Breach', severity: 'low', credentialType: 'Email Only', firstSeenAt: '2018-07-15T00:00:00Z', detectedAt: '2023-10-25T10:00:00Z', status: 'remediated' },
];

export const mockStats: ExposureStats = {
  total: 124,
  critical: 5,
  high: 12,
  medium: 45,
  low: 62,
  trend: 'up',
  riskScore: 78,
};

export const mockReports: Report[] = [
  { id: 'r1', type: 'Executive', generatedAt: '2023-10-01T12:00:00Z', downloadUrl: '#' },
  { id: 'r2', type: 'Summary', generatedAt: '2023-10-15T12:00:00Z', downloadUrl: '#' },
];
