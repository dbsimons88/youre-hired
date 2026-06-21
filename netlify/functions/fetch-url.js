// fetch-url.js — server-side URL fetcher for job postings
// No external packages — uses Node built-in fetch + regex HTML stripping

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let url;
  try {
    ({ url } = JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { error: 'invalid-json' });
  }

  if (!url) return json(400, { error: 'missing-url' });

  // Validate URL shape
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return json(400, { error: 'invalid-url' });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return json(200, { error: 'fetch-failed', status: res.status });
    }

    const html = await res.text();
    const text = extractText(html);

    if (text.length < 80) {
      return json(200, { error: 'no-content' });
    }

    return json(200, { text: text.slice(0, 4000) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return json(200, { error: 'timeout' });
    }
    console.error('fetch-url error:', err.message);
    return json(200, { error: 'fetch-failed' });
  }
};

function extractText(html) {
  return html
    // Drop script, style, nav, header, footer blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Block-level elements → newline
    .replace(/<\/?(p|div|section|article|h[1-6]|li|br|tr|ul|ol)[^>]*>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#x2F;/g, '/')
    // Collapse whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function json(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
