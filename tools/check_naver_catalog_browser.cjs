/* Offline catalog smoke check: real app + real catalog adapter, isolated local HTTP fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'front/public');
const output = path.join(root, 'artifacts/naver-course-images/browser-validation');
fs.mkdirSync(output, {recursive: true});
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'backend/data/naver-course-images.json'), 'utf8'));
const python = fs.existsSync(path.join(root,'.venv/Scripts/python.exe')) ? path.join(root,'.venv/Scripts/python.exe') : 'python';
const adapted = spawnSync(python, ['-X','utf8','-c', 'import json,sys;sys.path.insert(0,"backend");from course_image_catalog import apply_course_images;data=json.load(open("backend/data/naver-course-images.json",encoding="utf-8"));print(json.dumps({"courses":apply_course_images(data["courses"])},ensure_ascii=False))'], {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:15000000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
if(adapted.status !== 0) throw new Error('Local catalog adapter failed: '+adapted.stderr);
const payload = JSON.parse(adapted.stdout);
const expected = {count:1000, photographed:612, missing:388};
assert.equal(payload.courses.length,expected.count);
const localRequests=[];
const report={status:'running',mode:'Offline: isolated localhost fixtures, external browser requests blocked',expected,startedAt:new Date().toISOString(),limits:['Uses real backend catalog adapter and active moov.html with mocked local auth/API; no live database, external authentication or remote image search.', 'Image decoding and app mapping checks supplement earlier visual review; they do not verify current venue hours, road routes or photo reuse rights.']};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const answers={categories:[],subcategories:{},preferredRegions:[],avoidedRegions:[],avoidances:{foodRestrictions:[],foods:[],other:[]}};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 localRequests.push({path:pathname,method:req.method});
 if(pathname==='/api/outing/courses') return json(res,200,payload);
 if(pathname==='/api/auth/config') return json(res,200,{configured:true,loginUrl:'/fixture-login'});
 if(pathname==='/api/auth/me') return json(res,200,{authenticated:true,user:{id:'google:catalog-smoke',name:'Catalog Smoke',email:'catalog@example.test',picture:''}});
 if(pathname==='/api/outing/survey') return json(res,200,{survey:{version:'1.8',status:'completed',answers,profile:{categories:{},subcategories:{},preferredRegions:[],excludedRegions:[],excludedTags:[]}},locationConsent:{version:'1',agreedAt:'2026-09-28T00:00:00Z'},accountBackup:null});
 if(pathname.endsWith('/places')) return json(res,200,{places:[]});
 if(pathname.startsWith('/api/')) return json(res,200,{configured:false,courses:[],counts:{},items:[]});
 let file=path.resolve(publicRoot,'.'+decodeURIComponent(pathname==='/'?'/moov.html':pathname));
 if(!file.startsWith(publicRoot+path.sep)) return json(res,403,{error:'outside fixture root'});
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
 if(!fs.existsSync(file)) return json(res,404,{error:'missing local fixture asset'});
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 fs.createReadStream(file).pipe(res);
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'moov-catalog-smoke-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0','--user-data-dir='+profile],{windowsHide:true,stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<300&&!fs.existsSync(portFile);i++) await delay(100);
 if(!fs.existsSync(portFile))throw new Error('Edge debugger did not start');
 const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
 const socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let nextId=0;const pending=new Map();const exceptions=[];const blocked=new Set();
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',event=>{
  const m=JSON.parse(event.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result||{});}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.method==='Fetch.requestPaused'){
   const u=new URL(m.params.request.url);const local=u.origin===base;
   if(!local)blocked.add(u.origin+u.pathname);
   void send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const wait=async(expression,label)=>{for(let i=0;i<300;i++){try{if(await evaluate(expression))return;}catch{}await delay(100);}throw new Error('Timed out: '+label);};
 const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(r.data,'base64'));};
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/moov.html?lang=ko'});
  await wait(`typeof dbCourses!=='undefined' && dbCourses.length===1000 && typeof courseCard==='function'`,'real catalog app data');
  await wait(`typeof state!=='undefined' && state.isAuthenticated`,'local auth fixture');
  const sourceIds=catalog.courses.map(x=>x.id).sort();
  report.mapping=await evaluate(`(()=>{const c=allOutingCourses();return {count:c.length,uniqueIds:new Set(c.map(x=>x.id)).size,ids:c.map(x=>x.id).sort(),photos:c.filter(x=>getCourseCoverImage(x)).length,missing:c.filter(x=>!getCourseCoverImage(x)).length,mismatches:c.filter(x=>getCourseCoverImage(x)!==getCourseStopImage(x,x.stops[0],0)).map(x=>x.id),unfixed:c.filter(x=>!x.firstPlaceCover||!x.preserveCourseIdentity).map(x=>x.id),missingFallback:c.filter(x=>!x.image&&(getCourseCoverImage(x)||getCourseStopImage(x,x.stops[0],0))).map(x=>x.id),uniquePhotos:new Set(c.map(x=>getCourseCoverImage(x)).filter(Boolean)).size}})()`);
  assert.deepEqual(report.mapping.ids,sourceIds,'All original 1,000 IDs preserved');delete report.mapping.ids;
  assert.equal(report.mapping.count,1000);assert.equal(report.mapping.uniqueIds,1000);assert.equal(report.mapping.photos,612);assert.equal(report.mapping.missing,388);assert.equal(report.mapping.uniquePhotos,612);
  assert.deepEqual(report.mapping.mismatches,[]);assert.deepEqual(report.mapping.unfixed,[]);assert.deepEqual(report.mapping.missingFallback,[]);
  report.cards=await evaluate(`(()=>{let withImage=0,blank=0;const wrong=[];for(const c of allOutingCourses()){const t=document.createElement('template');t.innerHTML=courseCard(c);const image=t.content.querySelector('.course-visual img');const noImage=t.content.querySelector('.course-visual.no-image');if(image){withImage++;if(image.getAttribute('src')!==c.image)wrong.push(c.id);}else if(noImage)blank++;else wrong.push(c.id);if(!c.image&&t.content.querySelector('.registered-stops img'))wrong.push(c.id);}return {withImage,blank,wrong};})()`);
  assert.deepEqual(report.cards,{withImage:612,blank:388,wrong:[]});
  report.decoding=await evaluate(`(async()=>{const urls=allOutingCourses().map(x=>getCourseCoverImage(x)).filter(Boolean),loaded=[],failed=[];let cursor=0;await Promise.all(Array.from({length:12},async()=>{while(cursor<urls.length){const url=urls[cursor++];try{const image=new Image();image.src=url;await image.decode();if(!image.naturalWidth)throw new Error('empty image');loaded.push({url,width:image.naturalWidth,height:image.naturalHeight});}catch(e){failed.push({url,error:String(e)});}}}));return {loaded:loaded.length,failed,minWidth:Math.min(...loaded.map(x=>x.width)),minHeight:Math.min(...loaded.map(x=>x.height))};})()`);
  assert.equal(report.decoding.loaded,612);assert.deepEqual(report.decoding.failed,[]);
  await evaluate(`state.outingQuery='';state.outingFilters=defaultOutingFilters();state.outingSub='community';state.outingSort='latest';state.outingMapOpen=false;state.communityRecommendationOpen=false;showScreen('app');setTab('outing',true);`);
  await wait(`document.querySelectorAll('.course-card').length>0`,'active community DOM');
  report.feed=await evaluate(`({cards:document.querySelectorAll('.course-card').length,photos:document.querySelectorAll('.course-visual img').length,blank:document.querySelectorAll('.course-visual.no-image').length})`);
  await evaluate(`[...document.querySelectorAll('.course-visual img')].forEach(x=>x.loading='eager')`);
  await wait(`[...document.querySelectorAll('.course-visual img')].every(x=>x.complete&&x.naturalWidth>0)`,'visible covers loaded');
  await screenshot('community-catalog');
  await evaluate(`document.querySelector('.course-visual.no-image').closest('.course-card').scrollIntoView({block:'start'})`);
  await delay(150);await screenshot('community-missing-photo');
  const sampled=await evaluate(`(()=>{const c=allOutingCourses().find(x=>x.image);window.__smokePhotoCourse=c.id;openCourseDetail(c);return {id:c.id,photo:c.image};})()`);
  await wait(`document.querySelector('.detail-cover img')?.naturalWidth>0`,'first place detail photo');
  report.detail={...sampled,photoMatches:await evaluate(`document.querySelector('.detail-cover img').getAttribute('src')===getCourseCoverImage(getCourse(window.__smokePhotoCourse))`)};
  assert.equal(report.detail.photoMatches,true);await delay(350);await screenshot('course-first-place-detail');
  await evaluate(`closeModal();const c=getCourse(window.__smokePhotoCourse);MoovCourseMedia.markFailed(c.image);render();`);
  report.failureFallback=await evaluate(`(()=>{const c=getCourse(window.__smokePhotoCourse);const t=document.createElement('template');t.innerHTML=courseCard(c);return {cover:getCourseCoverImage(c),firstStop:getCourseStopImage(c,c.stops[0],0),blank:!!t.content.querySelector('.course-visual.no-image'),image:!!t.content.querySelector('.course-visual img')};})()`);
  assert.deepEqual(report.failureFallback,{cover:null,firstStop:null,blank:true,image:false});
  report.runtimeExceptions=exceptions;report.blockedExternalRequests=[...blocked];
  report.localApiRequests=localRequests.filter(x=>x.path.startsWith('/api/'));
  report.unexpectedPhotoSearchRequests=report.localApiRequests.filter(x=>/pixabay|commons|image-search|photo-search/.test(x.path));
  assert.deepEqual(report.unexpectedPhotoSearchRequests,[],'No automatic fallback image search');
  assert.deepEqual(exceptions,[],'No uncaught runtime exceptions');
  report.status='passed';
 } finally{
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await send('Browser.close').catch(()=>{});socket.close();server.close();
 }
 console.log(JSON.stringify({status:report.status,mapping:report.mapping,cards:report.cards,decoding:report.decoding,feed:report.feed,report:path.join(output,'report.json')},null,2));
}
main().catch(error=>{report.status='failed';report.error=error.stack;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.error(error);server.close();process.exitCode=1;});
