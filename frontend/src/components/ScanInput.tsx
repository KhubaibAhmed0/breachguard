"use client";

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export interface ScanResultData {
  domain: string;
  total_exposures: number;
  breach_count: number;
  severity_breakdown: { critical: number; high: number; medium: number; low: number };
  breach_names?: string[];
  recent_breach?: string;
  target_type?: string;
  overall_risk_score?: number;
  risk_level?: string;
  discovered_assets_count?: number;
  findings_count?: number;
  email_security_score?: number;
  categories?: Record<string, number>;
  sample_findings?: Array<{ title: string; severity: string; category?: string; asset?: string; evidence?: string }>;
  conversion_title?: string;
  conversion_features?: string[];
}

interface ScanInputProps {
  onScanComplete: (data: ScanResultData) => void;
}

export function ScanInput({ onScanComplete }: ScanInputProps) {
  const [domain, setDomain] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performScan = async (targetValue: string) => {
    const cleanTarget = targetValue.trim();
    if (!cleanTarget) return;
    
    setIsScanning(true);
    setError(null);

    try {
      const endpoint = `${API_BASE_URL}/prospect/scan`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanTarget }),
      });

      if (res.ok) {
        const data = await res.json();
        setError(null);
        onScanComplete(data);
      } else if (res.status === 400 || res.status === 422) {
        const errJson = await res.json().catch(() => null);
        setError(errJson?.detail || 'Invalid domain or email format. Please check the query and try again.');
      } else if (res.status === 429) {
        setError('Scan rate limit reached. Please wait a moment before trying again.');
      } else {
        setError('Scan could not be completed. External threat intelligence providers are temporarily unavailable.');
      }
    } catch {
      setError('Scan could not be completed. Threat intelligence service is temporarily unavailable. Please try again shortly.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(domain);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2.5 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl shadow-sm focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700 transition-all">
        <div className="relative flex-1 w-full flex items-center pl-3">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input 
            type="text" 
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter corporate domain or email (e.g. acme.com or user@acme.com)" 
            className="w-full px-3 py-2.5 bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none text-sm"
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isScanning}
          className="w-full sm:w-auto px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-60 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
              <span>Analyzing...</span>
            </>
          ) : (
            'Check exposure'
          )}
        </button>
      </form>

      {error && (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 text-center animate-fadeIn">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <span>Sample queries:</span>
        {['canva.com', 'adobe.com', 'test@example.com'].map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setDomain(sample);
              performScan(sample);
            }}
            className="underline underline-offset-4 hover:text-zinc-300 transition-colors"
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
}