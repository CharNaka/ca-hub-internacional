// CA Hub — Proxy Aéreo (ADS-B ao vivo). Análogo aéreo do AIS marítimo.
// Fonte: adsb.lol (comunitária, gratuita, sem chave, amigável a datacenter).
// Fallback: airplanes.live (mesma API). OpenSky foi descartado: bloqueia IPs de datacenter.
const UA = 'Mozilla/5.0 (compatible; CA-Hub/1.0; +https://ca-hub-internacional.netlify.app)';
// pontos estratégicos cobrindo as principais regiões/hubs do Brasil (raio 250 milhas náuticas cada)
const POINTS = [
  [-23.43, -46.47], // São Paulo (GRU/VCP)
  [-22.81, -43.25], // Rio de Janeiro
  [-15.87, -47.92], // Brasília
  [-30.00, -51.17], // Porto Alegre
  [-8.13, -34.92],  // Recife
  [-3.04, -60.05],  // Manaus
  [-16.63, -49.22]  // Goiânia/Centro-Oeste
];
const HOSTS = ['https://api.adsb.lol', 'https://api.airplanes.live'];
// prefixos de callsign de operadores majoritariamente de carga
const CARGO = ['FDX','UPS','GTI','GEC','CLX','BOX','CKS','ABW','ABX','CAO','CLU','MPH','TAY','GSS','RCF','LTG','NCA','SQC','BCS','DAE','ICL','RPX','018','TUS',' CMP'];
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=20'
};
function isCargo(cs) { const c = (cs || '').trim().toUpperCase(); return CARGO.some(p => c.startsWith(p.trim())); }
async function point(host, lat, lon) {
  const r = await fetch(`${host}/v2/point/${lat}/${lon}/250`, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.ac || j.aircraft || [];
}
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const q = event.queryStringParameters || {};
  const onlyCargo = q.cargo === '1';
  let lastErr = null;
  for (const host of HOSTS) {
    try {
      const batches = await Promise.all(POINTS.map(p => point(host, p[0], p[1]).catch(() => [])));
      const seen = new Set(); const all = [];
      for (const b of batches) for (const a of b) {
        if (!a.hex || seen.has(a.hex)) continue;
        const lat = a.lat, lon = a.lon;
        if (lat == null || lon == null) continue;
        const alt = a.alt_baro;
        if (alt === 'ground') continue;
        seen.add(a.hex);
        const cs = (a.flight || '').trim() || (a.r || '') || a.hex;
        all.push({
          callsign: cs,
          tipo: (a.t || '').trim() || '—',
          lat, lon,
          alt_m: typeof alt === 'number' ? Math.round(alt * 0.3048) : null, // ft -> m
          vel_kmh: a.gs != null ? Math.round(a.gs * 1.852) : null,          // kt -> km/h
          track: a.track != null ? Math.round(a.track) : null,
          cargo: isCargo(a.flight)
        });
      }
      if (!all.length) { lastErr = 'sem aeronaves'; continue; }
      let aircraft = onlyCargo ? all.filter(a => a.cargo) : all;
      aircraft.sort((a, b) => (b.cargo - a.cargo) || ((b.vel_kmh || 0) - (a.vel_kmh || 0)));
      return {
        statusCode: 200, headers: HEADERS,
        body: JSON.stringify({ fonte: host.includes('adsb.lol') ? 'adsb.lol (ADS-B)' : 'airplanes.live (ADS-B)', total: aircraft.length, cargo: aircraft.filter(a => a.cargo).length, aircraft: aircraft.slice(0, 90) })
      };
    } catch (e) { lastErr = String(e.message || e); }
  }
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: lastErr || 'falha ao obter ADS-B' }) };
};
