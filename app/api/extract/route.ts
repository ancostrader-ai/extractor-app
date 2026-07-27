import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) return NextResponse.json({ error: 'URL diperlukan' }, { status: 400 });

  async function fetchWithPagination(url: string, page = 1, allContent = ""): Promise<string> {
    if (page > 5) return allContent; // Limit 5 halaman untuk keamanan

    const res = await fetch(`https://r.jina.ai/${url}`);
    const text = await res.text();
    
    // Gabungkan konten
    const combined = allContent + (allContent ? "\n\n--- Halaman " + page + " ---\n\n" : "") + text;

    // Cari link halaman selanjutnya (Pola Markdown [Label](URL))
    const nextMatch = text.match(/\[([^\]]*(?:next|selanjutnya|berikutnya)[^\]]*)\]\((https?:\/\/[^\s\)]+)\)/i);
    
    if (nextMatch && nextMatch[2]) {
      return fetchWithPagination(nextMatch[2], page + 1, combined);
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