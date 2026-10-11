import {useEffect,useRef} from 'react';

// Fixed, reproducible educational inputs. No market-data or model-job claims.
function random(seed){let s=seed;return()=>{s=(s*1664525+1013904223)>>>0;return(s+.5)/4294967296;};}
function paths(){const r=random(42),out=[];for(let j=0;j<27;j++){let price=100,v=.00015;const p=[price];for(let i=1;i<=40;i++){const normal=()=>Math.sqrt(-2*Math.log(r()))*Math.cos(2*Math.PI*r());let chi=0;for(let k=0;k<5;k++)chi+=normal()**2;const z=normal()*Math.sqrt(3/chi);const e=Math.sqrt(v)*z;v=.00001+.12*e*e+.82*v;price*=Math.exp(.0003+e);p.push(price);}out.push(p);}return out;}
const SAMPLE_PATHS=paths();
const SAMPLE_MIN=Math.min(...SAMPLE_PATHS.flat()),SAMPLE_MAX=Math.max(...SAMPLE_PATHS.flat());
export default function ModelVisual({model='monte',paused=false,large=false}){
 const ref=useRef(null),rotation=useRef({yaw:-.55,pitch:.3}),drag=useRef(null);
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0,width=0,height=0,visible=true,t=0,last=0,disposed=false;
  const is3d=['monte','garch','iv'].includes(model);
  function draw(){
   if(!width)return;const w=width,h=height;ctx.clearRect(0,0,w,h);
   ctx.lineWidth=1;ctx.strokeStyle='#203129';
   for(let x=22;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,h-22);ctx.stroke();}
   for(let y=14;y<h;y+=32){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(w-16,y);ctx.stroke();}
   const text=(s,x,y,color='#8ba399',align='left',size=11)=>{ctx.font=`${size}px ui-monospace,Consolas,monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);};
   const line=(points,color,weight=1)=>{ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
   if(is3d){
    const yaw=rotation.current.yaw+(!paused&&!reduced.matches&&!drag.current?Math.sin(t*.12)*.12:0),pitch=rotation.current.pitch;
    const project=(x,y,z)=>{const xx=x*Math.cos(yaw)-y*Math.sin(yaw),yy=x*Math.sin(yaw)+y*Math.cos(yaw);return[w*.48+xx*w*.31,h*.58+yy*h*.19-z*h*.25+Math.sin(pitch)*yy*h*.15];};
    for(let i=0;i<=8;i++){const v=-1+i/4;line([project(v,-1,0),project(v,1,0)],'#2a4035');line([project(-1,v,0),project(1,v,0)],'#2a4035');}
    const axes=[[-1,-1,0],[1,-1,0],[-1,1,0],[-1,-1,2.1]];
    line([project(...axes[0]),project(...axes[1])],'#74897f');line([project(...axes[0]),project(...axes[2])],'#74897f');line([project(...axes[0]),project(...axes[3])],'#74897f');
    if(model==='monte'){
      SAMPLE_PATHS.forEach((p,j)=>{const pts=p.map((v,i)=>project(-1+i/20,-.9+j/15,(v-SAMPLE_MIN)/(SAMPLE_MAX-SAMPLE_MIN)*1.75));line(pts,j===13?'#ff914d':`rgba(87,220,161,${.15+j/85})`,j===13?2:1);const index=Math.floor(t*5+j)%41;const [x,y]=pts[index];ctx.beginPath();ctx.arc(x,y,j===13?2.5:1.7,0,Math.PI*2);ctx.fillStyle=j===13?'#ffa267':'#77e4b4';ctx.fill();});
      text('Giá / gốc 100',18,22);text('Phiên →',w-18,h-14,'#a1b3a7','right');text('Kịch bản',20,h-14);
    }else{
      const val=(x,y)=>model==='garch'?.12+.28*x*x+.57*(y+1):.45+.5*x*x+.22*(y+1)+.08*Math.sin(y*3);
      for(let i=0;i<=18;i++){const q=-1+i/9;const a=[],b=[];for(let j=0;j<=24;j++){const v=-1+j/12;a.push(project(q,v,val(q,v)));b.push(project(v,q,val(v,q)));}line(a,i>10?'#ff914d99':'#68dba9bb');line(b,'#69d6a466');}
      const y=-1+((t*.2)%2);line(Array.from({length:31},(_,j)=>{const x=-1+j/15;return project(x,y,val(x,y));}),'#ff9a55',2);
      text(model==='garch'?'Phương sai tiếp theo':'IV minh họa',18,22);text(model==='garch'?'Cú sốc ε →':'Strike →',w-18,h-14,'#a1b3a7','right');text(model==='garch'?'Phương sai trước đó':'Maturity',20,h-14);
    }
   }else if(model==='hmm'){
     const nodes=[[w*.24,h*.32,'BULL','#6ce5b4'],[w*.76,h*.32,'BEAR','#e98f96'],[w*.5,h*.72,'SIDEWAYS','#f7b369']];
     nodes.forEach((n,i)=>{const next=nodes[(i+1)%3];line([[n[0],n[1]],[next[0],next[1]]],'#527064');const f=(t*.2+i*.3)%1;ctx.beginPath();ctx.arc(n[0]+(next[0]-n[0])*f,n[1]+(next[1]-n[1])*f,3,0,7);ctx.fillStyle='#ff914d';ctx.fill();});
     nodes.forEach(([x,y,label,color],i)=>{ctx.fillStyle='#10271e';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,large?35:27,0,7);ctx.fill();ctx.stroke();text(label,x,y+4,color,'center',large?12:10);});text('Trạng thái ẩn / chuyển tiếp',18,22);
   }else if(model==='hurst'){
     const left=45,right=w-25,top=35,bottom=h-38;line([[left,top],[left,bottom],[right,bottom]],'#72867b');
     [.32,.5,.72].forEach((s,k)=>{line([[left+10,bottom-15],[right-10,bottom-15-(right-left)*s*.38]],['#819b90','#ff914d','#6ce5b4'][k],1.6);text(['H < 0,5','H ≈ 0,5','H > 0,5'][k],right-10,bottom-25-(right-left)*s*.38,['#819b90','#ff914d','#6ce5b4'][k],'right');});text('log R/S(s)',18,20);text('log s →',right,h-12,'#9bafa3','right');
   }else if(model==='alpha'){
     const left=large?155:113,gap=6,cell=(w-left-25)/7;
     ['Momentum','LightGBM','Residual'].forEach((name,i)=>{text(name,18,60+i*48,'#b9c7be','left',large?12:10);for(let j=0;j<7;j++){const v=Math.sin(i*2+j*.6);ctx.fillStyle=v>0?`rgba(84,215,160,${.18+Math.abs(v)*.55})`:`rgba(255,145,77,${.18+Math.abs(v)*.45})`;ctx.fillRect(left+j*cell,42+i*48,Math.max(1,cell-gap),29);}});text('Tín hiệu minh họa / nhiều horizon',18,20);text('Horizon ngắn → dài',w-25,h-16,'#9bafa3','right');
   }else{
     const end=[w*.79,h*.48];['Momentum','ML rank','Residual'].forEach((s,i)=>{const x=w*.22,y=h*.23+i*h*.25;line([[x+30,y],[w*.5,y],[w*.5,end[1]],[end[0]-35,end[1]]],'#557567');text(s,x,y+4,'#b7c9be','center',11);const f=(t*.2+i*.25)%1;ctx.fillStyle='#72e0ab';ctx.beginPath();ctx.arc(x+(end[0]-x)*f,end[1]+(y-end[1])*(1-f),2.8,0,7);ctx.fill();});ctx.fillStyle='#202c22';ctx.strokeStyle='#ff914d';ctx.strokeRect(end[0]-35,end[1]-25,70,50);ctx.fillRect(end[0]-34,end[1]-24,68,48);text('GATE',end[0],end[1]+4,'#ffa067','center');text('Coverage → Support → Meta-label',18,20);
   }
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function tick(now){if(disposed)return;if(visible&&!document.hidden&&now-last>40){if(!paused&&!reduced.matches)t+=Math.min((now-last)/1000,.08);last=now;draw();}frame=requestAnimationFrame(tick);}
  const observer=new ResizeObserver(resize);observer.observe(canvas);const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});intersection.observe(canvas);const change=()=>draw();reduced.addEventListener('change',change);resize();frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();reduced.removeEventListener('change',change);};
 },[model,paused,large]);
 const is3d=['monte','garch','iv'].includes(model);
 return <div className={`home-model-visual ${large?'large':''}`}><canvas ref={ref} role="img" aria-label={`Minh họa cơ chế ${model}${is3d?' trong không gian 3D; kéo để xoay':''}`} onPointerDown={e=>{if(!is3d)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;rotation.current.yaw+=(e.clientX-drag.current.x)*.008;rotation.current.pitch=Math.max(-.8,Math.min(.8,rotation.current.pitch+(e.clientY-drag.current.y)*.005));drag.current={x:e.clientX,y:e.clientY};}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/><div className="home-visual-note"><span>MINH HỌA CƠ CHẾ</span>{is3d&&<span>Kéo để xoay 3D</span>}</div></div>;
}
