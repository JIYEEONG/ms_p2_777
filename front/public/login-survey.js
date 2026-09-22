(function () {
  'use strict';
  const blank = () => ({categories:[],subcategories:{},preferredRegions:[],avoidedRegions:[],avoidances:{foodRestrictions:[],foods:[],other:[]}});
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const en = () => window.MoovI18n?.getLanguage() === 'en';
  const text = (ko,english) => en() ? english : ko;
  let config, schema, account, record, draft=blank(), step=0, mode='loading', editing=false, error='', generation=0, pending;
  const controllers = new Set();
  let consent=null, checked=false, resume=null;
  const root = () => document.querySelector('#survey');
  const label = value => en() ? schema.english[value] || value : value;
  function reset() {
    generation++;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    account=null; record=undefined; pending=null; draft=blank(); step=0; editing=false; error=''; mode='loading';consent=null;checked=false;resume=null;
    root()?.replaceChildren();
  }
  async function request(url,options={}) {
    const controller=new AbortController(); controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
      if(!response.ok) throw new Error('survey request failed');
      return await response.json();
    } finally {clearTimeout(timer);controllers.delete(controller);}
  }
  const current = (token,id) => token===generation && id===config.getUserId();
  async function ensure(id) {
    if(!id)return;
    if(account===id && editing)return;
    if(account===id && record && consent && mode==='saved') {config.enterApp();return;}
    if(account===id && (pending || ['form','saving','consent','consent-saving'].includes(mode)))return;
    if(account!==id){reset();account=id;}
    const token=generation;
    mode='loading'; error=''; config.showSurvey();render();
    const operation=(async()=>{
      try {
        const [loadedSchema,result]=await Promise.all([schema||request('./survey-schema.json'),request('/api/outing/survey')]);
        if(!current(token,id))return;
        schema=loadedSchema;record=result.survey;consent=result.locationConsent;
        config.onBackup?.(result.accountBackup);
        config.onRecord(record);
        if(!consent){mode='consent';render(true);return;}
        if(record?.status==='completed'){mode='saved';config.enterApp();return;}
        draft=record?.answers?clone(record.answers):blank();step=0;mode='form';render(true);
      } catch (_) {
        if(!current(token,id))return;
        mode='error';error=text('취향 설문을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.','Could not load your preferences. Check your connection and try again.');render();
      } finally {if(current(token,id))pending=null;}
    })();
    pending=operation;await operation;
  }
  function edit() {
    if(!record || !schema || config.getUserId()!==account)return;
    editing=true;draft=clone(record.answers);step=0;error='';mode='form';config.showSurvey();render(true);
  }
  function requestCompletion(continueAction) {
    if (record?.status === 'completed') return false;
    if (!schema || config.getUserId() !== account) return false;
    resume=continueAction;editing=false;draft=record?.answers?clone(record.answers):blank();
    step=0;error='';mode='form';config.showSurvey();render(true);
    return true;
  }
  function leave(wasEditing=false) {
    const action=resume;resume=null;
    if(action)action();else config.enterApp(wasEditing);
  }
  function hasAnswer() {
    if(step===0)return draft.categories.length>0;
    if(step===1)return draft.categories.some(c=>draft.subcategories[c]?.length);
    if(step===2)return draft.preferredRegions.length>0;
    if(step===3)return draft.avoidedRegions.length>0;
    return Object.values(draft.avoidances).some(values=>values.length);
  }
  function option(value,path,selected) {
    return `<button type="button" class="survey-option" data-survey-option="${escape(path)}" data-value="${escape(value)}" aria-pressed="${selected.includes(value)}"><span class="survey-check" aria-hidden="true">${selected.includes(value)?'✓':'+'}</span>${escape(label(value))}</button>`;
  }
  function options(values,path,selected){return `<div class="survey-options">${values.map(v=>option(v,path,selected)).join('')}</div>`;}
  function render(focus=false) {
    const host=root();if(!host)return;
    if(mode==='consent'||mode==='consent-saving'){
      host.innerHTML=`<header class="survey-head"><span class="survey-brand">Moov</span><div class="survey-languages"><button data-language="ko" aria-pressed="${!en()}">한국어</button><button data-language="en" aria-pressed="${en()}">English</button></div></header><div class="survey-body"><span class="survey-step">${text('처음 시작하기','BEFORE YOU START')}</span><h1 tabindex="-1">${text('위치 이용에 동의해 주세요','Allow location use')}</h1><p class="survey-intro">${text('MOOV를 시작하려면 위치 이용 동의가 필요해요. 내 위치를 지도에 표시하고, 택시·렌트의 출발지를 설정하는 데 사용합니다.','To start using MOOV, please agree to location use for showing your position on the map and choosing taxi or rental pickup points.')}</p><div class="survey-empty">${text('현재는 성수역 테스트 위치로 체험합니다. 실제 GPS 위치를 사용할 때는 브라우저·기기의 위치 권한을 별도로 요청합니다.','This demo currently uses Seongsu Station. Using actual GPS will require separate browser and device permission.')}</div><label class="location-consent-label"><input type="checkbox" id="location-consent-check" ${checked?'checked':''} /><span>${text('위치 이용 안내를 확인했으며 동의합니다.','I have read and agree to the location use notice.')}</span></label></div><footer class="survey-foot"><p class="survey-feedback" role="alert">${escape(error)}</p><button class="primary-button full" data-survey-action="consent" ${!checked||mode==='consent-saving'?'disabled':''}>${mode==='consent-saving'?text('저장 중…','Saving…'):text('동의하고 시작하기','Agree and start')}</button></footer>`;
      if(mode==='consent-saving')host.querySelectorAll('button,input').forEach(el=>el.disabled=true);
      if(focus)host.querySelector('h1')?.focus({preventScroll:true});
      return;
    }
    const focused=document.activeElement?.closest('[data-survey-option]');
    const focusKey=focused?[focused.dataset.surveyOption,focused.dataset.value]:null;
    const titles=[['어떤 활동을 좋아하세요?','What do you enjoy?'],['조금 더 자세히 알려주세요','Tell us a little more'],['자주 가고 싶은 동네는요?','Where would you like to go?'],['추천에서 빼고 싶은 동네는요?','Any areas to leave out?'],['피하고 싶은 것이 있나요?','Anything you prefer to avoid?']];
    const hints=[['좋아하는 활동을 모두 골라주세요. 선택하지 않은 활동도 추천될 수 있어요.','Pick all that you enjoy. Other activities can still appear.'],['앞에서 고른 활동의 세부 취향이에요. 여러 개를 고르거나 넘어가도 괜찮아요.','Choose details for your selected activities, or continue without selecting.'],['선호 지역의 코스를 먼저 추천해요. 다른 지역도 추천될 수 있어요.','These areas get priority. Trips in other areas can still appear.'],['선택한 지역이 포함된 코스는 추천에서 제외해요. 앞에서 선택한 선호 지역은 목록에서 제외했어요.','Trips in these areas are excluded. Your preferred areas are excluded from this list.'],['알려진 장소명과 태그에 해당 항목이 있는 코스를 제외해요. 실제 식재료는 방문 전 매장에 확인해 주세요.','We exclude trips with matching place names or tags. Confirm actual ingredients with the venue.']];
    let body='';
    if(mode==='loading')body=`<p class="survey-loading" role="status">${text('내 취향을 불러오는 중이에요…','Loading your preferences…')}</p>`;
    else if(mode==='error')body=`<h1>${text('잠시 연결을 확인해 주세요','Please check your connection')}</h1><p class="survey-feedback" role="alert">${escape(error)}</p><button class="primary-button full" data-survey-action="retry">${text('다시 시도','Try again')}</button>`;
    else {
      let fields='';
      if(step===0)fields=options(schema.categories,'categories',draft.categories);
      if(step===1)fields=draft.categories.length?draft.categories.map(c=>`<fieldset class="survey-group"><legend>${escape(label(c))}</legend>${options(schema.subcategories[c],'subcategories.'+c,draft.subcategories[c]||[])}</fieldset>`).join(''):`<div class="survey-empty">${text('활동을 고르지 않았어요. 이전 단계에서 선택하거나 다음으로 넘어가세요.','No activities selected. Go back to choose some, or continue.')}</div>`;
      if(step===2||step===3){const path=step===2?'preferredRegions':'avoidedRegions';const regions=step===3?schema.regions.filter(region=>!draft.preferredRegions.includes(region)):schema.regions;fields=options(regions,path,draft[path])+`<button class="survey-option survey-none" data-survey-action="none" aria-pressed="${!draft[path].length}">${text('특별히 없어요','No preference')}</button>`;}
      if(step===4)fields=`<fieldset class="survey-group"><legend>${text('음식 제한 (선택)','Food restrictions (optional)')}</legend>${options(schema.foodRestrictions,'avoidances.foodRestrictions',draft.avoidances.foodRestrictions)}</fieldset>${[['foods','특정 음식','Specific foods','예: 고수, 매운 음식','e.g. cilantro, spicy food'],['other','기타 피하고 싶은 항목','Other things to avoid','예: 등산, 놀이공원','e.g. hiking, amusement parks']].map(([key,ko,english,placeholder,ep])=>`<label class="survey-text-label" for="survey-${key}">${text(ko,english)}</label><input id="survey-${key}" data-survey-text="${key}" value="${escape(draft.avoidances[key].join(', '))}" maxlength="820" placeholder="${text(placeholder,ep)}" /><p class="small muted">${text('쉼표로 구분해 입력해 주세요. 항목당 40자, 최대 20개','Separate with commas. Up to 20 items, 40 characters each.')}</p>`).join('')}`;
      const emptyHints=[
        ['아직 활동을 고르지 않았어요. 좋아하는 활동을 선택하거나 다음으로 넘어가세요.','No activities selected yet. Choose what you enjoy, or continue.'],
        ['세부 취향을 고르지 않았어요. 원하는 항목을 선택하거나 다음으로 넘어가세요.','No details selected. Choose some, or continue.'],
        ['선호 지역을 고르지 않았어요. 지역을 선택하거나 특별히 없어요로 넘어갈 수 있어요.','No preferred areas selected. Choose some, or continue with no preference.'],
        ['제외할 지역을 고르지 않았어요. 없으면 그대로 다음으로 넘어가세요.','No areas excluded. Continue if you have none to exclude.'],
        ['피하고 싶은 항목이 없으면 그대로 저장해도 괜찮아요.','If you have nothing to avoid, you can save as is.']
      ];
      if(!hasAnswer() && !(step===1&&!draft.categories.length))fields+=`<p class="survey-empty" data-survey-empty role="status">${text(...emptyHints[step])}</p>`;
      body=`<span class="survey-step">${text(editing?'취향 수정':'나를 알아가는 시간',editing?'EDIT PREFERENCES':'GETTING TO KNOW YOU')} · ${step+1}/5</span><h1 tabindex="-1">${text(...titles[step])}</h1><p class="survey-intro">${text(...hints[step])}</p>${fields}`;
    }
    host.innerHTML=`<header class="survey-head"><span class="survey-brand">Moov</span><div class="survey-languages"><button data-language="ko" aria-pressed="${!en()}">한국어</button><button data-language="en" aria-pressed="${en()}">English</button></div></header><div class="survey-progress" role="progressbar" aria-label="${text('설문 진행','Survey progress')}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${mode==='loading'?0:step+1}">${Array.from({length:5},(_,i)=>`<span class="${i<=step?'done':''}"></span>`).join('')}</div><div class="survey-body">${body}</div>${['form','saving'].includes(mode)?`<footer class="survey-foot"><p class="survey-feedback" role="alert">${escape(error)}</p><div class="survey-foot-row">${step?`<button class="ghost-button" data-survey-action="back">${text('이전','Back')}</button>`:''}<button class="primary-button" data-survey-action="next">${mode==='saving'?text('저장 중…','Saving…'):step===4?text('저장하고 시작하기','Save preferences'):text('다음','Next')}</button></div><button class="survey-skip" data-survey-action="${editing?'cancel':'skip'}">${text(editing?'수정 취소':'나중에 할게요 · 지금까지 선택한 내용 저장',editing?'Cancel changes':'Do this later · save choices so far')}</button></footer>`:''}`;
    if(mode==='saving')host.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    if(focus)host.querySelector('h1')?.focus({preventScroll:true});
    else if(focusKey)Array.from(host.querySelectorAll('[data-survey-option]')).find(el=>el.dataset.surveyOption===focusKey[0]&&el.dataset.value===focusKey[1])?.focus({preventScroll:true});
  }
  async function save(status) {
    if(Object.values(draft.avoidances).some(values=>values.length>20||values.some(v=>v.length>40))){error=text('각 항목은 40자 이하로, 최대 20개까지 입력해 주세요.','Use up to 20 items, 40 characters each.');render();return;}
    const token=generation,id=account;
    mode='saving';error='';render();
    try {
      const result=await request('/api/outing/survey',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:schema.version,status,answers:draft})});
      if(!current(token,id))return;
      record=result.survey;config.onRecord(record);mode='saved';const wasEditing=editing;editing=false;leave(wasEditing);
    }catch(_){if(!current(token,id))return;mode='form';error=text('저장하지 못했어요. 선택 내용은 유지되어 있어요. 다시 시도해 주세요.','Could not save. Your choices are still here. Please try again.');render();}
  }
  async function agreeLocation() {
    if(!checked||mode!=='consent')return;
    const token=generation,id=account;mode='consent-saving';error='';render();
    try{
      const result=await request('/api/outing/survey/location-consent',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:'1',agreed:true})});
      if(!current(token,id))return;
      consent=result.locationConsent;
      if(record?.status==='completed'){mode='saved';config.enterApp();return;}
      draft=record?.answers?clone(record.answers):blank();step=0;mode='form';render(true);
    }catch(_){if(!current(token,id))return;mode='consent';error=text('동의를 저장하지 못했어요. 다시 시도해 주세요.','Could not save your agreement. Please try again.');render();}
  }
  document.addEventListener('change',event=>{
    if(event.target.id==='location-consent-check'&&mode==='consent'){
      checked=event.target.checked;
      root().querySelector('[data-survey-action="consent"]').disabled=!checked;
    }
  });
  document.addEventListener('input',event=>{
    const key=event.target.dataset.surveyText;
    if(key&&mode==='form')draft.avoidances[key]=event.target.value.split(',').map(v=>v.trim()).filter(Boolean);
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-action="edit-taste-survey"]')){edit();return;}
    const button=event.target.closest('#survey button');if(!button||button.disabled||mode==='saving'||mode==='consent-saving')return;
    const path=button.dataset.surveyOption;
    if(path){
      const parts=path.split('.');const target=parts.length===2?draft[parts[0]]:draft;const key=parts.at(-1),value=button.dataset.value;
      const values=target[key]||[];target[key]=values.includes(value)?values.filter(v=>v!==value):[...values,value];
      if(path==='categories')for(const category of Object.keys(draft.subcategories))if(!draft.categories.includes(category))delete draft.subcategories[category];
      if(path==='preferredRegions')draft.avoidedRegions=draft.avoidedRegions.filter(v=>v!==value);
      if(path==='avoidedRegions')draft.avoidedRegions=draft.avoidedRegions.filter(v=>!draft.preferredRegions.includes(v));
      error='';render();return;
    }
    switch(button.dataset.surveyAction){
      case 'consent':void agreeLocation();break;
      case 'retry':void ensure(account);break;
      case 'next':if(step<4){step++;render(true);}else void save('completed');break;
      case 'back':step=Math.max(0,step-1);error='';render(true);break;
      case 'skip':void save('skipped');break;
      case 'cancel':editing=false;mode='saved';leave(true);break;
      case 'none':draft[step===2?'preferredRegions':'avoidedRegions']=[];render();break;
    }
  });
  window.addEventListener('moov:language-change',()=>{if(root()?.classList.contains('screen-active'))render();});
  window.MoovLoginSurvey={configure:value=>{config=value;},ensure,edit,requestCompletion,reset};
})();
