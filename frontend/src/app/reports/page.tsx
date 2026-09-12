"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { useReports, useGenerateReport, useDomains } from '@/hooks/useApi';
import api from '@/lib/api';
import { 
  FileText, Download, Plus, CheckCircle2, Eye, X, 
  Printer, Globe, ShieldAlert, Sparkles, Loader2, ExternalLink,
  Target, PenLine, ChevronDown, Check
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ReportGridSkeleton } from '@/components/Skeletons';

export default function ReportsPage() {
  const { data: reports, isLoading: isReportsLoading } = useReports();
  const { data: domains } = useDomains();
  const generateReportMutation = useGenerateReport();

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const [reportType, setReportType] = useState<string>('Executive');
  const [genError, setGenError] = useState<string | null>(null);

  // Load PDF as blob when previewId changes for reliable in-app iframe rendering
  useEffect(() => {
    if (!previewId) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setIsPreviewLoading(true);

    api.get(`/reports/${previewId}/download`, { responseType: 'blob' })
      .then((res) => {
        if (!isMounted) return;
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      })
      .catch(() => {
        if (isMounted) {
          setPreviewBlobUrl(null);
        }
      })
      .finally(() => {
        if (isMounted) setIsPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [previewId]);

  const handleOpenModal = () => {
    setGenError(null);
    setIsModalOpen(true);
  };

  const handleGenerate = async () => {
    try {
      setGenError(null);
      let targetDomain: string | null = null;
      if (selectedDomain === 'custom') {
        if (!customDomain.trim()) {
          setGenError('Please enter a valid domain name.');
          return;
        }
        targetDomain = customDomain.trim().toLowerCase();
      } else if (selectedDomain !== 'all') {
        targetDomain = selectedDomain;
      }

      await generateReportMutation.mutateAsync({
        reportType: reportType.toLowerCase(),
        domainName: targetDomain,
      });

      setIsModalOpen(false);
      setCustomDomain('');
    } catch (err: any) {
      setGenError(err?.response?.data?.detail || 'Failed to generate PDF audit report. Please try again.');
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (reportId: string, domainName?: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(reportId);
      const res = await api.get(`/reports/${reportId}/download?download=true`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanDomain = domainName ? `_${domainName}` : '_All_Domains';
      link.download = `Security_Audit_Report${cleanDomain}_${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {
      alert('Failed to download report. Please ensure you are authenticated.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Audit &amp; Compliance Reports</h1>
          <p className="text-xs text-text-muted mt-1">
            Generate and export structured PDF reports to support compliance reviews, board updates, and domain-specific investigations.
          </p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-text font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Generate Audit Report
        </button>
      </div>

      {/* Reports Grid */}
      {isReportsLoading ? (
        <ReportGridSkeleton count={3} />
      ) : reports && reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <div 
              key={report.id} 
              className="bg-bg-surface hover:bg-[#151518] border border-border-default hover:border-border-strong rounded-lg p-4 flex flex-col justify-between transition-colors group"
            >
              <div className="mb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-bg-hover rounded border border-border-strong/60 text-emerald-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-text-secondary group-hover:text-text-primary">
                        {report.type} Risk Assessment
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-hover text-2xs font-mono text-text-secondary border border-border-strong/60">
                          <Globe className="w-2.5 h-2.5 text-text-muted" />
                          {report.domainName || 'All Domains'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          PDF
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-[#0d0d0f] border border-border-default rounded text-2xs text-text-muted space-y-1">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Verified Audit Dossier</span>
                  </div>
                  <p className="text-text-faint leading-relaxed text-2xs">
                    Includes posture scorecard, stealer log forensics, compromised identities, and targeted remediation steps.
                  </p>
                  <p className="text-2xs text-text-faint font-mono pt-1">
                    Generated: {report.generatedAt ? formatDate(report.generatedAt) : 'Recent'}
                  </p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-border-default grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPreviewId(report.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-bg-surface hover:bg-border-strong text-text-secondary hover:text-text-primary border border-border-default rounded-md text-xs font-medium transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview in app
                </button>
                <button 
                  onClick={(e) => handleDownload(report.id, report.domainName, e)}
                  disabled={downloadingId === report.id}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-text rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {downloadingId === report.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-lg border border-dashed border-border-default bg-bg-surface">
          <FileText className="w-8 h-8 text-text-faint mx-auto mb-3" />
          <p className="text-sm font-medium text-text-secondary">No audit reports generated yet</p>
          <p className="text-xs text-text-faint mt-1 max-w-sm mx-auto">
            Generate an executive or domain-specific security assessment report to export findings as a genuine PDF.
          </p>
          <button
            onClick={handleOpenModal}
            className="mt-4 px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-text font-medium text-xs rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate your first report
          </button>
        </div>
      )}

      {/* Generate Report Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-bg-overlay backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-surface border border-border-default rounded-lg shadow-2xl p-5 text-text-primary animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-bg-hover rounded text-emerald-400 border border-border-strong/60">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Generate Security Audit PDF</h3>
                  <p className="text-xs text-text-muted">Export verified exposure telemetry as a formal PDF document</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-border-strong transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Target Domain Field */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Target Perimeter / Domain Scope
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
                    className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-md text-xs text-text-secondary flex items-center justify-between focus:outline-none focus:border-border-strong transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {selectedDomain === 'all' && (
                        <>
                          <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>All Monitored Domains (Organization-Wide)</span>
                        </>
                      )}
                      {selectedDomain === 'custom' && (
                        <>
                          <PenLine className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>Audit another domain...</span>
                        </>
                      )}
                      {selectedDomain !== 'all' && selectedDomain !== 'custom' && (
                        <>
                          <Target className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>
                            {selectedDomain}{' '}
                            {domains?.find((d) => d.name === selectedDomain)?.exposureCount
                              ? `(${domains.find((d) => d.name === selectedDomain)?.exposureCount} exposures)`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>

                  {isDomainDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#141416] border border-border-default rounded-md shadow-2xl p-1 max-h-56 overflow-y-auto space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDomain('all');
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                          selectedDomain === 'all'
                            ? 'bg-border-strong text-text-primary font-medium'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>All Monitored Domains (Organization-Wide)</span>
                        </div>
                        {selectedDomain === 'all' && <Check className="w-3.5 h-3.5 text-text-secondary" />}
                      </button>

                      {domains?.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDomain(d.name);
                            setIsDomainDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                            selectedDomain === d.name
                              ? 'bg-border-strong text-text-primary font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Target className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span>
                              {d.name} {d.exposureCount ? `(${d.exposureCount} exposures)` : ''}
                            </span>
                          </div>
                          {selectedDomain === d.name && <Check className="w-3.5 h-3.5 text-text-secondary" />}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDomain('custom');
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left border-t border-border-default pt-1.5 ${
                          selectedDomain === 'custom'
                            ? 'bg-border-strong text-text-primary font-medium'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <PenLine className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>Audit another domain...</span>
                        </div>
                        {selectedDomain === 'custom' && <Check className="w-3.5 h-3.5 text-text-secondary" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Domain Input if selected */}
              {selectedDomain === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Specify Domain Name
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="e.g. laam.com or yourcompany.com"
                    className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-md text-xs text-text-secondary placeholder-text-faint focus:outline-none focus:border-border-strong font-mono"
                  />
                  <p className="text-2xs text-text-faint mt-1">
                    BreachGuard will compile dark web intelligence and threat vectors for this specific domain.
                  </p>
                </div>
              )}

              {/* Report Classification Type */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Report Type &amp; Classification
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Executive', title: 'Executive', desc: 'Board-level posture score & summary' },
                    { id: 'Technical', title: 'Technical', desc: 'Deep credential & IOC telemetry' },
                    { id: 'Compliance', title: 'Compliance', desc: 'Security review documentation' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportType(t.id)}
                      className={`p-2.5 rounded-md border text-left text-xs transition-colors cursor-pointer ${
                        reportType === t.id
                          ? 'border-border-strong bg-border-strong/90 text-text-primary'
                          : 'border-border-default bg-bg-surface text-text-muted hover:border-border-strong hover:text-text-secondary'
                      }`}
                    >
                      <span className="font-semibold block text-text-secondary text-xs">{t.title}</span>
                      <span className="text-2xs text-text-faint block leading-tight mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {genError && (
                <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-default flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={generateReportMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-border-strong hover:bg-border-strong text-text-secondary text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateReportMutation.isPending}
                className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {generateReportMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Compiling PDF Audit...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Generate &amp; Build PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Report PDF Preview Modal */}
      {previewId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl h-[90vh] bg-bg-surface border border-border-default rounded-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-default bg-bg-surface">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-text-secondary">
                  Executive Security Assessment Audit Dossier (Report #{previewId})
                </span>
                <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-border-strong text-text-muted border border-border-strong/60">
                  PDF Format
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewBlobUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(previewBlobUrl, '_blank')}
                    className="px-2.5 py-1.5 rounded-md bg-border-strong hover:bg-border-strong text-text-secondary text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in tab
                  </button>
                )}
                <button
                  onClick={() => {
                    const iframe = document.getElementById('report-pdf-frame') as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.print();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-border-strong hover:bg-border-strong text-text-secondary text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => handleDownload(previewId)}
                  disabled={downloadingId === previewId}
                  className="px-2.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {downloadingId === previewId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setPreviewId(null)}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-border-strong transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#09090b] relative flex items-center justify-center">
              {isPreviewLoading ? (
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                  <span>Loading PDF document...</span>
                </div>
              ) : previewBlobUrl ? (
                <iframe
                  id="report-pdf-frame"
                  src={previewBlobUrl}
                  className="w-full h-full border-0"
                  title="Security Report PDF"
                />
              ) : (
                <div className="text-center p-8 text-xs text-text-muted">
                  <p>PDF generated. Ready to download.</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDownload(previewId)}
                      disabled={downloadingId === previewId}
                      className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-accent-text font-medium inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {downloadingId === previewId ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-text" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}