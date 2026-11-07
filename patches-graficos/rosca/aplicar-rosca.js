// node aplicar-rosca.js <Index.html> <pasta-com-rosca.js-e-css>
// Aplica DEPOIS do aplicar-heatmap.js (usa as âncoras da aba "Mapa de calor").
const fs=require('fs'),path=require('path');
const [file,dir]=process.argv.slice(2);
let s=fs.readFileSync(file,'utf8');
if(s.includes('function compositionPage('))throw new Error('rosca já aplicada');
const js=fs.readFileSync(path.join(dir,'rosca.js'),'utf8'),css=fs.readFileSync(path.join(dir,'rosca.css'),'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1)throw new Error('trecho encontrado '+n+'x: '+a.slice(0,80));s=s.replace(a,()=>b)}
const cssAnchor='.inv-tab:hover{color:var(--text)}.inv-tab[aria-selected="true"]{color:var(--accent);border-bottom-color:var(--accent)}';
rep(cssAnchor,cssAnchor+'\n'+css.trim());
rep(`function investmentsPage(){
  const tab=['rent','mapa'].includes(UI.invTab)?UI.invTab:'pos';`,
js.trim()+`
function investmentsPage(){
  const tab=['rent','mapa','rosca'].includes(UI.invTab)?UI.invTab:'pos';`);
rep(`['mapa','Mapa de calor']]`,`['mapa','Mapa de calor'],['rosca','Composição']]`);
rep(`  if(tab==='mapa')return `,
`  if(tab==='rosca')return \`<div class="page-head"><h1 class="page-title">Investimentos</h1><p class="page-subtitle">Composição da carteira: o peso de cada ativo, por classe ou tudo junto.</p></div>\${tabs}\${compositionPage()}\`;
  if(tab==='mapa')return `);
fs.writeFileSync(file,s);console.log('rosca aplicada em',file);
