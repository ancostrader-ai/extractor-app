'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, 
  Search, 
  Copy, 
  Check, 
  Loader2, 
  FileText, 
  Layers,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export default function AutoExtractorPage() {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<{msg: string, type: string}[]>([]);
  const [fullMarkdown, setFullMarkdown] = useState('');
  const [activeTab, setActiveTab] = useState<'markdown' | 'preview'>('markdown');
  const [copied, setCopied] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  
  const visitedUrls = useRef<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const findNextPageLink = (markdown: string, currentUrl: string, currentPageNum: number) => {
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    let match;
    const nextLabels = ["selanjutnya", "berikutnya", "next", "halaman selanjutnya", ">"];
    
    while ((match = mdLinkRegex.exec(markdown)) !== null) {
      const label = match[1].toLowerCase().trim();
      const link = match[2];
      
      const isNextLabel = nextLabels.some(n => label.includes(n));
      const isNextNum = label === (currentPageNum + 1).toString();

      if (isNextLabel || isNextNum) {
        try {
          const currentDomain = new URL(currentUrl).hostname;
          const linkDomain = new URL(link).hostname;
          if (currentDomain === linkDomain && !visitedUrls.current.has(link)) {
            return link;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  };

  const crawlPage = async (targetUrl: string, pageNum: number): Promise<string> => {
    if (visitedUrls.current.has(targetUrl)) return '';
    visitedUrls.current.add(targetUrl);
    
    addLog(`Memproses Halaman ${pageNum}: ${targetUrl.substring(0, 50)}...`, 'info');
    
    try {
      const response = await fetch(`https://r.jina.ai/${targetUrl}`);
      if (!response.ok) throw new Error("Gagal mengambil data");
      
      const text = await response.text();
      let content = text;

      // Bersihkan sedikit header yang berulang pada halaman 2+
      if (pageNum > 1) {
        const lines = text.split('\n');
        content = `\n\n--- (Lanjutan Halaman ${pageNum}) ---\n\n` + lines.slice(5).join('\n');
      }

      setPageCount(pageNum);

      const nextPageUrl = findNextPageLink(text, targetUrl, pageNum);
      
      if (nextPageUrl && pageNum < 10) { // Limit 10 halaman demi keamanan
        addLog(`Menemukan koneksi ke halaman ${pageNum + 1}...`, 'success');
        const nextContent = await crawlPage(nextPageUrl, pageNum + 1);
        return content + nextContent;
      }
      
      addLog("Halaman terakhir tercapai.", 'warning');
      return content;

    } catch (e: any) {
      addLog(`Gagal pada halaman ${pageNum}: ${e.message}`, 'error');
      return '';
    }
  };

  const startExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsProcessing(true);
    setLogs([]);
    setFullMarkdown('');
    setPageCount(0);
    visitedUrls.current.clear();

    const result = await crawlPage(url, 1);
    setFullMarkdown(result);
    setIsProcessing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Rocket className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              LLM <span className="text-emerald-600">Auto-Extractor</span>
            </h1>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
            v3.0 Smart Pagination
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-12">
        {/* Input Section */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Ekstrak Berita Otomatis</h2>
            <p className="text-slate-500 text-sm">Cukup masukkan link halaman pertama. Sistem akan mencari halaman selanjutnya secara otomatis.</p>
          </div>

          <form onSubmit={startExtraction} className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Tempel URL berita di sini..."
              className="w-full pl-14 pr-40 py-5 rounded-2xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50"
            />
            <button 
              type="submit"
              disabled={isProcessing || !url}
              className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-8 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <span>Ekstrak</span>}
            </button>
          </form>

          {/* Logs */}
          {(logs.length > 0) && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Proses Pendeteksian:</h3>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 h-40 overflow-auto font-mono text-[13px] space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'warning' ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    <span className="opacity-50">[{i+1}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </section>

        {/* Results Section */}
        {fullMarkdown && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('markdown')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'markdown' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Markdown
                </button>
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'preview' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Pratinjau
                </button>
              </div>
              
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 px-5 py-2.5 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Tersalin!' : 'Salin Hasil'}</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
              <div className="flex-1 p-8 overflow-auto">
                {activeTab === 'markdown' ? (
                  <pre className="text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">{fullMarkdown}</pre>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    {fullMarkdown.split('\n').map((line, i) => (
                      <p key={i} className="mb-2 text-slate-700">{line}</p>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pageCount} Halaman Tergabung</span>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-slate-300">SISTEM KRALER OTOMATIS AKTIF</div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!fullMarkdown && !isProcessing && (
          <div className="text-center py-20 opacity-20">
            <div className="bg-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} />
            </div>
            <p className="font-bold">Belum ada konten yang diekstrak</p>
          </div>
        )}
      </main>
    </div>
  );
}