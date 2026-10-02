// CA Hub — Proxy Aéreo (OpenSky Network / ADS-B)
// Posições reais de aeronaves ao vivo. Análogo aéreo do AIS marítimo.
// OAuth2 client-credentials se OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET estiverem no Netlify;
// senão, acesso anônimo (limite menor). Sem essas chaves no arquivo.

const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const STATES_URL = 'https://opensky-network.org/api/states/all';
const UA = 'Mozilla/5.0 (compatible; CA-Hub/1.0; +https://ca-hub-internacional.netlify.app)';
// bbox padrão: América do Sul (cobre Brasil e rotas vizinhas)
const DEF = { lamin: -34, lomin: -74, lamax: 6, lomax: -34 };
// prefixos de callsign de operadores majoritariamente de carga
const CARGO = ['FDX','UPS','GTI','GEC','CLX','BOX','CKS','ABW','ABX','CAO','CLU','MPH','TAY','QAC','GSS','RCF','LTG','CMP','ONE','NCA','SQC','BCS','DAE','ICL','RPX'];

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=20'
};

async function getToken() {
  const id = process.env.OPENSKY_CLIENT_ID, secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!r.ok) return null;
    const j = await r.json();
    return j.access_token || null;
  } catch (e) { return null; }
}

function isCargo(cs) {
  const c = (cs || '').trim().toUpperCase();
  return CARGO.some(p => c.startsWith(p));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const q = event.queryStringParameters || {};
  const bb = {
    lamin: q.lamin || DEF.lamin, lomin: q.lomin || DEF.lomin,
    lamax: q.lamax || DEF.lamax, lomax: q.lomax || DEF.lomax
  };
  const url = `${STATES_URL}?lamin=${bb.lamin}&lomin=${bb.lomin}&lamax=${bb.lamax}&lomax=${bb.lomax}`;
  try {
    const token = await getToken();
    const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(url, { headers });
    if (!r.ok) return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: 'HTTP ' + r.status, authed: !!token }) };
    const j = await r.json();
    const states = j.states || [];
    const onlyCargo = q.cargo === '1';
    let aircraft = states
      .filter(a => a[5] != null && a[6] != null && a[8] === false) // tem posição e está em voo
      .map(a => ({
        icao: a[0],
        callsign: (a[1] || '').trim() || a[0],
        pais: a[2],
        lon: a[5], lat: a[6],
        alt_m: a[7] != null ? Math.round(a[7]) : (a[13] != null ? Math.round(a[13]) : null),
        vel_kmh: a[9] != null ? Math.round(a[9] * 3.6) : null,
        track: a[10] != null ? Math.round(a[10]) : null,
        cargo: isCargo(a[1])
      }));
    if (onlyCargo) aircraft = aircraft.filter(a => a.cargo);
    // ordena cargueiros primeiro, depois por velocidade
    aircraft.sort((a, b) => (b.cargo - a.cargo) || ((b.vel_kmh || 0) - (a.vel_kmh || 0)));
    const total = aircraft.length;
    const cargoCount = aircraft.filter(a => a.cargo).length;
    return {
      statusCode: 200, headers: HEADERS,
      body: JSON.stringify({
        fonte: 'OpenSky Network (ADS-B)', authed: !!token,
        time: j.time, total, cargo: cargoCount,
        aircraft: aircraft.slice(0, 80)
      })
    };
  } catch (e) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
