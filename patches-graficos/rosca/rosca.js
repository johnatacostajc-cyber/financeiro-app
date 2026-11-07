// ===== Gráfico de rosca da carteira (aba "Composição" de Investimentos) =====
// Fatia = peso da posição em reais (casal somado). Fatias pequenas viram "Outros". Toque numa fatia (ou num item da legenda) para ver os detalhes; no computador, basta passar o mouse.
const RC_LABEL={'Ações':'Ações','FII':'FIIs','Stocks':'Stocks','REIT':'REITs','ETF':'ETFs'};
const RC_HUE={'Ações':158,'FII':38,'Stocks':212,'REIT':282,'ETF':8};
const RC_PAL=['#8ab8c4','#f6f58c','#7caf4c','#f8b765','#f6f43a','#3aa6a0','#fa9a28','#a3d47a','#fde35a','#f7b26b','#9de0b0','#a2cfa4','#557a86','#f0846a','#d8f0a0','#c39be0','#6fa8dc','#e6a8c8'];
let __rcSel=null;
function rcKey(cat){return cat==='todos'?'todos':cat}
function setRcCat(c){UI.rcCat=c;__rcSel=null;saveUI();render()}
function rcPick(k){__rcSel=__rcSel===k?null:k;render()}
function rcHover(k){
  const g=document.querySelector('.rc-center-txt'),c=window.__rcCenters||{};if(!g)return;
  g.innerHTML=k&&c[k]?c[k]:c._||'';
  document.querySelectorAll('.rc-slice').forEach(e=>e.classList.toggle('hov',!!k&&e.dataset.k===k));
}
function rcCompact(v){
  if(!isFinite(v))return '—';
  return 'R$ '+new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:v>=1e6?2:1}).format(v);
}
function rcText(hex){
  const m=String(hex).match(/^#(..)(..)(..)$/);if(!m)return '#101114';
  const [r,g,b]=m.slice(1).map(x=>parseInt(x,16)/255);
  return 0.2126*r+0.7152*g+0.0722*b>0.5?'#101114':'#fff';
}
function rcHsl(h,s,l){ // devolve hex para poder calcular o contraste do texto
  s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}
function rcArc(cx,cy,r0,r1,a0,a1){
  if(a1-a0>=Math.PI*2-1e-6)a1=a0+Math.PI*2-1e-4;
  const p=(r,a)=>`${(cx+r*Math.sin(a)).toFixed(2)} ${(cy-r*Math.cos(a)).toFixed(2)}`,big=a1-a0>Math.PI?1:0;
  return `M${p(r1,a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1,a1)}L${p(r0,a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0,a0)}Z`;
}
// Junta em "Outros" as posições abaixo do limite (só se forem 2 ou mais).
function rcSlices(list,base,min,cat){
  const sorted=list.slice().sort((a,b)=>b.value-a.value);
  const big=sorted.filter(a=>a.value/base*100>=min),small=sorted.filter(a=>a.value/base*100<min);
  const out=(small.length>=2?big:sorted).map(a=>({key:a.ticker,label:a.ticker,v:a.value,assets:[a],cat}));
  if(small.length>=2)out.push({key:'outros:'+cat,label:'Outros',v:small.reduce((s,a)=>s+a.value,0),assets:small,cat,outros:true});
  return out;
}
function rcMetrics(arr){
  const value=arr.reduce((s,a)=>s+(a.value||0),0);
  const withCost=arr.filter(a=>a.pl!=null&&a.value!=null);
  const pl=withCost.reduce((s,a)=>s+a.pl,0),cost=withCost.reduce((s,a)=>s+(a.value-a.pl),0);
  return {value,pl,cost,plPct:cost>0?pl/cost*100:null,noCost:arr.length-withCost.length};
}
function compositionPage(){
  const {all,total,groups}=groupPortfolio();
  const cats=Object.keys(groups).filter(c=>groups[c].some(a=>a.value>0)).sort((a,b)=>groups[b].reduce((s,x)=>s+(x.value||0),0)-groups[a].reduce((s,x)=>s+(x.value||0),0));
  const cat=UI.rcCat&&(UI.rcCat==='todos'||cats.includes(UI.rcCat))?UI.rcCat:'todos';
  const catVal=c=>(groups[c]||[]).reduce((s,a)=>s+(a.value>0?a.value:0),0);
  const chips=`<div class="rent-filters rc-cats" role="group" aria-label="Classe de ativos">${[['todos','Tudo',total],...cats.map(c=>[c,RC_LABEL[c]||c,catVal(c)])].map(([v,l,val])=>`<button type="button" class="chip" aria-pressed="${cat===v}" onclick="setRcCat('${esc(v)}')">${esc(l)}${v==='todos'?'':` <small>${total>0&&val/total*100<1?'&lt;1':num(total>0?val/total*100:0,0)}%</small>`}</button>`).join('')}</div>`;
  const list=(cat==='todos'?all:groups[cat]||[]).filter(a=>a.value>0);
  if(!list.length)return chips+'<div class="dt-empty">Sem posições cotadas nesta classe.</div>';
  const base=list.reduce((s,a)=>s+a.value,0);
  // Fatias e cores
  let slices=[];
  if(cat==='todos'){
    for(const c of cats){
      const ss=rcSlices(groups[c].filter(a=>a.value>0),base,1.5,c),h=RC_HUE[c]??200;
      ss.forEach((s,i)=>{if(s.outros)s.full='Outros '+(RC_LABEL[c]||c);const t=ss.length>1?i/(ss.length-1):0;s.color=s.outros?rcHsl(h,18,62):rcHsl(h,62-t*14,40+t*30)});
      slices.push(...ss);
    }
  }else{
    slices=rcSlices(list,base,2.5,cat);
    slices.forEach((s,i)=>{s.color=s.outros?'#c9cdd4':RC_PAL[i%RC_PAL.length]});
  }
  const mobile=(window.innerWidth||1000)<720;
  const S=400,C=S/2,R1=186,R0=cat==='todos'?112:104,Rc0=cat==='todos'?96:0,rm=(R0+R1)/2;
  const TAU=Math.PI*2;let a=0;
  const sel=slices.find(s=>s.key===__rcSel)||null;
  const catName=cat==='todos'?'Carteira toda':(RC_LABEL[cat]||cat);
  // Rótulo dentro da fatia só se couber de verdade (texto horizontal projetado no arco e na espessura do anel).
  const tw=t=>String(t).length*7.4+6;
  for(const s of slices){
    s.a0=a;s.a1=a+s.v/base*TAU;a=s.a1;s.mid=(s.a0+s.a1)/2;s.p=s.v/base*100;s.pt=num(s.p,s.p>=10?1:2)+'%';
    const w=Math.max(tw(s.label),tw(s.pt)),h=30,c=Math.abs(Math.cos(s.mid)),sn=Math.abs(Math.sin(s.mid));
    s.inside=(w*c+h*sn)<=(s.a1-s.a0)*rm*0.95&&(w*sn+h*c)<=(R1-R0)-6;
  }
  // No computador, quem não cabe ganha rótulo de fora com linha guia (sem sobrepor); o resto vai para a legenda abaixo.
  const ext=[];
  if(!mobile){
    for(const side of [1,-1]){
      const arr=slices.filter(s=>!s.inside&&(Math.sin(s.mid)>=0?1:-1)===side).map(s=>({s,y:C-(R1+18)*Math.cos(s.mid)})).sort((x,y)=>x.y-y.y);
      let last=-Infinity;
      for(const o of arr){o.y=Math.max(o.y,last+15);if(o.y>S+14)continue;last=o.y;o.side=side;ext.push(o)}
    }
    for(const o of ext)o.s.ext=o;
  }
  const centerFor=s=>{
    if(!s)return `<text x="${C}" y="${C-4}" class="rc-c-big">${esc(rcCompact(base))}</text><text x="${C}" y="${C+26}" class="rc-c-mid">${esc(catName)}</text><text x="${C}" y="${C+48}" class="rc-c-sub">${list.length} ativos</text>`;
    if(s.outros)return `<text x="${C}" y="${C-14}" class="rc-c-big">Outros</text><text x="${C}" y="${C+14}" class="rc-c-mid">${esc(rcCompact(s.v))} • ${num(s.p,2)}%</text><text x="${C}" y="${C+36}" class="rc-c-sub">${s.assets.length} ativos (toque para listar)</text>`;
    const x=s.assets[0],fs=x.ticker.length>7?22:30;
    return `<text x="${C}" y="${C-30}" class="rc-c-sub">${esc(cat==='todos'?(RC_LABEL[x.categoria]||x.categoria):catName)}</text><text x="${C}" y="${C+2}" class="rc-c-big" style="font-size:${fs}px">${esc(x.ticker)}</text><text x="${C}" y="${C+28}" class="rc-c-mid">${esc(rcCompact(x.value))} • ${num(s.p,2)}%</text><text x="${C}" y="${C+50}" class="rc-c-sub ${x.plPct==null?'':x.plPct>=0?'g':'r'}">${x.plPct==null?'sem preço médio':esc(pct(x.plPct))+' no preço médio'}</text>`;
  };
  window.__rcCenters={_:centerFor(sel)};for(const s of slices)__rcCenters[s.key]=centerFor(s);
  const ev=s=>`onclick="rcPick('${esc(s.key)}')" onmouseenter="rcHover('${esc(s.key)}')" onmouseleave="rcHover(null)"`;
  const paths=slices.map(s=>{
    const on=sel&&sel.key===s.key,dx=on?Math.sin(s.mid)*8:0,dy=on?-Math.cos(s.mid)*8:0,fg=rcText(s.color);
    const tx=(C+rm*Math.sin(s.mid)).toFixed(1),ty=(C-rm*Math.cos(s.mid)).toFixed(1);
    let lab='';
    if(s.inside)lab=`<text x="${tx}" y="${ty}" fill="${fg}" text-anchor="middle"><tspan x="${tx}" dy="-0.25em" class="rc-p">${s.pt}</tspan><tspan x="${tx}" dy="1.15em">${esc(s.label)}</tspan></text>`;
    else if(s.ext){
      const o=s.ext,px=C+(R1+2)*Math.sin(s.mid),py=C-(R1+2)*Math.cos(s.mid),ex=C+(R1+14)*Math.sin(s.mid),lx=C+o.side*(R1+30);
      lab=`<polyline class="rc-lead" points="${px.toFixed(1)},${py.toFixed(1)} ${ex.toFixed(1)},${o.y.toFixed(1)} ${(lx-o.side*4).toFixed(1)},${o.y.toFixed(1)}"/><text class="rc-ext" x="${lx.toFixed(1)}" y="${o.y.toFixed(1)}" dy="0.35em" text-anchor="${o.side>0?'start':'end'}"><tspan class="rc-ext-t">${esc(s.full||s.label)}</tspan> ${s.pt}</text>`;
    }
    return `<g class="rc-slice${on?' sel':''}${sel&&!on?' dim':''}" data-k="${esc(s.key)}" transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" ${ev(s)} role="button" tabindex="0" aria-label="${esc(s.label)} ${s.pt}" onkeydown="if(event.key==='Enter')rcPick('${esc(s.key)}')"><title>${esc(s.label)}${s.outros?` (${s.assets.length} ativos)`:''} • ${num(s.p,2)}% • ${esc(money(s.v))}</title><path d="${rcArc(C,C,R0,R1,s.a0,s.a1)}" fill="${s.color}"/>${lab}</g>`;
  }).join('');
  // Anel interno com as classes (só em "Tudo")
  let ring='';
  if(cat==='todos'){let b=0;ring=cats.map(c=>{const v=catVal(c),a0=b,a1=b+v/base*TAU;b=a1;return `<path d="${rcArc(C,C,Rc0,R0-4,a0,a1)}" fill="${rcHsl(RC_HUE[c]??200,55,46)}" class="rc-ring" onclick="setRcCat('${esc(c)}')"><title>${esc(RC_LABEL[c]||c)} • ${num(v/base*100,1)}% — toque para ver só esta classe</title></path>`}).join('')}
  const vb=ext.length?`-125 -18 ${S+250} ${S+36}`:`-10 -10 ${S+20} ${S+20}`;
  const svg=`<svg class="rc-svg${ext.length?' wide':''}" viewBox="${vb}" role="img" aria-label="Gráfico de rosca: peso de cada ativo na ${cat==='todos'?'carteira':'classe'}">${ring}${paths}<g class="rc-center" onclick="${sel?`rcPick('${esc(sel.key)}')`:''}"><circle cx="${C}" cy="${C}" r="${(cat==='todos'?Rc0:R0)-6}" fill="transparent"/><g class="rc-center-txt">${__rcCenters._}</g></g></svg>`;
  // Legenda: os ativos sem rótulo no gráfico (no celular, os que não couberam na fatia)
  const rest=slices.filter(s=>!s.inside&&!s.ext);
  const legend=rest.length?`<div class="rc-legend" role="group" aria-label="Ativos sem rótulo no gráfico">${rest.map(s=>`<button type="button" class="rc-leg${sel&&sel.key===s.key?' on':''}" ${ev(s)}><i style="background:${s.color}"></i><b>${esc(s.full||s.label)}</b><span>${s.pt}</span></button>`).join('')}</div>`:'';
  // Cartões
  const m=rcMetrics(list),tone=v=>v==null?'':v>=0?'green':'red';
  const cards=`<div class="rc-cards">
    <div class="rc-card"><span>Patrimônio</span><b>${money(m.value)}</b></div>
    <div class="rc-card"><span>Custo total</span><b>${money(m.cost)}</b></div>
    <div class="rc-card"><span>Variação atual</span><b class="${tone(m.pl)}">${m.pl>=0?'+':'−'}${money(Math.abs(m.pl))}</b></div>
    <div class="rc-card"><span>Variação</span><b class="${tone(m.plPct)}">${esc(pct(m.plPct))}</b></div></div>`;
  // Lista do "Outros" selecionado, ou detalhe do ativo
  let detail='';
  if(sel&&sel.outros)detail=`<div class="hm-detail rc-list"><div class="hm-detail-head"><b>Outros${cat==='todos'?' • '+esc(RC_LABEL[sel.cat]||sel.cat):''}</b><span>${esc(money(sel.v))}</span><button type="button" class="btn" onclick="rcPick('${esc(sel.key)}')" aria-label="Fechar">×</button></div>${sel.assets.map(x=>`<div class="hm-row"><span class="alogo-row">${assetLogo(x.ticker,20)}<b>${esc(x.ticker)}</b></span><b>${num(x.value/base*100,2)}% <small class="muted">${esc(money(x.value))}</small></b></div>`).join('')}</div>`;
  const note=`<p class="hm-note">Peso de cada ativo pelo valor de mercado de hoje (casal somado, em reais). Posições abaixo de ${cat==='todos'?'1,5':'2,5'}% ficam em "Outros". ${cat==='todos'?'O anel de dentro mostra as classes (toque nele para filtrar). ':''}Toque numa fatia (ou num item da legenda) para ver os detalhes; no computador, basta passar o mouse.${m.noCost?` ${m.noCost} ativo(s) sem preço médio ficam fora do custo e da variação.`:''}</p>`;
  setTimeout(()=>{const t=document.querySelector('.inv-tab[aria-selected="true"]');if(t&&t.parentElement)t.parentElement.scrollLeft=Math.max(0,t.offsetLeft-t.parentElement.offsetLeft-16)},0);
  return `${chips}<div class="rc-wrap">${svg}</div>${legend}${detail}${cards}${note}`;
}
