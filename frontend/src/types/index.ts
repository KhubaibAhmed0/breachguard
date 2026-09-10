export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  plan?: string;
  isTrial?: boolean;
  trialDaysRemaining?: number;
  trialEndsAt?: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface Domain {
  id: string;
  name: string;
  status: 'verified' | 'unverified' | 'pending';
  lastScannedAt: string;
  exposureCount: number;
}

export type DomainScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

export interface Exposure {
  id: string;
  domainId: string;
  email: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  credentialType: string;
  firstSeenAt: string;
  detectedAt: string;
  status: 'open' | 'acknowledged' | 'remediated';
  upgradeRequired?: boolean;
  isStealerLog?: boolean;
  rawLogUrl?: string;
}

export interface PrivilegedIdentity {
  id: string;
  domainId: string;
  domain: string;
  email: string;
  role?: string;
  status: 'monitored' | 'alert' | 'remediated';
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  type: 'primary' | 'client';
  plan: string;
  domainCount?: number;
  exposureCount?: number;
  createdAt?: string;
}

export interface ExposureStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trend: 'up' | 'down' | 'flat';
  riskScore: number;
}

export interface ExposureTimeline {
  month: string;
  count: number;
}

export interface Report {
  id: string;
  type: string;
  domainName?: string | null;
  generatedAt: string;
  downloadUrl: string;
}

export interface ProspectScanResult {
  domain: string;
  totalExposures: number;
  breachesCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
