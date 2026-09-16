export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  org_name?: string;
  organizationName?: string;
  plan?: string;
  isTrial?: boolean;
  trialDaysRemaining?: number;
  trialEndsAt?: string;
  role?: string;
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
  scanFrequency?: string;
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

export interface OutreachLead {
  id: number;
  company_name: string;
  domain: string;
  contact_email: string;
  contact_name?: string | null;
  status: 'pending_scan' | 'scanned' | 'ready' | 'sent' | 'failed';
  risk_score?: number | null;
  risk_level?: string | null;
  dmarc_status?: string | null;
  dmarc_record?: string | null;
  exposed_ports: string[];
  subdomains_count: number;
  breach_count: number;
  breach_sources: string[];
  top_findings: string[];
  email_angle?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

export interface SocialPost {
  id: number;
  platform: 'twitter' | 'reddit' | 'both';
  category: 'attack_surface' | 'email_security' | 'threat_intel' | 'msp_growth';
  title: string;
  hook?: string | null;
  content: string;
  call_to_action?: string | null;
  target_subreddit?: string | null;
  cadence_day: number;
  scheduled_for: string;
  status: 'scheduled' | 'ready' | 'published';
  published_at?: string | null;
  created_at?: string | null;
}

export interface GrowthStats {
  total_leads: number;
  scanned_leads: number;
  ready_leads: number;
  sent_leads: number;
  average_risk_score: number;
  total_social_posts: number;
  published_social_posts: number;
  total_radar_signals?: number;
  high_intent_signals?: number;
  converted_signals?: number;
}

export interface GoogleSheetConfig {
  sheet_url: string;
  auto_scan?: boolean;
  last_synced_at?: string | null;
}

export interface GoogleSheetSyncResult {
  status: string;
  message: string;
  total_rows_found: number;
  new_leads_added: number;
  duplicates_skipped: number;
  scanned_count: number;
  last_synced_at?: string | null;
}

export interface ProspectSignal {
  id: number;
  platform: 'reddit' | 'twitter' | 'web';
  source_url: string;
  author_handle: string;
  author_name?: string | null;
  post_title: string;
  post_snippet: string;
  intent_category: 'dmarc_spoofing' | 'credential_leak' | 'attack_surface' | 'msp_compliance';
  intent_score: number;
  urgency_level: 'critical' | 'high' | 'medium';
  extracted_company?: string | null;
  extracted_domain?: string | null;
  extracted_email?: string | null;
  suggested_reply?: string | null;
  suggested_email_angle?: string | null;
  status: 'discovered' | 'converted_to_lead' | 'synced_to_sheet' | 'dismissed';
  converted_lead_id?: number | null;
  synced_to_sheet_at?: string | null;
  created_at?: string | null;
}

