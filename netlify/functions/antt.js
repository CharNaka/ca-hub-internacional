// CA Hub — Proxy ANTT (dados abertos CKAN)
// Ferroviário: SIADE — Produção Origem Destino (TU/TKU por ferrovia e mercadoria)
// Rodoviário internacional: TRIC — Empresas habilitadas por país (corredores Mercosul)
// Sem chave. Serve indicadores de produção/registro (NÃO é posição em tempo real).

const BASE = 'https://dados.antt.gov.br/api/3/action';
const UA = 'Mozilla/5.0 (compatible; CA-Hub/1.0; +https://ca-hub-internacional.netlify.app)';
const SIADE_PKG = 'sistema-de-acompanhamento-do-desempenho-operacional-das-concessionarias-siade';
const TRIC_PKG = 'empresas-habilitadas-tric';
// Fallbacks (ids atuais caso o package_show falhe)
const RAIL_FALLBACK = 'd7263808-bd77-4153-9910-49e041d73b21'; // Produção Origem Destino 2025
const ROAD_FALLBACK = 'a14d0e93-c550-4112-898f-596f63255140'; // TRIC

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=3600'
};

async function jget(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const num = (s) => { const n = parseInt(String(s == null ? '' : s).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; };
const trim = (s) => String(s == null ? '' : s).trim();
function topN(map, n) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ nome: k, valor: v }));
}

async function resolveResource(pkg, matchRe, fallbackId) {
  try {
    const j = await jget(BASE + '/package_show?id=' + encodeURIComponent(pkg));
    const res = (j.result.resources || []).filter(x => x.datastore_active);
    if (matchRe) {
      const withYear = res
        .filter(x => matchRe.test(x.name || ''))
        .map(x => { const m = (x.name || '').match(/(20\d\d)/); return { id: x.id, year: m ? +m[1] : 0 }; })
        .sort((a, b) => b.year - a.year);
      if (withYear.length) return { id: withYear[0].id, year: withYear[0].year, modified: j.result.metadata_modified };
    }
    if (res.length) return { id: res[0].id, year: null, modified: j.result.metadata_modified };
  } catch (e) { /* cai no fallback */ }
  return { id: fallbackId, year: null, modified: null };
}

async function getRail() {
  const rs = await resolveResource(SIADE_PKG, /produ..o origem destino/i, RAIL_FALLBACK);
  const j = await jget(BASE + '/datastore_search?resource_id=' + rs.id +
    '&limit=12000&fields=Mes_Ano,Ferrovia,Mercadoria_ANTT,TU,TKU');
  const recs = (j.result && j.result.records) || [];
  let totTU = 0, totTKU = 0; const byFer = {}, byMerc = {}, byMes = {};
  for (const r of recs) {
    const tu = num(r.TU), tku = num(r.TKU);
    totTU += tu; totTKU += tku;
    const f = trim(r.Ferrovia); if (f) byFer[f] = (byFer[f] || 0) + tu;
    const m = trim(r.Mercadoria_ANTT); if (m) byMerc[m] = (byMerc[m] || 0) + tu;
    const mes = trim(r.Mes_Ano); if (mes) byMes[mes] = (byMes[mes] || 0) + tu;
  }
  const meses = Object.keys(byMes).sort((a, b) => {
    const pa = a.split('/'), pb = b.split('/');
    return (pa[1] - pb[1]) || (pa[0] - pb[0]);
  });
  return {
    ano: rs.year, atualizado: rs.modified, registros: recs.length,
    total_tu: totTU, total_tku: totTKU,
    ferrovias: topN(byFer, 8),
    mercadorias: topN(byMerc, 8),
    serie_mensal: meses.map(m => ({ mes: m, tu: byMes[m] })),
    ultimo_mes: meses.length ? meses[meses.length - 1] : null
  };
}

async function getRoad() {
  const rs = await resolveResource(TRIC_PKG, null, ROAD_FALLBACK);
  const j = await jget(BASE + '/datastore_search?resource_id=' + rs.id +
    '&limit=9000&fields=razao_social,pais_de_origem,pais_de_destino,situacao_da_empresa');
  const recs = (j.result && j.result.records) || [];
  let habil = 0; const byPais = {}, paises = {};
  for (const r of recs) {
    const sit = trim(r.situacao_da_empresa).toUpperCase();
    if (sit === 'HABILITADA') habil++;
    const po = trim(r.pais_de_origem); if (po) { byPais[po] = (byPais[po] || 0) + 1; paises[po] = 1; }
    const pd = trim(r.pais_de_destino); if (pd) paises[pd] = 1;
  }
  return {
    atualizado: rs.modified, total: recs.length, habilitadas: habil,
    paises_distintos: Object.keys(paises).length,
    por_pais_origem: topN(byPais, 8)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const mode = ((event.queryStringParameters || {}).mode || 'all').toLowerCase();
  const out = { fonte: 'ANTT — Dados Abertos (dados.antt.gov.br)' };
  try {
    const jobs = [];
    if (mode === 'all' || mode === 'rail') jobs.push(getRail().then(d => out.rail = d).catch(e => out.rail = { error: String(e.message || e) }));
    if (mode === 'all' || mode === 'road') jobs.push(getRoad().then(d => out.road = d).catch(e => out.road = { error: String(e.message || e) }));
    await Promise.all(jobs);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
