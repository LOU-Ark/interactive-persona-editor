export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    const apiKey = typeof process !== 'undefined' && process.env ? process.env.GOOGLE_API_KEY : undefined;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is not configured with GOOGLE_API_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Map actions to requests to Google Generative Language REST endpoint
    const base = 'https://generativelanguage.googleapis.com/v1beta2';

    if (action === 'generateContent' || action === 'chat') {
      // For simplicity we'll use the REST generate endpoint. The incoming payload should
      // be shaped similarly to the SDK call in the client code.
      const url = `${base}/models/${encodeURIComponent(payload.model || 'gemini-2.5-flash')}:generate`;

      const resp = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      const contentType = resp.headers.get('Content-Type') || 'application/json';
      return new Response(text, { status: resp.status, headers: { 'Content-Type': contentType } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return new Response(JSON.stringify({ error: 'Internal server error', message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
