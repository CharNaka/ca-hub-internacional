// CA Hub — Proxy Registros (MAPA/SIPEAGRO) — estabelecimentos registrados (dado real, gratuito).
// v1: Vinhos e Bebidas (produtores/fabricantes registrados no MAPA). Nome, município, UF, atividade, status.
// CNPJ vem mascarado na origem (privacidade) — não exposto.
const UA = 'Mozilla/5.0 (compatible; CA-Hub/1.0; +https://ca-hub-internacional.netlify.app)';
const SOURCES = {
  vinhos: {
    label: 'Vinhos e Bebidas',
    url: 'https://dados.agricultura.gov.br/dataset/52a01565-72d6-410e-b21b-64035831a7be/resource/8ef7a4fc-f9d9-495b-b3ae-a2ffe931ff82/download/sipeagrovinhosebebidas.csv'
  }
};
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=21600' // 6h (base atualizada ~semanalmente)
};
const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const p = event.queryStringParameters || {};
  const src = SOURCES[(p.fonte || 'vinhos').toLowerCase()] || SOURCES.vinhos;
  const q = norm(p.q);
  const uf = (p.uf || '').toUpperCase().trim();
  const limit = Math.min(parseInt(p.limit, 10) || 200, 500);
  try {
    const r = await fetch(src.url, { headers: { 'User-Agent': UA, 'Accept': 'text/csv,*/*' } });
    if (!r.ok) return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: 'HTTP ' + r.status }) };
    const txt = await r.text();
    const lines = txt.split(/\r?\n/);
    // header: UF;MUNICIPIO;NUMERO_REGISTRO_ESTABELECIMENTO;STATUS_DO_REGISTRO;CPF_CNPJ;RAZAO_SOCIAL;AREA_ATUACAO;ATIVIDADE;CLASSIFICACAO
    let ativos = 0; const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i]; if (!ln) continue;
      const c = ln.split(';');
      if (c.length < 9) continue;
      const status = (c[3] || '').trim();
      if (status.toLowerCase() !== 'ativo') continue;
      ativos++;
      const rec = {
        uf: (c[0] || '').trim(),
        municipio: (c[1] || '').trim(),
        razao: (c[5] || '').trim(),
        atividade: (c[7] || '').trim(),
        classificacao: (c[8] || '').trim()
      };
      if (uf && rec.uf !== uf) continue;
      if (q && !(norm(rec.razao).includes(q) || norm(rec.municipio).includes(q) || norm(rec.atividade).includes(q))) continue;
      if (rows.length < limit) rows.push(rec);
    }
    return {
      statusCode: 200, headers: HEADERS,
      body: JSON.stringify({ fonte: 'MAPA/SIPEAGRO', setor: src.label, total_ativos: ativos, count: rows.length, rows })
    };
  } catch (e) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
