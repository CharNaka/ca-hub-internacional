# CA Hub — Publicação e Dados ao Vivo

Este pacote deixa o Hub de Inteligência da CA rodando com dados **ao vivo**:
câmbio, **ComexStat (MDIC)** e **AIS marítimo**. As chaves ficam no servidor —
nunca no arquivo do hub.

## O que já funciona sem servidor
O **câmbio USD/BRL** é buscado direto no navegador (fonte pública, sem chave).
Basta abrir o `index.html`. ComexStat e AIS exigem a publicação abaixo.

---

## Passo a passo (≈ 15 min)

### 1. Conta no AISStream (grátis) — para o rastreamento marítimo
1. Acesse **https://aisstream.io** e crie uma conta.
2. Gere uma **API Key** (guarde — você vai colá-la no Netlify no passo 3).

### 2. Publicar no Netlify (recomendado: via Git)
Opção A — **GitHub (recomendada, instala as dependências):**
1. Suba esta pasta para um repositório no GitHub.
2. Em **app.netlify.com** → *Add new site* → *Import from Git* → escolha o repositório.
3. Deixe o build padrão. O Netlify lê o `netlify.toml` e publica.

Opção B — **Netlify CLI:**
```
npm i -g netlify-cli
cd ca-hub-deploy
netlify deploy --prod
```

> Observação: o *arrastar-e-soltar* (Netlify Drop) **não instala dependências**,
> então a função de AIS não roda por esse caminho. Use Git ou a CLI.
> (Câmbio e ComexStat funcionam em qualquer método.)

### 3. Configurar a chave do AIS
No painel do site no Netlify:
**Site settings → Environment variables → Add variable**
- Key: `AISSTREAM_KEY`
- Value: *(a chave gerada no passo 1)*

Depois, **Deploys → Trigger deploy → Clear cache and deploy site**.

### 4. Ligar o hub às fontes
1. Copie a URL do seu site (ex.: `https://ca-hub.netlify.app`).
2. Abra o hub, vá em **Fontes de Dados**.
3. Cole em "URL base das funções":
   `https://SEU-SITE.netlify.app/.netlify/functions`
4. Marque **Usar dados ao vivo** e clique **Testar conexão**.

Pronto: Análise de Mercado passa a puxar ComexStat e o Rastreamento marítimo
mostra navios reais (AIS).

---

## Endpoints das funções
- `/.netlify/functions/ptax` → cotação PTAX (Banco Central)
- `/.netlify/functions/comexstat?ncm=0901&flow=export&year=2024` → top destinos + tendência
- `/.netlify/functions/ais` → snapshot de navios (AIS) na bounding box padrão

## Calibração (uma vez, após o 1º deploy)
Os nomes dos campos de resposta do ComexStat podem variar. As funções já tratam
as variações mais comuns (`metricFOB`, `coName`, etc.). Se algum gráfico vier
vazio, me envie o retorno de `/.netlify/functions/comexstat?...` que eu ajusto
o mapeamento em minutos.

## Segurança
- A chave do AIS fica só no Netlify (variável de ambiente).
- As funções liberam CORS apenas para leitura (GET).
- O link "Publicar na Web" do Power BI é público — use só para dados não sensíveis.
