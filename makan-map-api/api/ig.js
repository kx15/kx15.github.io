// GET /api/ig?url=<instagram post or reel link>
// Returns { shortcode, username, caption, location } for a public post, so the
// Makan Map page (a static site) can pre-fill the place without a manual paste.
// Instagram blocks browsers on other sites from reading posts, hence this hop.

const ALLOWED_ORIGINS = [
  'https://liangkaixin.com',
  'https://www.liangkaixin.com',
  'https://kx15.github.io',
];

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const UA_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Instagram ships post data as JSON inside <script>, sometimes escaped once more
// because that JSON sits in a JS string. Find `prefix` (written for plain JSON)
// in either form and return the decoded string value that follows it.
function findJsonString(html, prefix) {
  for (const doubled of [false, true]) {
    const key = doubled ? prefix.replace(/"/g, '\\"') : prefix;
    const i = html.indexOf(key);
    if (i === -1) continue;
    const start = i + key.length;
    for (let j = start; j < html.length && j - start < 20000; j++) {
      if (html[j] !== '"') continue;
      let n = 0;
      while (html[j - 1 - n] === '\\') n++;
      if (doubled ? n === 1 : n % 2 === 0) {
        let raw = html.slice(start, doubled ? j - 1 : j);
        try {
          if (doubled) raw = JSON.parse(`"${raw}"`);
          return JSON.parse(`"${raw}"`);
        } catch { return null; }
      }
    }
  }
  return null;
}

// Parse the public embed page: /p/<code>/embed/captioned/
function parseEmbed(html) {
  const out = {};
  const cap = findJsonString(html, '"edge_media_to_caption":{"edges":[{"node":{"text":"');
  if (cap) out.caption = cap;
  const locAt = Math.max(html.indexOf('"location":{'), html.indexOf('\\"location\\":{'));
  if (locAt !== -1) {
    const loc = findJsonString(html.slice(locAt, locAt + 600), '"name":"');
    if (loc) out.location = loc;
  }
  const user = html.match(/class="UsernameText"[^>]*>([^<]+)</) || html.match(/class="CaptionUsername"[^>]*>([^<]+)</);
  if (user) out.username = decodeEntities(user[1]).trim();

  // Classic embeds render the caption as HTML
  if (!out.caption) {
    const m = html.match(/<div class="Caption">([\s\S]*?)<div class="CaptionComments">/) ||
              html.match(/<div class="Caption">([\s\S]*?)<\/div>/);
    if (m) {
      out.caption = decodeEntities(
        m[1]
          .replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
      ).replace(/\n{3,}/g, '\n\n').trim();
    }
  }
  return out;
}

// Fallback: Open Graph tags served to link-preview crawlers
// og:description looks like: 123 likes, 4 comments - user on October 1, 2026: "caption".
function parseOg(html) {
  const out = {};
  const meta = (p) => {
    const m = html.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`, 'i')) ||
              html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${p}"`, 'i'));
    return m ? decodeEntities(m[1]) : '';
  };
  const desc = meta('og:description') || meta('og:title');
  const q = desc.match(/:\s*["“]([\s\S]*)["”]\.?\s*$/);
  if (q) out.caption = q[1].trim();
  const u = desc.match(/-\s*([\w.]+)\s+on\s+/) || desc.match(/^([\w.]+)\s+on Instagram/);
  if (u) out.username = u[1];
  return out;
}

async function get(url, ua) {
  const r = await fetch(url, {
    headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  const m = String(req.query.url || '').match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]{5,40})/i);
  if (!m) return res.status(400).json({ error: 'Not an Instagram post link' });
  const code = m[1];

  const result = { shortcode: code };
  const tries = [
    () => get(`https://www.instagram.com/p/${code}/embed/captioned/`, UA_BROWSER).then(parseEmbed),
    () => get(`https://www.instagram.com/p/${code}/`, UA_CRAWLER).then(parseOg),
  ];
  for (const t of tries) {
    try {
      const r = await t();
      for (const k of ['caption', 'username', 'location']) if (r[k] && !result[k]) result[k] = r[k];
      if (result.caption) break;
    } catch { /* try the next source */ }
  }

  if (!result.caption && !result.location) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(502).json({ ...result, error: 'Could not read that post (private, deleted, or Instagram refused)' });
  }
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json(result);
};

module.exports.parseEmbed = parseEmbed;
module.exports.parseOg = parseOg;
