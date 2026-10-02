// CA Hub — Proxy Alertas Regulatórios
// Agrega feeds RSS oficiais de comércio exterior (gov.br). Sem chave.
const UA = 'Mozilla/5.0 (compatible; CA-Hub/1.0; +https://ca-hub-internacional.netlify.app)';
const FEEDS = [
  { fonte: 'MDIC', url: 'https://www.gov.br/mdic/pt-br/assuntos/noticias/RSS' },
  { fonte: 'Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS' }
];
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=1800'
};
function tag(s, re) { const m = s.match(re); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null; }
function parseFeed(xml, fonte) {
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m => {
    const s = m[0];
    const title = tag(s, /<title>([\s\S]*?)<\/title>/i);
    const link = tag(s, /<link>([\s\S]*?)<\/link>/i) || (s.match(/rdf:about="([^"]+)"/) || [])[1] || null;
    const date = tag(s, /<dc:date>([\s\S]*?)<\/dc:date>/i) || tag(s, /<pubDate>([\s\S]*?)<\/pubDate>/i);
    return { title, link, date, fonte };
  });
  return items;
}
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  let all = [];
  await Promise.all(FEEDS.map(async f => {
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
      if (!r.ok) return;
      const xml = await r.text();
      all = all.concat(parseFeed(xml, f.fonte));
    } catch (e) { /* ignora feed com falha */ }
  }));
  // filtra ruído (títulos muito curtos) e itens sem data; ordena por data desc
  const seen = new Set();
  const items = all
    .filter(i => i.title && i.title.length >= 12 && i.date)
    .filter(i => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(i => ({ ...i, ts: Date.parse(i.date) || 0 }))
    .filter(i => i.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 16)
    .map(i => ({ title: i.title, link: i.link, date: i.date, fonte: i.fonte }));
  return {
    statusCode: 200, headers: HEADERS,
    body: JSON.stringify({ fonte: 'gov.br — MDIC · Receita Federal', count: items.length, items })
  };
};
