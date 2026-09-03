// Course solver: paste this whole file into the browser console on a running
// game (after entering a name), then run e.g. __sim.solve(0) for hole 1.
// It drives the real step() physics over a grid of club x angle x power from
// the tee, then again from the landing cells nearest the cup, and reports:
//   level1.aces  - hole-in-one samples per club (window size; 0 = no ace)
//   level1.pen   - samples that found water/lava per club
//   birdies      - two-shot hole-outs: where the first shot stopped, how it
//                  was hit [club, angle deg, power], and how many second
//                  shots hole out from there (window size)
// __sim.trace(hole, x, y, club, angleDeg, power) replays one shot.
// __sim.setHoles([...]) swaps the live course to try a draft layout.

window.__sim = (function(){
  let penalty=0, sunk=false, patched=false;
  const orig = {};
  function patch(){
    if (patched) return; patched=true;
    orig.sink=sink; orig.haz=hazardPenalty; orig.toast=toast; orig.queue=queueMicroGreen;
    sink = () => { sunk=true; ball.moving=false; ball.vx=ball.vy=0; };
    hazardPenalty = (k) => { penalty += (k==='lava'?2:1); ball.moving=false; ball.vx=ball.vy=0; ball.z=0; ball.x=lastShotPos.x; ball.y=lastShotPos.y; };
    toast = () => {};
    queueMicroGreen = () => {};
  }
  function unpatch(){ if(!patched) return; patched=false; sink=orig.sink; hazardPenalty=orig.haz; toast=orig.toast; queueMicroGreen=orig.queue; }
  function shot(x,y,c,angle,power){
    penalty=0; sunk=false;
    const club=CLUBS[c];
    ball={x,y,vx:Math.cos(angle)*club.speed*power,vy:Math.sin(angle)*club.speed*power,z:0,vz:club.loft*power,moving:true,
      groundFriction:club.friction,lipOutShown:false,lastBumperIdx:-1,bumperToasted:true,wellInside:false,wellVisited:true,wellExitToasted:true,wellCoreHit:true,gravityTrail:[]};
    lastShotPos={x,y}; portalCooldown=0;
    let n=0; while(ball.moving && n<6000){ step(); n++; }
    return {x:ball.x,y:ball.y,sunk,penalty,frames:n};
  }
  function expand(pos, angStep, powers){
    const out=[];
    for(let c=0;c<3;c++) for(let a=0;a<360;a+=angStep) for(const p of powers){
      const r=shot(pos.x,pos.y,c,a*Math.PI/180,p);
      out.push({c,a,p,x:r.x,y:r.y,sunk:r.sunk,pen:r.penalty});
    }
    return out;
  }
  function summarize(list){
    const s={aces:[0,0,0],pen:[0,0,0],n:list.length};
    for(const r of list){ if(r.sunk&&!r.pen) s.aces[r.c]++; if(r.pen) s.pen[r.c]++; }
    return s;
  }
  function cluster(list, cell){
    const m=new Map();
    for(const r of list){ if(r.pen||r.sunk) continue; const k=Math.floor(r.x/cell)+','+Math.floor(r.y/cell); if(!m.has(k)) m.set(k,{x:r.x,y:r.y,n:0,via:r}); m.get(k).n++; }
    return [...m.values()];
  }
  function solve(i, opts={}){
    const angStep=opts.angStep||3, powers=opts.powers||[.2,.3,.4,.5,.6,.7,.8,.9,.95,1], keep=opts.keep||24, cell=opts.cell||36;
    holeIdx=i; loadHole(i); patch();
    const t0=performance.now();
    const tee={x:HOLES[i].tee[0],y:HOLES[i].tee[1]};
    const l1=expand(tee,angStep,powers);
    const s1=summarize(l1);
    const aceLines=l1.filter(r=>r.sunk&&!r.pen).slice(0,12);
    // candidate second positions: closest to cup, diverse cells
    const cells=cluster(l1,cell).map(c=>({...c,d:Math.hypot(c.x-cup.x,c.y-cup.y)})).sort((a,b)=>a.d-b.d);
    const picked=[]; for(const c of cells){ if(picked.length>=keep) break; picked.push(c); }
    const birdies=[]; let reach=0;
    for(const c of picked){
      const l2=expand({x:c.x,y:c.y},angStep,powers);
      const ok=l2.filter(r=>r.sunk&&!r.pen);
      if(ok.length){ birdies.push({from:[Math.round(c.x),Math.round(c.y)],firstShot:c.via,holeouts:ok.length,cells:c.n,sample:ok[0]}); }
      reach++;
    }
    unpatch(); loadHole(i);
    return {hole:HOLES[i].name, par:HOLES[i].par, ms:Math.round(performance.now()-t0), level1:s1, aceLines, cellsTried:reach, birdieRoutes:birdies.length, birdies:birdies.slice(0,10)};
  }
  // trace one shot for inspection
  function trace(i,x,y,c,angleDeg,power){ holeIdx=i; loadHole(i); patch(); const r=shot(x,y,c,angleDeg*Math.PI/180,power); unpatch(); loadHole(i); return r; }
  function setHoles(arr){ HOLES.length=0; HOLES.push(...arr); }
  return {solve,trace,shot,setHoles,patch,unpatch};
})();
'solver loaded';
