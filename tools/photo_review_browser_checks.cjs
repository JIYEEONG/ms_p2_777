const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
module.exports=async({openPage,passed})=>{
  const client=await openPage(pathToFileURL(path.join(os.tmpdir(),'moov-course-photo-review','review.html')).href);
  await client.send('Emulation.setDeviceMetricsOverride',{width:1400,height:1200,deviceScaleFactor:1,mobile:false});
  await client.wait(`[...document.images].length>0 && [...document.images].every(img=>img.complete)`,'review photos load');
  const count=await client.evaluate(`document.querySelectorAll('article').length`);
  for(let start=0;start<count;start+=16){
    await client.evaluate(`[...document.querySelectorAll('article')].forEach((el,i)=>el.style.display=i>=${start}&&i<${start+16}?'block':'none')`);
    await client.screenshot('photo-review-'+start,false);
  }
  passed('Reviewed '+count+' public photo candidates');
};
