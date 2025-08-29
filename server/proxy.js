/* Lightweight dev proxy to handle /api/gemini requests during development.
   Start with: node server/proxy.js
   It listens on port 5174 by default and proxies requests to Google Generative Language API
   using process.env.GOOGLE_API_KEY. It also adds CORS for localhost:5173 (Vite default).
*/

import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load .env.local automatically when present (development convenience)
dotenv.config({ path: './.env.local' });

const app = express();
const PORT = process.env.DEV_PROXY_PORT || 5174;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Fallback: if a client omits Content-Type, express.json won't populate req.body.
// Read raw body and attempt to JSON.parse so the proxy can still work with such clients.
app.use((req, res, next) => {
  // Only attempt for non-GET/HEAD and when body is empty
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  try {
    const hasBody = req.body && (Object.keys(req.body).length > 0 || typeof req.body === 'string');
    if (hasBody) return next();
  } catch (e) {
    // fall through to raw read
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    if (raw && !req.body) {
      try {
        req.body = JSON.parse(raw);
      } catch (e) {
        // if parse fails, keep raw string so logging shows something useful
        req.body = raw;
      }
    }
    next();
  });
});

// Log incoming requests for easier debugging
app.use((req, res, next) => {
  try {
    console.log(`[proxy] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    if (req.method !== 'GET') {
      // Try to safely log body if present
      console.log('[proxy] body:', JSON.stringify(req.body));
    }
  } catch (e) {
    // ignore logging errors
  }
  next();
});

app.post('/api/gemini', async (req, res) => {
  try {
    const { action, payload } = req.body || {};
    console.log('[proxy] action:', action, 'payloadKeys:', payload ? Object.keys(payload) : null);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing GOOGLE_API_KEY' });
    }

    if (action === 'generateContent' || action === 'chat') {
      const rawModel = (payload && payload.model) ? String(payload.model) : 'gemini-2.5-flash';
      const modelName = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;
      console.log('[proxy] forwarding to Google model:', modelName, '(using API key)');
      
      try {
        const genAI = new GoogleGenAI({ apiKey });

        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        // ★★★ ここからが重要な修正点です ★★★
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        
        // 新しいSDKの呼び出し方に修正
        const sdkPayload = {
          model: modelName,
          ...payload
        };

        if (action === 'chat') {
          // historyとmessageをcontentsに変換
          sdkPayload.contents = [
            ...payload.history,
            { role: "user", parts: [{ text: payload.message }] }
          ];
          // 不要なプロパティを削除
          delete sdkPayload.history;
          delete sdkPayload.message;
        }

        const sdkResp = await genAI.models.generateContent(sdkPayload);
        
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        // ★★★ ここまでが重要な修正点です ★★★
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

        console.log('[proxy] SDK upstream response OK');
        const text = sdkResp.candidates[0]?.content?.parts[0]?.text || '';
        return res.status(200).json({ text, ...sdkResp });

      } catch (sdkErr) {
        console.error('[proxy] SDK call failed', sdkErr);
        return res.status(500).json({ error: 'SDK upstream error', detail: sdkErr.message });
      }
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).json({ error: 'Proxy internal error', message: err.message || String(err) });
  }
});

// Custom 404 so curl shows useful info instead of an empty HTML page
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', method: req.method, path: req.path });
});

app.listen(PORT, () => console.log(`Dev proxy listening on http://localhost:${PORT}`));