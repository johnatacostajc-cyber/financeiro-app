// node aplicar-heatmap.js <Index.html> <pasta-com-heatmap.js-e-css>
const fs=require('fs'),path=require('path');
const [file,dir]=process.argv.slice(2);
let s=fs.readFileSync(file,'utf8');
if(s.includes('function heatmapPage('))throw new Error('heatmap já aplicado');
const js=fs.readFileSync(path.join(dir,'heatmap.js'),'utf8'),css=fs.readFileSync(path.join(dir,'heatmap.css'),'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1)throw new Error('trecho encontrado '+n+'x: '+a.slice(0,80));s=s.replace(a,()=>b)}
const cssAnchor='.inv-tab:hover{color:var(--text)}.inv-tab[aria-selected="true"]{color:var(--accent);border-bottom-color:var(--accent)}';
rep(cssAnchor,cssAnchor+'\n'+css.trim()+'\n.inv-tabs{overflow-x:auto;scrollbar-width:none}.inv-tab{white-space:nowrap}');
rep(`function investmentsPage(){
  const tab=UI.invTab==='rent'?'rent':'pos';
  const tabs=\`<div class="inv-tabs" role="tablist" aria-label="Investimentos">\${[['pos','Posições'],['rent','Rentabilidade']]`,
js.trim()+`
function investmentsPage(){
  const tab=['rent','mapa'].includes(UI.invTab)?UI.invTab:'pos';
  const tabs=\`<div class="inv-tabs" role="tablist" aria-label="Investimentos">\${[['pos','Posições'],['rent','Rentabilidade'],['mapa','Mapa de calor']]`);
rep(`  if(tab==='rent')return \`<div class="page-head"><h1 class="page-title">Investimentos</h1>`,
`  if(tab==='mapa')return \`<div class="page-head"><h1 class="page-title">Investimentos</h1><p class="page-subtitle">Mapa de calor da carteira por classe: cada quadrado é um ativo, do tamanho do seu peso, colorido pela variação de hoje.</p></div>\${tabs}\${heatmapPage()}\`;
  if(tab==='rent')return \`<div class="page-head"><h1 class="page-title">Investimentos</h1>`);
fs.writeFileSync(file,s);console.log('heatmap aplicado em',file);
