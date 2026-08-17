// 四语母语习得 · 全栈后端（零外部依赖）
// Node 22 内置 http + node:sqlite。启动: node --experimental-sqlite server.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'static');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'app.db');

// ---------- 数据库 ----------
const db = new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pw TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  record_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS login_records(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  role TEXT,
  ip TEXT,
  tz TEXT,
  lang TEXT,
  ua TEXT,
  login_at TEXT DEFAULT (datetime('now')),
  logout_at TEXT,
  duration_sec INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings(
  user_id INTEGER PRIMARY KEY,
  data_json TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS workbench(
  user_id INTEGER,
  key TEXT,
  data_json TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, key)
);
`);

function hashPassword(pw){
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + h;
}
function verifyPassword(pw, stored){
  const [salt, h] = stored.split(':');
  if(!salt || !h) return false;
  const hh = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hh));
}
function genToken(){ return crypto.randomBytes(32).toString('hex'); }

// 种子账号
function seed(){
  const ins = db.prepare('INSERT OR IGNORE INTO users(username,pw,role,created_by) VALUES(?,?,?,?)');
  ins.run('bi6099445', hashPassword('123456'), 'user', 'system');
  ins.run('bi6099446', hashPassword('123456'), 'admin', 'system');
}
seed();

// ---------- 工具 ----------
function sendJSON(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve)=>{
    let data='';
    req.on('data', c=>{ data+=c; if(data.length>1e6) req.destroy(); });
    req.on('end', ()=>{ try{ resolve(data?JSON.parse(data):{}); }catch(e){ resolve({}); } });
  });
}
function getIp(req){
  const x = req.headers['x-forwarded-for'];
  if(x) return String(x).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}
function getToken(req){
  const a = req.headers['authorization']||'';
  if(a.startsWith('Bearer ')) return a.slice(7).trim();
  return '';
}
function getUserFromToken(token){
  if(!token) return null;
  const row = db.prepare('SELECT user_id FROM sessions WHERE token=?').get(token);
  if(!row) return null;
  return db.prepare('SELECT id,username,role FROM users WHERE id=?').get(row.user_id) || null;
}
function getSettings(userId){
  const r = db.prepare('SELECT data_json FROM settings WHERE user_id=?').get(userId);
  try{ return r?JSON.parse(r.data_json):{}; }catch(e){ return {}; }
}
function setSettings(userId, obj){
  const cur = getSettings(userId);
  const merged = Object.assign({}, cur, obj);
  db.prepare('INSERT INTO settings(user_id,data_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json')
    .run(userId, JSON.stringify(merged));
  return merged;
}

// ---------- 路由 ----------
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};

async function handleApi(req, res, u){
  const method = req.method;
  const p = u.pathname;
  const q = u.searchParams;

  // 健康检查
  if(p==='/api/health'){ return sendJSON(res,200,{ok:true, time:Date.now()}); }

  // 登录
  if(p==='/api/auth/login' && method==='POST'){
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM users WHERE username=?').get(b.user);
    if(!row || !verifyPassword(b.pass||'', row.pw)){
      return sendJSON(res,401,{ok:false, error:'账号或密码错误'});
    }
    const token = genToken();
    const ip = getIp(req);
    const ua = req.headers['user-agent']||'';
    const tz = b.tz||''; const lang = b.lang||'';
    const ins = db.prepare('INSERT INTO login_records(user_id,username,role,ip,tz,lang,ua) VALUES(?,?,?,?,?,?,?)');
    ins.run(row.id, row.username, row.role, ip, tz, lang, ua);
    const record_id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    db.prepare('INSERT INTO sessions(token,user_id,record_id) VALUES(?,?,?)').run(token, row.id, record_id);
    return sendJSON(res,200,{ok:true, token, user:row.username, role:row.role});
  }

  // 登出（回写时长）
  if(p==='/api/auth/logout' && method==='POST'){
    const token = getToken(req);
    const sess = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
    if(sess){
      const b = await readBody(req);
      db.prepare('UPDATE login_records SET duration_sec=?, logout_at=datetime(\'now\') WHERE id=?')
        .run(Math.max(0, Math.floor(b.duration||0)), sess.record_id);
      db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    }
    return sendJSON(res,200,{ok:true});
  }

  // 当前用户
  if(p==='/api/me' && method==='GET'){
    const u = getUserFromToken(getToken(req));
    if(!u) return sendJSON(res,401,{ok:false, error:'未登录'});
    return sendJSON(res,200,{ok:true, user:u.username, role:u.role, settings:getSettings(u.id)});
  }

  // 修改自己的密码
  if(p==='/api/auth/change-pass' && method==='POST'){
    const u = getUserFromToken(getToken(req));
    if(!u) return sendJSON(res,401,{ok:false, error:'未登录'});
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
    if(!verifyPassword(b.old||'', row.pw)) return sendJSON(res,400,{ok:false, error:'当前密码不正确'});
    if(!/^.{4,64}$/.test(b.pass||'')) return sendJSON(res,400,{ok:false, error:'新密码长度需4-64位'});
    db.prepare('UPDATE users SET pw=? WHERE id=?').run(hashPassword(b.pass), u.id);
    return sendJSON(res,200,{ok:true});
  }

  // 保存设置
  if(p==='/api/me/settings' && method==='PUT'){
    const u = getUserFromToken(getToken(req));
    if(!u) return sendJSON(res,401,{ok:false, error:'未登录'});
    const b = await readBody(req);
    const merged = setSettings(u.id, b||{});
    return sendJSON(res,200,{ok:true, settings:merged});
  }

  // 我的工作台
  if(p==='/api/me/workbench' && method==='GET'){
    const u = getUserFromToken(getToken(req));
    if(!u) return sendJSON(res,401,{ok:false, error:'未登录'});
    const rows = db.prepare('SELECT key,data_json,updated_at FROM workbench WHERE user_id=?').all(u.id);
    return sendJSON(res,200,{ok:true, items: rows.map(r=>({key:r.key, data:JSON.parse(r.data_json||'{}'), updated_at:r.updated_at}))});
  }
  if(p==='/api/me/workbench' && method==='PUT'){
    const u = getUserFromToken(getToken(req));
    if(!u) return sendJSON(res,401,{ok:false, error:'未登录'});
    const b = await readBody(req);
    if(!b.key) return sendJSON(res,400,{ok:false, error:'缺少 key'});
    db.prepare('INSERT INTO workbench(user_id,key,data_json) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET data_json=excluded.data_json, updated_at=datetime(\'now\')')
      .run(u.id, b.key, JSON.stringify(b.data||{}));
    return sendJSON(res,200,{ok:true});
  }

  // ---------- 管理员 ----------
  const admin = getUserFromToken(getToken(req));
  if(p.startsWith('/api/admin/')){
    if(!admin || admin.role!=='admin') return sendJSON(res,403,{ok:false, error:'无管理员权限'});
    // 用户列表
    if(p==='/api/admin/users' && method==='GET'){
      const rows = db.prepare('SELECT id,username,role,created_by,created_at FROM users ORDER BY id').all();
      return sendJSON(res,200,{ok:true, users:rows});
    }
    // 创建用户
    if(p==='/api/admin/users' && method==='POST'){
      const b = await readBody(req);
      if(!/^[A-Za-z0-9_]{3,32}$/.test(b.user||'')) return sendJSON(res,400,{ok:false, error:'用户名需3-32位字母数字下划线'});
      if(!/^.{4,64}$/.test(b.pass||'')) return sendJSON(res,400,{ok:false, error:'密码需4-64位'});
      const role = b.role==='admin' ? 'admin' : 'user';
      try{
        db.prepare('INSERT INTO users(username,pw,role,created_by) VALUES(?,?,?,?)').run(b.user, hashPassword(b.pass), role, admin.username);
      }catch(e){ return sendJSON(res,400,{ok:false, error:'用户名已存在'}); }
      return sendJSON(res,200,{ok:true});
    }
    // 修改他人密码
    let m = p.match(/^\/api\/admin\/users\/([^/]+)\/setpass$/);
    if(m && method==='POST'){
      const target = decodeURIComponent(m[1]);
      const b = await readBody(req);
      if(!/^.{4,64}$/.test(b.pass||'')) return sendJSON(res,400,{ok:false, error:'密码需4-64位'});
      const r = db.prepare('UPDATE users SET pw=? WHERE username=?').run(hashPassword(b.pass), target);
      if(r.changes===0) return sendJSON(res,404,{ok:false, error:'用户不存在'});
      return sendJSON(res,200,{ok:true});
    }
    // 删除用户（不删 admin 自己）
    m = p.match(/^\/api\/admin\/users\/([^/]+)$/);
    if(m && method==='DELETE'){
      const target = decodeURIComponent(m[1]);
      if(target===admin.username) return sendJSON(res,400,{ok:false, error:'不能删除自己'});
      const r = db.prepare('DELETE FROM users WHERE username=?').run(target);
      if(r.changes===0) return sendJSON(res,404,{ok:false, error:'用户不存在'});
      return sendJSON(res,200,{ok:true});
    }
    // 登录记录聚合
    if(p==='/api/admin/records' && method==='GET'){
      const total = db.prepare('SELECT COUNT(*) c FROM login_records').get().c;
      const uniq = db.prepare('SELECT COUNT(DISTINCT user_id) c FROM login_records').get().c;
      const dur = db.prepare('SELECT COALESCE(SUM(duration_sec),0) s FROM login_records').get().s;
      const byTz = db.prepare('SELECT tz, COUNT(*) c FROM login_records GROUP BY tz ORDER BY c DESC').all();
      const byUser = db.prepare('SELECT username, COUNT(*) c, COALESCE(SUM(duration_sec),0) s FROM login_records GROUP BY username ORDER BY c DESC').all();
      const recent = db.prepare('SELECT username,role,ip,tz,lang,login_at,duration_sec FROM login_records ORDER BY id DESC LIMIT 50').all();
      return sendJSON(res,200,{ok:true, total, uniq, duration_sec:dur, byTz, byUser, recent});
    }
    // 查看某用户工作台（隔离：仅管理员可读他人）
    m = p.match(/^\/api\/admin\/workbench\/([^/]+)$/);
    if(m && method==='GET'){
      const target = decodeURIComponent(m[1]);
      const tu = db.prepare('SELECT id FROM users WHERE username=?').get(target);
      if(!tu) return sendJSON(res,404,{ok:false, error:'用户不存在'});
      const rows = db.prepare('SELECT key,data_json,updated_at FROM workbench WHERE user_id=?').all(tu.id);
      return sendJSON(res,200,{ok:true, user:target, items: rows.map(r=>({key:r.key, data:JSON.parse(r.data_json||'{}'), updated_at:r.updated_at}))});
    }
    return sendJSON(res,404,{ok:false, error:'未知管理接口'});
  }

  return sendJSON(res,404,{ok:false, error:'接口不存在'});
}

// ---------- 静态资源 ----------
function serveStatic(req, res, u){
  let rel = decodeURIComponent(u.pathname);
  if(rel==='/' ) rel='/index.html';
  const filePath = path.join(STATIC_DIR, path.normalize(rel));
  if(!filePath.startsWith(STATIC_DIR)){ res.writeHead(403); return res.end('forbidden'); }
  fs.stat(filePath, (err, st)=>{
    if(err || !st.isFile()){
      // SPA 兜底
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {'Content-Type': MIME[ext]||'application/octet-stream', 'Cache-Control':'public, max-age=300'});
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req,res)=>{
  try{
    const u = new URL(req.url, 'http://localhost');
    if(u.pathname.startsWith('/api/')){
      await handleApi(req,res,u);
    } else {
      serveStatic(req,res,u);
    }
  }catch(e){
    console.error(e);
    if(!res.headersSent) sendJSON(res,500,{ok:false, error:'server error'});
    else res.end();
  }
});

server.listen(PORT, ()=>{
  console.log(`[四语套件后端] 监听 http://localhost:${PORT}`);
  console.log(`[静态目录] ${STATIC_DIR}`);
});
