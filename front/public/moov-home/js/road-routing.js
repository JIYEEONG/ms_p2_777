/* Demo approach routing, fully offline. Replace with a routing API and telemetry in production. */
const roadNetwork=(()=>{
  const {nodes,edges}=MOOV_ROAD_GRAPH,reverse=Array.from({length:nodes.length},()=>[]);
  edges.forEach(([a,b,length,direction])=>{if(direction&1)reverse[b].push([a,length]);if(direction&2)reverse[a].push([b,length]);});
  function nearest(point){
    const scale=111195,cos=Math.cos(point.lat*Math.PI/180);let best=null;
    edges.forEach((edge,index)=>{
      const a=nodes[edge[0]],b=nodes[edge[1]],ax=(a[1]-point.lng)*scale*cos,ay=(a[0]-point.lat)*scale,bx=(b[1]-point.lng)*scale*cos,by=(b[0]-point.lat)*scale;
      const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(ax+t*dx,ay+t*dy);
      if(!best||distance<best.distance)best={index,edge,t,distance,point:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]};
    });
    return best;
  }
  class Heap{
    constructor(){this.items=[];}
    push(value){let i=this.items.length;this.items.push(value);while(i){const p=(i-1)>>1;if(this.items[p][0]<=value[0])break;this.items[i]=this.items[p];i=p;}this.items[i]=value;}
    pop(){const min=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1][0]<this.items[c][0])c++;if(this.items[c][0]>=last[0])break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return min;}
    get length(){return this.items.length;}
  }
  function buildApproach(pickup){
    const snap=nearest(pickup);
    if(!snap||snap.distance>400)throw Error('선택 위치 주변에 연결된 도로가 없어요. 가까운 도로 쪽 픽업 위치를 선택해 주세요.');
    const [a,b,length,direction]=snap.edge,dist=new Float64Array(nodes.length).fill(Infinity),next=new Int32Array(nodes.length).fill(-2),heap=new Heap();
    const seed=(n,cost)=>{dist[n]=cost;next[n]=-1;heap.push([cost,n]);};
    if(direction&1)seed(a,length*snap.t);if(direction&2)seed(b,length*(1-snap.t));
    let start=-1,best=Infinity;
    while(heap.length){
      const [cost,u]=heap.pop();if(cost!==dist[u]||cost>2600)continue;
      if(cost>=700){const score=Math.abs(cost-1500);if(score<best){start=u;best=score;}}
      for(const [v,w] of reverse[u]){const candidate=cost+w;if(candidate<dist[v]&&candidate<=2600){dist[v]=candidate;next[v]=u;heap.push([candidate,v]);}}
    }
    if(start<0)throw Error('이 승차 지점까지 연결된 차량 경로를 찾지 못했어요. 다른 픽업 위치를 선택해 주세요.');
    const points=[],nodePath=[];let u=start;
    for(let i=0;i<nodes.length&&u>=0;i++){nodePath.push(u);points.push(nodes[u]);u=next[u];}
    points.push(snap.point);
    const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+rentalDistance({lat:points[i-1][0],lng:points[i-1][1]},{lat:points[i][0],lng:points[i][1]})*1000);
    return {points,cumulative,totalMeters:cumulative.at(-1),pickupSnap:{lat:snap.point[0],lng:snap.point[1],distanceMeters:Math.round(snap.distance)},nodePath,roadEdgeIndex:snap.index,durationMs:18000,demo:true};
  }
  return {buildApproach};
})();
function approachAt(route,progress){
  const distance=Math.max(0,Math.min(1,progress))*route.totalMeters,c=route.cumulative;
  let i=1;while(i<c.length-1&&c[i]<distance)i++;
  const a=route.points[i-1],b=route.points[i],t=(distance-c[i-1])/(c[i]-c[i-1]||1);
  const lat=a[0]+(b[0]-a[0])*t,lng=a[1]+(b[1]-a[1])*t;
  return {lat,lng,remainingMeters:Math.max(0,route.totalMeters-distance),remainingPoints:[[lat,lng],...route.points.slice(i)]};
}
function tickRoadApproach(dispatch,elapsed){
  const route=dispatch.approachRoute;
  if(!route){dispatch.message='차량 경로를 확인하지 못했어요. 다시 요청해 주세요.';rentalSetStep('error');return;}
  const progress=Math.min(1,elapsed/route.durationMs),position=approachAt(route,progress);
  dispatch.remainingMeters=position.remainingMeters;dispatch.remainingPoints=position.remainingPoints;
  const eta=Math.ceil(180*(1-progress));updateVehiclePosition(position,eta);
  if(progress===1)rentalSetStep('arrived');
}
function renderRoadPickupNote(){
  const p=state.rentalUX.dispatch.approachRoute?.pickupSnap;
  return p&&p.distanceMeters>20?`<p class="rux-note">선택 위치에서 약 ${p.distanceMeters}m 떨어진 인근 도로의 승차 지점에서 만나요.</p>`:'';
}
