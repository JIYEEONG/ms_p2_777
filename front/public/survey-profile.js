(function(root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const regions = {
    '성수':['성수','서울숲'], '이태원':['이태원'], '종로':['종로','경복궁','광화문','인사동','익선동'],
    '홍대·연남':['홍대','홍익대','연남','합정'], '강남':['강남','역삼','삼성동','코엑스','압구정','청담'],
    '잠실':['잠실','석촌','롯데월드'], '여의도':['여의도'], '한남':['한남'], '북촌·서촌':['북촌','서촌','삼청동'],
  };
  const exclusionAliases = {
    '육류':['육류','돼지고기','소고기','닭고기','삼겹살','고깃집','스테이크'],
    '해산물':['해산물','생선','새우','조개','횟집'], '유제품':['유제품','우유','치즈','버터'],
    '견과류':['견과류','땅콩','아몬드','호두'], '달걀':['달걀','계란'], '밀':['밀','밀가루'],
  };
  function metadata(course,tags={}) {
    const details=course.stopDetails||[],points=course._dbPoints||[];
    const names=[course.name,...(course.stops||[])];
    const tagValues=Object.entries(tags).filter(([key])=>key!=='price').flatMap(([,v])=>Array.isArray(v)?v:typeof v==='string'?[v]:[]);
    const explicitRegions=[tags.region||[],tags.regions||[],course.region,...details.map(p=>p.region)].flat();
    const locationText=[...names,course.address,...details.map(p=>p.address),...points.map(p=>p.address||p.road_address)].filter(Boolean).map(normalize);
    const foundRegions=Object.entries(regions).filter(([region,aliases])=>explicitRegions.includes(region)||aliases.some(alias=>locationText.some(text=>text.includes(normalize(alias))))).map(([region])=>region);
    const values=[...tagValues,...details.flatMap(p=>p.tags||[]),...points.flatMap(p=>p.tags||[])].filter(v=>typeof v==='string').map(normalize);
    return {names:names.filter(Boolean).map(normalize),values,regions:foundRegions};
  }
  function allowed(course,profile,tags={}) {
    if(!profile)return true;
    const meta=metadata(course,tags);
    if((profile.excludedRegions||[]).some(region=>meta.regions.includes(region)))return false;
    return !(profile.excludedTags||[]).some(tag=>{
      const words=exclusionAliases[tag]||[tag];
      return words.some(word=>{
        const key=normalize(word);
        return meta.values.includes(key)||(key.length>1&&meta.names.some(name=>name.includes(key)));
      });
    });
  }
  function match(course,profile,tags={}) {
    const categories=Object.keys(profile?.categories||{}),meta=metadata(course,tags);
    const matched=categories.filter(c=>(tags.category||[]).includes(c));
    const details=Object.entries(profile?.subcategories||{}).flatMap(([category,values])=>values.map(value=>({category,value})));
    const subMatched=details.filter(({category,value})=>(tags.category||[]).includes(category)&&
      (tags.subcategories ? (tags.subcategories[category]||[]).includes(value) : (tags.subcategory||[]).includes(value))).length;
    const regionMatched=(profile?.preferredRegions||[]).filter(region=>meta.regions.includes(region)).length;
    return {category:categories.length?matched.length/categories.length:0,subcategory:details.length?subMatched/details.length:0,
      region:regionMatched,matched:matched.length,total:categories.length,percent:categories.length?Math.round(100*matched.length/categories.length):null};
  }
  function rank(courses,profile,tagsFor,likesFor=()=>0) {
    return courses.filter(c=>allowed(c,profile,tagsFor(c))).map(course=>({course,match:match(course,profile,tagsFor(course))}))
      .sort((a,b)=>b.match.category-a.match.category||b.match.subcategory-a.match.subcategory||b.match.region-a.match.region||
        likesFor(b.course)-likesFor(a.course)||String(b.course.createdAt||'').localeCompare(String(a.course.createdAt||''))||String(a.course.id).localeCompare(String(b.course.id)))
      .map(item=>({...item,score:item.match.category}));
  }
  const api={allowed,match,rank};
  root.MoovSurveyProfile=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
