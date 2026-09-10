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
          setPreviewBlobUrl(`http://localhost:8000/api/reports/${previewId}/download`);
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
        reportType,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Audit &amp; Compliance Reports</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Generate and export genuine PDF audit reports for SOC 2 compliance, executive boards, or domain-specific investigations.
          </p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Generate Audit Report
        </button>
      </div>

      {/* Reports Grid */}
      {isReportsLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading generated audits...
        </div>
      ) : reports && reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <div 
              key={report.id} 
              className="bg-zinc-900/50 hover:bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-5 flex flex-col justify-between transition-all group"
            >
              <div className="mb-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-zinc-800/80 rounded-lg text-zinc-200 border border-zinc-700/60 shadow-xs">
                      <FileText className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-zinc-100">
                        {report.type} Risk Assessment
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono text-zinc-300 border border-zinc-700">
                          <Globe className="w-2.5 h-2.5 text-zinc-400" />
                          {report.domainName || 'All Domains'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-950/60 text-red-400 border border-red-900/60">
                          PDF
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-zinc-950/70 border border-zinc-850 rounded-lg text-[11px] text-zinc-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Verified Audit Dossier</span>
                  </div>
                  <p className="text-zinc-500 leading-relaxed">
                    Includes posture scorecard, stealer log forensics, compromised identities, and targeted remediation steps.
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono pt-1">
                    Generated: {formatDate(report.generatedAt)}
                  </p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-zinc-850 grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPreviewId(report.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview in app
                </button>
                <button 
                  onClick={(e) => handleDownload(report.id, report.domainName, e)}
                  disabled={downloadingId === report.id}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {downloadingId === report.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
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
        <div className="p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-300">No audit reports generated yet</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Generate an executive or domain-specific security assessment report to export findings as a genuine PDF.
          </p>
          <button
            onClick={handleOpenModal}
            className="mt-4 px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate your first report
          </button>
        </div>
      )}

      {/* Generate Report Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-zinc-800 rounded-lg text-emerald-400 border border-zinc-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Generate Security Audit PDF</h3>
                  <p className="text-xs text-zinc-400">Export verified exposure telemetry as a formal PDF document</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Target Domain Field */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Target Perimeter / Domain Scope
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 flex items-center justify-between focus:outline-none focus:border-zinc-500 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {selectedDomain === 'all' && (
                        <>
                          <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>All Monitored Domains (Organization-Wide)</span>
                        </>
                      )}
                      {selectedDomain === 'custom' && (
                        <>
                          <PenLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>Audit another domain...</span>
                        </>
                      )}
                      {selectedDomain !== 'all' && selectedDomain !== 'custom' && (
                        <>
                          <Target className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>
                            {selectedDomain}{' '}
                            {domains?.find((d) => d.name === selectedDomain)?.exposureCount
                              ? `(${domains.find((d) => d.name === selectedDomain)?.exposureCount} exposures)`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </button>

                  {isDomainDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-1 max-h-56 overflow-y-auto space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDomain('all');
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                          selectedDomain === 'all'
                            ? 'bg-zinc-800 text-white font-medium'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>All Monitored Domains (Organization-Wide)</span>
                        </div>
                        {selectedDomain === 'all' && <Check className="w-3.5 h-3.5 text-zinc-300" />}
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
                              ? 'bg-zinc-800 text-white font-medium'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Target className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>
                              {d.name} {d.exposureCount ? `(${d.exposureCount} exposures)` : ''}
                            </span>
                          </div>
                          {selectedDomain === d.name && <Check className="w-3.5 h-3.5 text-zinc-300" />}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDomain('custom');
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left border-t border-zinc-900 pt-1.5 ${
                          selectedDomain === 'custom'
                            ? 'bg-zinc-800 text-white font-medium'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <PenLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>Audit another domain...</span>
                        </div>
                        {selectedDomain === 'custom' && <Check className="w-3.5 h-3.5 text-zinc-300" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Domain Input if selected */}
              {selectedDomain === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Specify Domain Name
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="e.g. laam.com or yourcompany.com"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    BreachGuard will compile dark web intelligence and threat vectors for this specific domain.
                  </p>
                </div>
              )}

              {/* Report Classification Type */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Report Type &amp; Classification
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Executive', title: 'Executive', desc: 'Board-level posture score & summary' },
                    { id: 'Technical', title: 'Technical', desc: 'Deep credential & IOC telemetry' },
                    { id: 'Compliance', title: 'Compliance', desc: 'SOC 2 / ISO audit proof' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportType(t.id)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                        reportType === t.id
                          ? 'border-emerald-500/80 bg-emerald-950/20 text-white'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span className="font-semibold block text-zinc-200">{t.title}</span>
                      <span className="text-[10px] text-zinc-500 block leading-tight mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {genError && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-900/80 text-xs text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={generateReportMutation.isPending}
                className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateReportMutation.isPending}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
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
          <div className="w-full max-w-5xl h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">
                  Executive Security Assessment Audit Dossier (Report #{previewId})
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                  PDF Format
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewBlobUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(previewBlobUrl, '_blank')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => handleDownload(previewId)}
                  disabled={downloadingId === previewId}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {downloadingId === previewId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
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
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-zinc-950 relative flex items-center justify-center">
              {isPreviewLoading ? (
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
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
                <div className="text-center p-8 text-xs text-zinc-400">
                  <p>PDF generated. Ready to download.</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDownload(previewId)}
                      disabled={downloadingId === previewId}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {downloadingId === previewId ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
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