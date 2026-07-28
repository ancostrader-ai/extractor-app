import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) return NextResponse.json({ error: 'URL diperlukan' }, { status: 400 });

  async function fetchWithPagination(url: string, page = 1, allContent = "", originalBaseUrl = targetUrl): Promise<string> {
    if (page > 5) return allContent; // Limit maksimal 5 halaman untuk keamanan

    // 1. Tambahkan parameter ?with-links=true dan Header User-Agent agar menyerupai browser asli
    const fetchUrl = url.includes('?') ? `${url}&with-links=true` : `${url}?with-links=true`;
    
    const res = await fetch(`https://r.jina.ai/${fetchUrl}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/markdown'
      }
    });
    
    const text = await res.text();
    
    // Gabungkan konten halaman saat ini
    const combined = allContent + (allContent ? "\n\n--- Halaman " + page + " ---\n\n" : "") + text;

    // 2. Cari link halaman selanjutnya menggunakan pola Markdown [Label](URL)
    let nextMatch = text.match(/\[([^\]]*(?:next|selanjutnya|berikutnya|halaman selanjutnya|page 2|2)[^\]]*)\]\((https?:\/\/[^\s\)]+)\)/i);
    
    let nextUrlToFetch = null;

    if (nextMatch && nextMatch[2]) {
      nextUrlToFetch = nextMatch[2];
    } else if (page === 1) {
      // 3. FALLBACK UMUM: Jika Jina tidak mendeteksi tombol next di teks, 
      // kita paksa tambahkan ?page=2 (berlaku untuk Viva, Detik, Kompas, dll)
      if (!originalBaseUrl.includes('?page=')) {
        nextUrlToFetch = originalBaseUrl + '?page=2';
      }
    }

    // Jika ditemukan link untuk halaman berikutnya dan belum melampaui halaman 2
    if (nextUrlToFetch && page < 2) { // Batasi page < 2 jika Anda hanya ingin sampai halaman 2
      return fetchWithPagination(nextUrlToFetch, page + 1, combined, originalBaseUrl);
    }
    
    return combined;
  }

  try {
    const fullContent = await fetchWithPagination(targetUrl);
    return new NextResponse(fullContent, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengekstrak' }, { status: 500 });
  }
}