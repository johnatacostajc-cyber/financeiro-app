// Gera o backend do app instalável a partir do controle principal (../controle-financeiro-app).
// O controle principal continua com login do Google (Google Sites). Este backend roda como o dono
// da planilha, sem login, e só responde a quem tiver a chave guardada em .chave.
// Uso: node build.js   (depois: clasp push)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const origem = path.join(__dirname, '..', 'controle-financeiro-app');
const arquivoChave = path.join(__dirname, '.chave');

if (!fs.existsSync(arquivoChave)) {
  fs.writeFileSync(arquivoChave, crypto.randomBytes(30).toString('base64url'));
}
const chave = fs.readFileSync(arquivoChave, 'utf8').trim();

// ----- Servidor -----
let codigo = fs.readFileSync(path.join(origem, 'Código.js'), 'utf8');

const funcoes = [];
codigo = codigo.replace(
  /function (\w+)\(([^)]*)\) \{(\r?\n\s*)(const email = )?requireSpreadsheetEditor_\(\);/g,
  (_, nome, params, quebra, email) => {
    if (nome !== 'doGet') funcoes.push(nome);
    const args = params.trim() ? 'appKey, ' + params : 'appKey';
    return `function ${nome}(${args}) {${quebra}${email || ''}requireAppKey_(appKey);`;
  }
);

const doGetNovo = `function doGet(e) {
  const p = (e && e.parameter) || {};
  const k = String(p.k || '');
  if (!chaveValida_(k)) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Acesso negado.</p>').setTitle('Acesso negado');
  }
  if (p.acao === 'notificacao') return respostaNotificacao_(p);
  const html = HtmlService.createHtmlOutputFromFile('Index').getContent().replace('%%APP_KEY%%', k);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Controle Financeiro do Casal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}`;
const antes = codigo;
codigo = codigo.replace(/function doGet\([^)]*\) \{[\s\S]*?\r?\n\}/, doGetNovo);
if (codigo === antes) throw new Error('doGet não encontrado no Código.js principal.');

codigo += `

// ===== Acesso do app instalável: chave em vez de login do Google (gerado por build.js) =====
const APP_KEY_ = ${JSON.stringify(chave)};

function chaveValida_(k) {
  k = String(k || '');
  if (k.length !== APP_KEY_.length) return false;
  let diff = 0;
  for (let i = 0; i < k.length; i++) diff |= k.charCodeAt(i) ^ APP_KEY_.charCodeAt(i);
  return diff === 0;
}

function requireAppKey_(k) {
  if (!chaveValida_(k)) throw new Error('Chave do app inválida.');
  return 'app';
}

// O MacroDroid manda as notificações do celular para cá (POST ou GET com acao=notificacao).
function doPost(e) {
  const p = Object.assign({}, (e && e.parameter) || {});
  try {
    if (e && e.postData && /json/i.test(e.postData.type || '')) Object.assign(p, JSON.parse(e.postData.contents || '{}'));
  } catch (err) { /* corpo inválido: usa só os parâmetros */ }
  if (!chaveValida_(String(p.k || ''))) return jsonOut_({ ok: false, error: 'Chave do app inválida.' });
  return respostaNotificacao_(p);
}

function respostaNotificacao_(p) {
  let r;
  try { r = registrarNotificacao_(p); } catch (err) { r = { ok: false, error: String((err && err.message) || err) }; }
  return jsonOut_(r);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
fs.writeFileSync(path.join(__dirname, 'Código.js'), codigo);

// ----- Tela -----
const funcoesCliente = JSON.stringify(funcoes);
const shim = `<script>
window.__APP_KEY__ = '%%APP_KEY%%';
// Passa a chave do app em toda chamada ao servidor.
function appRun() {
  let r = google.script.run;
  const api = {};
  ['withSuccessHandler', 'withFailureHandler', 'withUserObject'].forEach(function (n) {
    api[n] = function () { r = r[n].apply(r, arguments); return api; };
  });
  ${funcoesCliente}.forEach(function (n) {
    api[n] = function () { return r[n].apply(r, [window.__APP_KEY__].concat([].slice.call(arguments))); };
  });
  return api;
}
</script>`;
let index = fs.readFileSync(path.join(origem, 'Index.html'), 'utf8');
const m = index.match(/<head[^>]*>/i);
if (!m) throw new Error('<head> não encontrado no Index.html principal.');
index = index.replace(m[0], m[0] + '\n' + shim);
const chamadas = (index.match(/google\.script\.run\.with/g) || []).length;
index = index.replace(/google\.script\.run\.with/g, 'appRun().with');
fs.writeFileSync(path.join(__dirname, 'Index.html'), index);

console.log('Funções protegidas pela chave: ' + funcoes.join(', '));
console.log('Chamadas do app adaptadas: ' + chamadas);
