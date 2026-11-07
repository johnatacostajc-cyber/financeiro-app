// ===== Mapa de calor da carteira (aba de Investimentos) =====
// Tamanho do quadrado = peso da posição (em reais, casal somado); cor = variação do dia (verde sobe, vermelho cai).
const HM_LABEL={'Ações':'Ações','FII':'FIIs','Stocks':'Stocks','REIT':'REITs','ETF':'ETFs'};
let __hmSel=null;
function hmLayout(items,x,y,w,h){
  const out=[],total=items.reduce((s,i)=>s+i.v,0);if(!(total>0)||w<=0||h<=0)return out;
  const k=w*h/total;let rest=items.map(i=>({...i,a:i.v*k}));
  while(rest.length){
    const side=Math.min(w,h);
    const worst=r=>{let s=0,mx=0,mn=Infinity;for(const o of r){s+=o.a;if(o.a>mx)mx=o.a;if(o.a<mn)mn=o.a}return Math.max(side*side*mx/(s*s),s*s/(side*side*mn))};
    const row=[rest[0]];let i=1;
    while(i<rest.length&&worst([...row,rest[i]])<=worst(row)){row.push(rest[i]);i++}
    const s=row.reduce((t,o)=>t+o.a,0);
    if(w>=h){const cw=Math.min(w,s/h);let cy=y;for(const o of row){const ch=o.a/cw;out.push({...o,x,y:cy,w:cw,h:ch});cy+=ch}x+=cw;w-=cw}
    else{const rh=Math.min(h,s/w);let cx=x;for(const o of row){const c=o.a/rh;out.push({...o,x:cx,y,w:c,h:rh});cx+=c}y+=rh;h-=rh}
    rest=rest.slice(i);
  }
  return out;
}
function hmColor(p){
  if(p==null||!isFinite(p))return '#3a3b42';
  const t=Math.min(Math.abs(p)/3,1);
  if(Math.abs(p)<0.005)return '#3a3b42';
  return p>0?`hsl(146 ${45+t*25}% ${24+t*16}%)`:`hsl(352 ${50+t*25}% ${28+t*14}%)`;
}
function setHmCat(c){UI.hmCat=c;__hmSel=null;saveUI();render()}
function hmPick(t){__hmSel=__hmSel===t?null:t;render()}
function heatmapPage(){
  const {all,total,groups}=groupPortfolio();
  const cats=Object.keys(groups).filter(c=>groups[c].some(a=>a.value>0));
  const cat=UI.hmCat&&(UI.hmCat==='todos'||cats.includes(UI.hmCat))?UI.hmCat:(cats[0]||'todos');
  const tabs=`<div class="rent-filters hm-cats" role="group" aria-label="Classe de ativos">${[['todos','Carteira toda'],...cats.map(c=>[c,HM_LABEL[c]||c])].map(([v,l])=>`<button type="button" class="chip" aria-pressed="${cat===v}" onclick="setHmCat('${esc(v)}')">${esc(l)}</button>`).join('')}</div>`;
  const list=(cat==='todos'?all:groups[cat]||[]).filter(a=>a.value>0);
  if(!list.length)return tabs+'<div class="dt-empty">Sem posições cotadas nesta classe.</div>';
  const m=groupMetrics(list,total);
  const mobile=(window.innerWidth||1000)<720,W=100,H=mobile?Math.min(165,Math.max(95,list.length*7)):Math.min(58,Math.max(36,list.length*2.5));
  const toItem=a=>({t:a.ticker,v:a.value,p:a.quote&&a.quote.todayPct,a});
  let tiles=[];const borders=[];
  if(cat==='todos'){
    // Primeiro reparte a área entre as classes, depois os ativos dentro de cada classe.
    const gs=cats.map(c=>({t:c,v:(groups[c]||[]).reduce((s,a)=>s+(a.value>0?a.value:0),0)})).filter(g=>g.v>0).sort((a,b)=>b.v-a.v);
    for(const g of hmLayout(gs,0,0,W,H)){borders.push(g);tiles.push(...hmLayout(groups[g.t].filter(a=>a.value>0).map(toItem).sort((a,b)=>b.v-a.v),g.x,g.y,g.w,g.h))}
  }else tiles=hmLayout(list.map(toItem).sort((a,b)=>b.v-a.v),0,0,W,H);
  const P=(v,d)=>`${(v/d*100).toFixed(4)}%`;
  const box=r=>`left:${P(r.x,W)};top:${P(r.y,H)};width:${P(r.w,W)};height:${P(r.h,H)}`;
  const base=cat==='todos'?total:m.value;
  const cells=tiles.map(r=>{const p=r.p,big=r.w*r.h>=(mobile?260:110);return `<button type="button" class="hm-tile${__hmSel===r.t?' sel':''}" style="${box(r)};background:${hmColor(p)}" onclick="hmPick('${esc(r.t)}')" title="${esc(r.t)} • ${esc(pct(p))} hoje • ${num(r.v/base*100,1)}% da ${cat==='todos'?'carteira':'classe'}"><span><b>${esc(r.t)}</b><i>${p==null?'—':esc(pct(p).replace('+',''))}</i>${big?`<small>${num(r.v/base*100,1)}%</small>`:''}</span></button>`}).join('');
  const gb=borders.map(g=>`<div class="hm-group" style="${box(g)}"><em>${esc(HM_LABEL[g.t]||g.t)}</em></div>`).join('');
  const sel=__hmSel&&list.find(a=>a.ticker===__hmSel);
  const detail=sel?`<div class="hm-detail"><div class="hm-detail-head">${assetLogo(sel.ticker,24)}<b>${esc(sel.ticker)}</b> <span class="muted" style="margin-left:0;font-weight:600">${esc(displayAssetName(sel))}</span><span class="${(sel.quote.todayPct||0)>=0?'green':'red'}">${esc(pct(sel.quote.todayPct))}</span><button type="button" class="btn" onclick="hmPick('${esc(sel.ticker)}')" aria-label="Fechar">×</button></div>
    <div class="hm-row"><span>Posição</span><b>${money(sel.value)}</b></div>
    <div class="hm-row"><span>Peso na ${cat==='todos'?'carteira':'classe'}</span><b>${num(sel.value/base*100,2)}%</b></div>
    <div class="hm-row"><span>Variação hoje</span><b class="${(sel.today||0)>=0?'green':'red'}">${sel.today==null?'—':(sel.today>=0?'+':'−')+money(Math.abs(sel.today))}</b></div>
    <div class="hm-row"><span>Cotação</span><b>${money(sel.quote.price,sel.moeda==='USD'?'USD':'BRL')}</b></div>
    ${sel.plPct!=null?`<div class="hm-row"><span>Rentabilidade (preço médio)</span><b class="${sel.plPct>=0?'green':'red'}">${esc(pct(sel.plPct))}</b></div>`:''}</div>`:'';
  const up=list.filter(a=>(a.quote.todayPct||0)>0.005).length,down=list.filter(a=>(a.quote.todayPct||0)<-0.005).length;
  return `${tabs}<div class="hm-kpis"><span>Hoje <b class="${(m.today||0)>=0?'green':'red'}">${m.hasToday?(m.today>=0?'+':'−')+money(Math.abs(m.today)):'—'} (${esc(pct(m.todayPct))})</b></span><span>Patrimônio <b>${money(m.value)}</b></span><span><b class="green">${up}</b> em alta • <b class="red">${down}</b> em queda • ${list.length} ativos</span></div>
  <div class="hm-map" style="aspect-ratio:${W}/${H}" role="img" aria-label="Mapa de calor: tamanho = peso da posição, cor = variação do dia">${cells}${gb}</div>
  ${detail}
  <p class="hm-note">Tamanho = peso da posição (casal somado, em reais); cor = variação de hoje pela cotação do Yahoo (até ±3% a cor fica mais forte). Toque num quadrado para ver os detalhes.</p>`;
}
