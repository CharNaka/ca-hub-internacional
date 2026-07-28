// ComexStat (MDIC) — top destinos + tendência por SH4 (filtro "heading"), em UMA consulta.
// Query: ?ncm=0901&flow=export&year=2024   ·   Debug: &debug=1
const API = 'https://api-comexstat.mdic.gov.br/general';

async function query(body) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  const rows = (j && j.data && (j.data.list || j.data)) || j.list || j.rows || [];
  return { rows, raw: j, status: r.status };
}
const fob = (x) => Number(x.metricFOB || x.vlFob || x.us_fob || x.valorFOB || 0);
const cname = (x) => x.country || x.coName || x.noPaispt || x.pais || x.noPais || x.text || '—';

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const q = event.queryStringParameters || {};
    const sh4 = String(q.ncm || '0901').replace(/\D/g, '').slice(0, 4).padStart(4, '0');
    const flow = q.flow === 'import' ? 'import' : 'export';
    const year = parseInt(q.year || '2024', 10);

    // Uma única consulta cobrindo 5 anos — a API retorna o campo "year" por linha.
    const body = {
      flow, monthDetail: false,
      period: { from: `${year - 4}-01`, to: `${year}-12` },
      filters: [{ filter: 'heading', values: [sh4] }],
      details: ['country'],
      metrics: ['metricFOB']
    };
    const { rows, raw, status } = await query(body);

    if (q.debug) {
      const years = [...new Set(rows.map(r => r.year))];
      return { statusCode: 200, headers: cors, body: JSON.stringify({ status, requestBody: body, rowCount: rows.length, yearsPresent: years, sampleRow: rows[0] || null }, null, 2) };
    }

    // Destinos e total do ano-alvo
    const yr = String(year);
    let curr = rows.filter(r => String(r.year) === yr);
    if (curr.length === 0) curr = rows; // fallback caso a API não separe por ano
    const dest = curr.map(x => ({ name: cname(x), fob: fob(x) })).sort((a, b) => b.fob - a.fob).slice(0, 5);
    const total = curr.reduce((s, x) => s + fob(x), 0);

    // Tendência: soma por ano a partir das mesmas linhas
    const byYear = {};
    rows.forEach(r => { const y = parseInt(r.year, 10); if (!isNaN(y)) byYear[y] = (byYear[y] || 0) + fob(r); });
    const trend = [];
    for (let y = year - 4; y <= year; y++) trend.push({ year: y, fob: byYear[y] || 0 });

    return { statusCode: 200, headers: cors, body: JSON.stringify({ sh4, flow, year, total, dest, trend, source: 'ComexStat/MDIC' }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: String(e) }) };
  }
};
