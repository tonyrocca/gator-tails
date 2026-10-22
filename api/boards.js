// League board for blind resume weeks: everyone's submitted rankings, readable by everyone.
// Storage: Vercel Blob (BLOB_READ_WRITE_TOKEN comes from connecting a Blob store to this project).
// Each board is its own blob; who/order/time live in the pathname so a single list() call reads them all.
import { put, list } from '@vercel/blob';

const TEAMS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11]); // 0 = "just a fan"
const EDITION = /^\d{4}-\d{2}-week-\d{1,2}$/;

// the token's name depends on the prefix chosen when the store was connected (default BLOB_READ_WRITE_TOKEN)
const tokenName = () => ('BLOB_READ_WRITE_TOKEN' in process.env ? 'BLOB_READ_WRITE_TOKEN' : Object.keys(process.env).find(k => k.endsWith('_READ_WRITE_TOKEN')));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const tn = tokenName(), token = tn && process.env[tn];
  if (!token) return res.status(503).json({ error: 'league board not set up', v: 3, env: process.env.VERCEL_ENV, names: Object.keys(process.env).filter(k => /BLOB|STORE|STORAGE|READ_WRITE/i.test(k)) });
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const e = String(b.e || ''), who = Number(b.who), order = String(b.order || '').toUpperCase();
      if (!EDITION.test(e) || !TEAMS.has(who) || !/^[A-J]{10}$/.test(order) || new Set(order).size !== 10)
        return res.status(400).json({ error: 'bad board' });
      const at = Date.now();
      await put(`boards/${e}/${who}-${order}-${at}.json`, JSON.stringify({ e, who, order, at }), { access: 'public', addRandomSuffix: true, contentType: 'application/json', token });
      return res.status(200).json({ ok: true });
    }
    const e = String(req.query.e || '');
    if (!EDITION.test(e)) return res.status(400).json({ error: 'bad edition' });
    const prefix = `boards/${e}/`, latest = {}, fans = [];
    let cursor;
    do {
      const r = await list({ prefix, cursor, limit: 1000, token });
      for (const bl of r.blobs) {
        const m = bl.pathname.slice(prefix.length).match(/^(\d+)-([A-J]{10})-(\d+)/);
        if (!m) continue;
        const x = { who: +m[1], order: m[2], at: +m[3] };
        if (x.who === 0) fans.push(x);
        else if (!latest[x.who] || latest[x.who].at < x.at) latest[x.who] = x; // one board per manager, newest wins
      }
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return res.status(200).json({ boards: Object.values(latest), fans: fans.sort((a, b) => b.at - a.at).slice(0, 40) });
  } catch (err) {
    return res.status(500).json({ error: 'storage error', detail: String(err && err.message || err).slice(0, 200) });
  }
}
