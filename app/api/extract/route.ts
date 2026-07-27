import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Parameter URL tidak ditemukan' }, { status: 400 });
  }

  try {
    // Memanggil Jina Reader
    const response = await fetch(`https://r.jina.ai/${targetUrl}`);
    const data = await response.text();

    return new NextResponse(data, {
      headers: { 
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*' // Agar bisa diakses dari mana saja (termasuk n8n)
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengekstrak konten' }, { status: 500 });
  }
}