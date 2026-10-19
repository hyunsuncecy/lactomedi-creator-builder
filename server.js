// Lactomedi Creator Builders: small server for Railway.
// Serves the start page and both builders, and keeps the team's shared
// script libraries and media library on the Railway volume.
// No packages needed: plain Node 18+.
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const PASSWORD = process.env.TEAM_PASSWORD || '';
const PUBLIC = path.join(__dirname, 'public');
const DIRS = {
  scripts: path.join(DATA, 'scripts'),      // saved scripts, one JSON file each
  history: path.join(DATA, 'history'),      // every overwritten version of a script
  trash: path.join(DATA, 'trash'),          // deleted scripts (never erased)
  images: path.join(DATA, 'images'),        // images stored inside saved scripts
  media: path.join(DATA, 'media'),          // the team media library (original files)
  mediaIndex: path.join(DATA, 'media-index'),// one small info file per media file
  tmp: path.join(DATA, 'tmp')
};
for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

const APPS = { guide: 'guide.html', script: 'script.html' };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_RE = /^[a-f0-9]{64}\.[a-z0-9]{2,5}$/;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.heic': 'image/heic', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v', '.ico': 'image/x-icon' };
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };
const MEDIA_LIMIT = 300 * 1024 * 1024; // 300 MB per file

function send(res, code, body, type = 'application/json', extra = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra));
  res.end(data);
}
function authed(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(pass), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readBody(req, limit) {
  return new Promise((ok, bad) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { bad(Object.assign(new Error('too big'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', bad);
  });
}
// stream an upload to disk while hashing it, so big videos never sit in memory
function streamToFile(req, limit) {
  return new Promise((ok, bad) => {
    const tmp = path.join(DIRS.tmp, crypto.randomBytes(12).toString('hex'));
    const out = fs.createWriteStream(tmp); const hash = crypto.createHash('sha256'); let size = 0, failed = false;
    const fail = e => { if (failed) return; failed = true; out.destroy(); fs.rm(tmp, { force: true }, () => {}); bad(e); };
    req.on('data', c => { size += c.length; if (size > limit) { fail(Object.assign(new Error('too big'), { code: 413 })); req.destroy(); return; } hash.update(c); if (!out.write(c)) { req.pause(); out.once('drain', () => req.resume()); } });
    req.on('end', () => { if (failed) return; out.end(() => ok({ tmp, size, sha: hash.digest('hex') })); });
    req.on('error', fail); out.on('error', fail);
  });
}
async function writeAtomic(file, data) { const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp'; await fsp.writeFile(tmp, data); await fsp.rename(tmp, file); }
async function readJson(file) { try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return null; } }
const scriptFile = id => path.join(DIRS.scripts, id + '.json');
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, '').slice(0, n);

const locks = new Map();
async function withLock(id, fn) { const prev = locks.get(id) || Promise.resolve(); let release; const p = new Promise(r => release = r); locks.set(id, prev.then(() => p)); await prev; try { return await fn(); } finally { release(); if (locks.get(id) === p) locks.delete(id); } }

// serve a stored file, with byte ranges so videos play and scrub in every browser
function serveFile(req, res, file, type, downloadName) {
  let st; try { st = fs.statSync(file); } catch { return send(res, 404, 'not found', 'text/plain'); }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' };
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${downloadName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
    if (isNaN(start) || start < 0 || start >= st.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  if (parts[1] === 'health') return send(res, 200, { ok: true, app: 'lm-brief-builder', apps: Object.keys(APPS) });

  // ---- saved scripts (one shared library per builder) ----
  if (parts[1] === 'scripts' && parts.length === 2 && req.method === 'GET') {
    const app = url.searchParams.get('app') || '';
    const files = (await fsp.readdir(DIRS.scripts)).filter(f => f.endsWith('.json'));
    const list = [];
    for (const f of files) {
      const x = await readJson(path.join(DIRS.scripts, f)); if (!x) continue;
      if (app && (x.app || 'script') !== app) continue;
      list.push({ id: f.slice(0, -5), app: x.app || 'script', name: x.name, product: x.product, preset: x.preset, author: x.author, createdBy: x.createdBy, updatedAt: x.updatedAt, version: x.version });
    }
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return send(res, 200, list);
  }
  if (parts[1] === 'scripts' && parts.length === 3) {
    const id = parts[2]; if (!ID_RE.test(id)) return send(res, 400, { error: 'bad id' });
    const file = scriptFile(id);
    if (req.method === 'GET') { const x = await readJson(file); return x ? send(res, 200, x) : send(res, 404, { error: 'not found' }); }
    if (req.method === 'PUT') {
      let body; try { body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString()); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: 'bad body' }); }
      if (!body || typeof body.state !== 'object') return send(res, 400, { error: 'missing state' });
      return withLock(id, async () => {
        const cur = await readJson(file);
        const base = Number(body.baseVersion) || 0;
        if (cur && cur.version !== base) return send(res, 409, { error: 'conflict', version: cur.version, author: cur.author, updatedAt: cur.updatedAt });
        if (cur) await writeAtomic(path.join(DIRS.history, `${id}-v${cur.version}.json`), JSON.stringify(cur));
        const rec = {
          app: APPS[body.app] ? body.app : (cur && cur.app) || 'script',
          name: clean(body.name || 'Untitled script', 200), product: clean(body.product, 200), preset: clean(body.preset, 40),
          author: clean(body.author, 80), createdBy: cur ? cur.createdBy : clean(body.author, 80),
          createdAt: cur ? cur.createdAt : Date.now(), updatedAt: Date.now(), version: (cur ? cur.version : 0) + 1, state: body.state
        };
        await writeAtomic(file, JSON.stringify(rec));
        return send(res, 200, { id, version: rec.version, updatedAt: rec.updatedAt });
      });
    }
    if (req.method === 'DELETE') {
      return withLock(id, async () => {
        try { await fsp.rename(file, path.join(DIRS.trash, `${id}-${Date.now()}.json`)); } catch { return send(res, 404, { error: 'not found' }); }
        return send(res, 200, { ok: true });
      });
    }
  }

  // ---- images stored inside saved scripts (not listed in the media library) ----
  if (parts[1] === 'images' && parts.length === 2 && req.method === 'POST') {
    const ext = EXT[(req.headers['content-type'] || '').split(';')[0].trim()];
    if (!ext || !/^(png|jpg|gif|webp)$/.test(ext)) return send(res, 415, { error: 'images only' });
    let buf; try { buf = await readBody(req, 25 * 1024 * 1024); } catch (e) { return send(res, 413, { error: 'too big' }); }
    const name = crypto.createHash('sha256').update(buf).digest('hex') + '.' + ext;
    const file = path.join(DIRS.images, name);
    if (!fs.existsSync(file)) await writeAtomic(file, buf);
    return send(res, 200, { url: '/img/' + name });
  }

  // ---- team media library ----
  if (parts[1] === 'media' && parts.length === 2 && req.method === 'GET') {
    const files = (await fsp.readdir(DIRS.mediaIndex)).filter(f => f.endsWith('.json'));
    const list = [];
    for (const f of files) { const m = await readJson(path.join(DIRS.mediaIndex, f)); if (m && fs.existsSync(path.join(DIRS.media, m.file))) list.push(m); }
    list.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    return send(res, 200, list);
  }
  if (parts[1] === 'media' && parts.length === 2 && req.method === 'POST') {
    const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return send(res, 415, { error: 'Only photos, GIFs and videos can go in the library.' });
    let up; try { up = await streamToFile(req, MEDIA_LIMIT); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'File is larger than 300 MB.' : 'Upload failed.' }); }
    const fileName = up.sha + '.' + ext;
    const dest = path.join(DIRS.media, fileName), info = path.join(DIRS.mediaIndex, up.sha + '.json');
    if (fs.existsSync(dest)) { await fsp.rm(up.tmp, { force: true }); }
    else await fsp.rename(up.tmp, dest);
    let meta = await readJson(info);
    if (!meta) {
      meta = { id: up.sha, file: fileName, url: '/media/' + fileName, name: clean(url.searchParams.get('name') || ('file.' + ext), 200), type,
        kind: type.startsWith('video/') ? 'video' : type === 'image/gif' ? 'gif' : 'photo', size: up.size,
        uploader: clean(url.searchParams.get('by'), 80), uploadedAt: Date.now() };
      await writeAtomic(info, JSON.stringify(meta));
    }
    return send(res, 200, meta);
  }
  return send(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    if (!authed(req)) return send(res, 401, 'Team password required', 'text/plain', { 'WWW-Authenticate': 'Basic realm="Lactomedi Creator Builders", charset="UTF-8"' });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/img/')) {
      const isMedia = url.pathname.startsWith('/media/');
      const name = url.pathname.slice(isMedia ? 7 : 5);
      if (!FILE_RE.test(name)) return send(res, 404, 'not found', 'text/plain');
      const file = path.join(isMedia ? DIRS.media : DIRS.images, name);
      let dl = null;
      if (isMedia && url.searchParams.has('download')) { const m = await readJson(path.join(DIRS.mediaIndex, name.split('.')[0] + '.json')); dl = (m && m.name) || name; }
      return serveFile(req, res, file, MIME['.' + name.split('.').pop()] || 'application/octet-stream', dl);
    }
    // pages: / is the start page, /guide and /script are the builders
    let p = url.pathname.replace(/\/+$/, '') || '/';
    if (p === '/') p = '/index.html';
    else if (APPS[p.slice(1)]) p = '/' + APPS[p.slice(1)];
    const file = path.join(PUBLIC, path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); if (!res.headersSent) send(res, 500, { error: 'server error' });
  }
});
server.requestTimeout = 0; // allow long video uploads
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Creator builders running on port ${PORT}. Data folder: ${DATA}`);
  if (!PASSWORD) console.warn('TEAM_PASSWORD is not set: anyone with the link can open the builders and the team libraries.');
  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) console.warn('No Railway volume found: saved scripts and media will be lost on the next deploy. Add a volume mounted at /data.');
});
