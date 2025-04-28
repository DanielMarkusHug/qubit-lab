import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY; // API Key from environment
  const query = 'quantum computing';

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&key=${apiKey}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}