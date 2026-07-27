import { NextResponse } from 'next/server';

    export async function GET(request: Request) {
      const { searchParams } = new URL(request.url);
      const targetUrl = searchParams.get('url');

      if (!targetUrl) {
        return NextResponse.json({ error: 'URL harus disertakan' }, { status: 400 });
      }

      try {
        const response = await fetch(`https://r.jina.ai/${targetUrl}`);
        const data = await response.text();
        return new NextResponse(data, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      } catch (error) {
        return NextResponse.json({ error: 'Gagal mengekstrak' }, { status: 500 });
      }
    }