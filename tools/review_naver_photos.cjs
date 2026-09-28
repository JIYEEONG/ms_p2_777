const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/naver-course-images/review-sheets', process.env.MOOV_REVIEW_TAG || 'default');
fs.mkdirSync(out, { recursive: true });
const progress = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/naver-course-images/progress.json'), 'utf8'));
const venues = process.argv.slice(2);
const excluded = (process.env.MOOV_REVIEW_EXCLUDE || '').split('|');
const decisionPath = path.join(root, 'artifacts/naver-course-images/review-agent.json');
const reviewed = process.env.MOOV_REVIEW_SKIP_DONE && fs.existsSync(decisionPath) ? JSON.parse(fs.readFileSync(decisionPath,'utf8')) : {};
const rows = Object.entries(progress).filter(([id, x]) => (venues.length === 0 || venues.includes(x.first_place)) && !excluded.includes(x.first_place) && reviewed[id]?.sha256 !== x.sha256);
const pageSize = Number(process.env.MOOV_REVIEW_PAGE_SIZE) || 30;
const esc = s => String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const manifest = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
 const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moov-photo-review-'));
 const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars','--allow-file-access-from-files','--remote-debugging-port=0',`--user-data-dir=${profile}`], {windowsHide:true,stdio:'ignore'});
 const portFile = path.join(profile,'DevToolsActivePort');
 for(let tries=0; !fs.existsSync(portFile) && tries<300; tries++) await delay(100);
 if(!fs.existsSync(portFile)) throw new Error('Edge debugger did not start');
 const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
 const tab=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 const socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let nextId=0; const pending=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result||{});}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out '+method));},35000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 try {
 await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1550,height:Math.ceil(pageSize/5)*268+20,deviceScaleFactor:1,mobile:false});
for (let offset = 0; offset < rows.length; offset += pageSize) {
  const number = Math.floor(offset / pageSize) + 1;
  const basename = `sheet-${String(number).padStart(3, '0')}`;
  const slice = rows.slice(offset, offset + pageSize);
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:8px;background:#eee;font:14px Arial}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.cell{min-width:0;background:white;height:254px;overflow:hidden;padding:3px}img{width:100%;height:194px;object-fit:contain;background:#ddd}.name{font-weight:bold;font-size:12px}.title{font-size:11px;line-height:12px;height:24px;overflow:hidden}</style><div class="grid">${slice.map(([id,x])=>`<div class="cell"><img src="${pathToFileURL(path.join(root,'front/public',x.image_url)).href}"><div class="name">${esc(id)} ${esc(x.first_place)}</div><div class="title">${esc(x.source_title)}</div></div>`).join('')}</div>`;
  const htmlPath = path.join(out, basename + '.html');
  const imagePath = path.join(out, basename + '.png');
  fs.writeFileSync(htmlPath, html);
  await send('Page.navigate',{url:pathToFileURL(htmlPath).href});
  for(let tries=0;tries<200;tries++) {
   const state=await send('Runtime.evaluate',{expression:`document.images.length === ${slice.length} && [...document.images].every(x=>x.complete&&x.naturalWidth>0)`,returnByValue:true});
   if(state.result?.value) break;
   if(tries===199) throw new Error('Images did not load');
   await delay(50);
  }
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(imagePath,Buffer.from(shot.data,'base64'));
  manifest.push({ sheet: basename, photos: slice.map(([id,x])=>({id,sha256:x.sha256,first_place:x.first_place,image_url:x.image_url,source_title:x.source_title})) });
  console.log(imagePath);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
 } finally {
   await send('Browser.close').catch(()=>{});
   socket.close();
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
