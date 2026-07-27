'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Link, 
  Search, 
  FileText, 
  Copy, 
  Download, 
  Check, 
  Loader2, 
  LayoutTemplate, 
  AlertCircle,
  Settings2,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [activeTab, setActiveTab] = useState('markdown'); // 'markdown' | 'preview'
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);

  // Parse URL on mount for direct routing (e.g. domain.com/https://example.com)
  useEffect(() => {
    const path = window.location.pathname.substring(1) + window.location.search;
    if (path.startsWith('http')) {
      const decodedUrl = decodeURIComponent(path);
      setUrl(decodedUrl);
      processUrl(decodedUrl);
    }
  }, []);

  // A robust custom HTML to Markdown converter tailored for LLMs
   function nodeToMarkdown(node: any) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent.replace(/\s+/g, ' ');
  }
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    let md = '';
    const tag = node.tagName.toLowerCase();

    // Block elements
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const level = parseInt(tag.charAt(1));
      md += `\n\n${'#'.repeat(level)} ${node.textContent.trim()}\n\n`;
    } else if (tag === 'p') {
      md += `\n\n${Array.from(node.childNodes).map(nodeToMarkdown).join('').trim()}\n\n`;
    } else if (tag === 'br') {
      md += '\n';
    } 
    // Lists
    else if (tag === 'ul' || tag === 'ol') {
      md += '\n';
      Array.from(node.children).forEach((li, index) => {
        if (li.tagName.toLowerCase() === 'li') {
          const prefix = tag === 'ol' ? `${index + 1}. ` : '* ';
          md += `${prefix}${Array.from(li.childNodes).map(nodeToMarkdown).join('').trim()}\n`;
        }
      });
      md += '\n';
    }
    // Inline formatting
    else if (tag === 'strong' || tag === 'b') {
      md += `**${Array.from(node.childNodes).map(nodeToMarkdown).join('')}**`;
    } else if (tag === 'em' || tag === 'i') {
      md += `*${Array.from(node.childNodes).map(nodeToMarkdown).join('')}*`;
    } else if (tag === 'a') {
      const href = node.getAttribute('href');
      const text = Array.from(node.childNodes).map(nodeToMarkdown).join('').trim();
      if (href && href.startsWith('http') && text) {
        md += `[${text}](${href})`;
      } else {
        md += text;
      }
    } 
    // Default: process children
    else {
      md += Array.from(node.childNodes).map(nodeToMarkdown).join('');
    }

    return md;
  };

  const cleanDOM = (doc) => {
    // 1. Remove unwanted elements (ads, nav, footer, scripts, styles, popups)
    const selectorsToRemove = [
      'script', 'style', 'noscript', 'nav', 'footer', 'aside', 'header', 
      'iframe', 'form', 'button', '.ad', '.ads', '.advertisement', 
      '.cookie-banner', '.popup', '#cookie-notice', '.sidebar', 
      '.social-share', '.related-posts', '.comments', 'svg'
    ];
    
    selectorsToRemove.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // 2. Try to find the main article container
    let mainContent = null;
    const contentSelectors = ['article', '[role="main"]', 'main', '.post-content', '.article-content', '.entry-content', '.content'];
    
    for (let selector of contentSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        mainContent = el;
        break;
      }
    }

    // Fallback to body if no article wrapper found
    if (!mainContent) {
      mainContent = doc.body;
    }

    return mainContent;
  };

  const findNextPageUrl = (doc, currentUrl, depth) => {
    const targetPageStr = (depth + 1).toString();
    
    // Look for <link rel="next">
    const nextLink = doc.querySelector('link[rel="next"]');
    if (nextLink && nextLink.href) return nextLink.href;

    // Look for pagination anchors (a tags with text like 'next', 'selanjutnya', '2', '3', '>>')
    const aTags = doc.querySelectorAll('a');
    const currentUrlObj = new URL(currentUrl);

    for (let a of aTags) {
      const text = a.textContent.toLowerCase().trim();
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

      try {
        const absoluteUrl = new URL(href, currentUrl).href;
        const hrefUrlObj = new URL(absoluteUrl);
        
        // Pastikan halaman selanjutnya masih di domain yang sama
        if (hrefUrlObj.hostname !== currentUrlObj.hostname) continue;

        // Cek apakah teks tombol merupakan indikator 'Next' atau Angka Halaman Selanjutnya (misal: '2')
        const isNextText = 
          text.includes('next') || 
          text.includes('selanjutnya') || 
          text.includes('berikutnya') || 
          text === '>' || 
          text === '>>' ||
          text === targetPageStr ||
          text === `halaman ${targetPageStr}` ||
          text === `page ${targetPageStr}`;

        // Cek apakah struktur URL mengindikasikan halaman selanjutnya
        const isPaginationUrl = 
          absoluteUrl.includes(`page=${targetPageStr}`) ||
          absoluteUrl.includes(`page/${targetPageStr}`) ||
          absoluteUrl.includes(`-page-${targetPageStr}`) ||
          hrefUrlObj.pathname.endsWith(`/${targetPageStr}`) ||
          hrefUrlObj.pathname.endsWith(`/${targetPageStr}/`);

        if ((isNextText || isPaginationUrl) && absoluteUrl !== currentUrl) {
          return absoluteUrl;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  };

  const processUrl = async (targetUrl, isRecursive = false, currentContent = '', visited = new Set(), depth = 1) => {
    if (!isRecursive) {
      setIsLoading(true);
      setError('');
      setMarkdownOutput('');
      setPageCount(0);
    }

    if (depth > 5) { // Limit pagination depth to avoid infinite loops
      finishProcessing(currentContent);
      return;
    }

    setProgressText(`Fetching page ${depth} data...`);
    visited.add(targetUrl);

    try {
      const fetchContent = async (urlToFetch) => {
        // 1. Jina AI Reader API (Sangat kuat menembus Cloudflare, Output langsung Markdown)
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${urlToFetch}`);
          if (jinaRes.ok) {
            const text = await jinaRes.text();
            if (text && text.length > 100) return { type: 'markdown', data: text };
          }
        } catch(e) {
          console.warn("Jina AI bypass failed, trying proxies...");
        }

        // 2. Fallback HTML Proxies (Jika jalur utama gagal)
        const proxies = [
          async (u) => {
            const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
            if (!res.ok) throw new Error('AllOrigins Raw failed');
            return await res.text();
          },
          async (u) => {
            const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`);
            if (!res.ok) throw new Error('Codetabs failed');
            return await res.text();
          },
          async (u) => {
             const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`);
             if (!res.ok) throw new Error('Corsproxy.io failed');
             return await res.text();
          }
        ];

        for (const proxy of proxies) {
          try {
            const html = await proxy(urlToFetch);
            if (html && html.length > 300) return { type: 'html', data: html };
          } catch (err) {
            console.warn("Proxy attempt failed, trying next...");
          }
        }
        throw new Error("Akses diblokir (Cloudflare/Anti-Bot). Tidak dapat menarik data dari URL ini.");
      };

      const fetched = await fetchContent(targetUrl);
      let markdown = '';
      let nextUrl = null;

      if (fetched.type === 'markdown') {
        setProgressText(`Processing clean Markdown via AI Engine...`);
        markdown = fetched.data;
        
        // Deteksi halaman selanjutnya yang jauh lebih canggih (Membaca Teks & URL)
        const targetPageStr = (depth + 1).toString();
        const currentUrlObj = new URL(targetUrl);
        const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
        let match;
        
        while ((match = linkRegex.exec(markdown)) !== null) {
          const text = match[1].toLowerCase().trim();
          const href = match[2];
          
          try {
            const hrefUrlObj = new URL(href, targetUrl);
            if (hrefUrlObj.hostname !== currentUrlObj.hostname) continue;
            
            const isNextText = 
              text.includes('next') || 
              text.includes('selanjutnya') || 
              text.includes('berikutnya') || 
              text === '>' || 
              text === '>>' || 
              text === targetPageStr ||
              text === `halaman ${targetPageStr}` ||
              text === `page ${targetPageStr}`;

            const isPaginationUrl = 
              hrefUrlObj.href.includes(`page=${targetPageStr}`) ||
              hrefUrlObj.href.includes(`page/${targetPageStr}`) ||
              hrefUrlObj.href.includes(`-page-${targetPageStr}`) ||
              hrefUrlObj.pathname.endsWith(`/${targetPageStr}`) ||
              hrefUrlObj.pathname.endsWith(`/${targetPageStr}/`);

            if ((isNextText || isPaginationUrl) && hrefUrlObj.href !== targetUrl) {
              nextUrl = hrefUrlObj.href;
              break;
            }
          } catch(e) {}
        }
      } else {
        setProgressText(`Parsing and cleaning HTML page ${depth}...`);
        const rawHtml = fetched.data;
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');
        const cleanElement = cleanDOM(doc);
        markdown = nodeToMarkdown(cleanElement);
        markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
        nextUrl = findNextPageUrl(doc, targetUrl, depth);
      }

      let combinedContent = currentContent;
      if (currentContent !== '') {
        combinedContent += `\n\n---\n\n*Content from Page ${depth}*\n\n`;
      }
      combinedContent += markdown;

      setPageCount(depth);

      setProgressText(`Checking for next page...`);
      
      if (nextUrl && !visited.has(nextUrl)) {
        await processUrl(nextUrl, true, combinedContent, visited, depth + 1);
      } else {
        finishProcessing(combinedContent);
      }

    } catch (err) {
      console.error(err);
      if (!isRecursive) {
        setError(`Gagal mengekstrak: ${err.message}`);
        setIsLoading(false);
      } else {
        // If it fails on page 2+, just finish with what we have
        finishProcessing(currentContent);
      }
    }
  };

  const finishProcessing = (finalMarkdown) => {
    setMarkdownOutput(finalMarkdown || 'No readable text found on this page.');
    setIsLoading(false);
    setProgressText('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url) return;
    
    // Add protocol if missing
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
      setUrl(finalUrl);
    }
    
    processUrl(finalUrl);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdownOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-article.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Ultra-simple markdown renderer for preview tab (Regex based)
  const renderSimpleMarkdown = (md) => {
    let html = md
      .replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3 text-slate-800">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 text-slate-900 border-b pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-8 mb-6 text-slate-900">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc mb-1">$1</li>')
      .replace(/^(?!<h|<li)(.*$)/gim, (match) => match.trim() ? `<p class="mb-4 text-slate-700 leading-relaxed">${match}</p>` : '')
      .replace(/\n/g, ''); // Remove stray newlines to prevent weird gaps
      
    // Wrap consecutive list items in UL (hacky but works for preview)
    html = html.replace(/(<li.*?>.*?<\/li>)+/g, '<ul class="mb-4">$&</ul>');
    return { __html: html };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-inner">
              <FileText size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">LLM Extractor</h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Web to Clean Markdown Converter</p>
            </div>
          </div>
          <div className="flex items-center text-sm font-medium text-slate-500 gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Settings2 size={16} /> Auto-Pagination Enabled
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Input Section */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
              Prepare any article for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">LLM Analysis</span>
            </h2>
            <p className="text-slate-600 text-lg">
              Paste a URL below. We'll strip the ads, bypass sidebars, merge multiple pages, and generate clean Markdown text ready for Gemini, ChatGPT, or Claude.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Link className="h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://news-site.com/article-url..."
              className="w-full pl-12 pr-32 py-5 text-lg bg-white border-2 border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 font-medium"
              disabled={isLoading}
            />
            <div className="absolute inset-y-2 right-2">
              <button
                type="submit"
                disabled={isLoading || !url}
                className="h-full px-6 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>Extract <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          </form>

          {/* Helper / Direct Link info */}
          <p className="text-center mt-4 text-sm text-slate-500">
            <strong>Pro Tip:</strong> Access directly via URL: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono text-xs">yourdomain.com/https://target-url.com</code>
          </p>
        </div>

        {isLoading && (
          <div className="max-w-3xl mx-auto bg-blue-50 rounded-2xl p-8 border border-blue-100 flex flex-col items-center justify-center text-center animate-pulse">
            <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-blue-900 mb-1">Processing Article</h3>
            <p className="text-blue-700/80">{progressText}</p>
          </div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto bg-red-50 rounded-2xl p-6 border border-red-200 flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-900 font-bold mb-1">Extraction Failed</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {markdownOutput && !isLoading && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[700px] max-h-[80vh] transition-all duration-500 ease-in-out opacity-100 translate-y-0">
            
            {/* Output Header / Toolbar */}
            <div className="bg-slate-50/80 backdrop-blur border-b border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0">
              
              {/* Tabs */}
              <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('markdown')}
                  className={`flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'markdown' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <FileText size={16} /> Raw Markdown
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'preview' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <LayoutTemplate size={16} /> Preview
                </button>
              </div>

              {/* Actions & Status */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {pageCount > 1 && (
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-md border border-green-200 mr-2">
                    {pageCount} Pages Merged
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow active:scale-95"
                  >
                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-slate-900/20 active:scale-95"
                  >
                    <Download size={16} />
                    Save .md
                  </button>
                </div>
              </div>
            </div>

            {/* Output Content Area */}
            <div className="flex-1 overflow-auto bg-white p-6 md:p-8 scroll-smooth">
              {activeTab === 'markdown' ? (
                <textarea
                  readOnly
                  value={markdownOutput}
                  className="w-full h-full min-h-[400px] bg-slate-50 rounded-xl border border-slate-200 p-6 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none whitespace-pre-wrap leading-relaxed"
                  spellCheck="false"
                />
              ) : (
                <div 
                  className="prose prose-slate max-w-4xl mx-auto lg:prose-lg"
                  dangerouslySetInnerHTML={renderSimpleMarkdown(markdownOutput)}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}