// AIS marítimo ao vivo — AISStream.io (WebSocket). Requer AISSTREAM_KEY (variável de ambiente).
// Docs: https://aisstream.io/documentation  (navegador não é suportado por CORS — por isso este proxy)
const WebSocket = require('ws');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const key = process.env.AISSTREAM_KEY;
  if (!key || key === 'SUBSTITUA_PELA_SUA_CHAVE_AISSTREAM')
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'AISSTREAM_KEY não configurada', vessels: [] }) };

  const q = event.queryStringParameters || {};
  const box = q.bbox ? JSON.parse(q.bbox) : [[[-35, -55], [45, -5]]];
  const clean = (s) => (s || '').replace(/@+/g, ' ').trim();

  return await new Promise((resolve) => {
    const vessels = {}; let done = false, apiError = null, ws;
    const finish = () => {
      if (done) return; done = true;
      try { ws && ws.close(); } catch (_) {}
      resolve({ statusCode: 200, headers: cors, body: JSON.stringify(
        apiError ? { error: apiError, vessels: [] } : { vessels: Object.values(vessels), source: 'AISStream.io' }) });
    };
    const timer = setTimeout(finish, 4500);
    try {
      ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
      ws.on('open', () => ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: box, FilterMessageTypes: ['PositionReport'] })));
      ws.on('message', (data) => {
        try {
          const m = JSON.parse(data.toString());
          if (m.error) { apiError = m.error; clearTimeout(timer); return finish(); }
          if (m.MessageType !== 'PositionReport') return;
          const meta = m.MetaData || {};
          const pr = (m.Message && m.Message.PositionReport) || {};
          const id = meta.MMSI || pr.UserID;
          if (!id) return;
          vessels[id] = {
            mmsi: id, name: clean(meta.ShipName) || String(id),
            lat: meta.latitude != null ? meta.latitude : pr.Latitude,
            lon: meta.longitude != null ? meta.longitude : pr.Longitude,
            sog: pr.Sog, cog: pr.Cog
          };
          if (Object.keys(vessels).length >= 60) { clearTimeout(timer); finish(); }
        } catch (_) {}
      });
      ws.on('error', finish);
    } catch (_) { finish(); }
  });
};
