// PTAX (USD/BRL) — Banco Central do Brasil (Olinda). Sem chave.
exports.handler = async () => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yy = d.getFullYear();
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${mm}-${dd}-${yy}'&$format=json`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (j.value && j.value.length) {
        const c = j.value[0];
        return { statusCode: 200, headers: cors, body: JSON.stringify({ usd: c.cotacaoVenda, buy: c.cotacaoCompra, date: c.dataHoraCotacao, source: 'BCB/PTAX' }) };
      }
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ usd: null, error: 'sem cotação nos últimos dias úteis' }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ usd: null, error: String(e) }) };
  }
};
