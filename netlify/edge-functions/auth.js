// Proteção por senha do CA Hub (vale para todas as páginas, PDFs e HTMLs do site).
// A senha fica na variável de ambiente HUB_PASSWORD do Netlify, nunca no código.
const COOKIE = "ca_hub_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

async function token(pw) {
  const data = new TextEncoder().encode("ca-hub::" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function page(msg, next) {
  const safeNext = (next || "/").replace(/"/g, "");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CA Hub · Acesso restrito</title><meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Montserrat:wght@300;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F0E8;font-family:Montserrat,Arial,sans-serif;font-weight:300;color:#141414;padding:16px}
.card{width:100%;max-width:420px;background:#FBF8F2;border:1px solid #C9A84C;padding:44px 40px 36px}
.brand{display:flex;align-items:center;gap:12px;padding-bottom:18px;border-bottom:1px solid #C9A84C;margin-bottom:28px}
.ca{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:34px;color:#C9A84C;line-height:1}
.sep{width:1px;height:30px;background:#C9A84C}
.ci{font-size:9px;letter-spacing:.32em;text-transform:uppercase;line-height:1.6;color:#333}
h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:30px;line-height:1.1}
h1 em{color:#8A6B28}
p{font-size:13px;line-height:1.6;margin:10px 0 24px;color:#333;text-align:justify}
label{display:block;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#8A6B28;font-weight:500;margin-bottom:8px}
input{width:100%;padding:13px 14px;border:1px solid #C9A84C;background:#fff;font-family:inherit;font-size:15px;color:#141414;outline:none}
input:focus{border-color:#5A3D24;box-shadow:0 0 0 2px rgba(201,168,76,.25)}
button{margin-top:18px;width:100%;padding:14px;background:#5A3D24;color:#F5F0E8;border:0;font-family:inherit;font-size:11px;letter-spacing:.3em;text-transform:uppercase;font-weight:500;cursor:pointer}
button:hover{background:#3F2A14}
.err{margin-top:14px;font-size:12px;color:#5A3D24}
.foot{margin-top:28px;padding-top:14px;border-top:1px solid #E2D6B8;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;color:#8A6B28}
</style></head><body>
<form class="card" method="POST" action="/__login">
<div class="brand"><span class="ca">CA</span><span class="sep"></span><span class="ci">Consultoria<br>Internacional</span></div>
<h1>CA Hub <em>Internacional</em></h1>
<p>Ambiente de acesso restrito. Informe a senha para continuar.</p>
<label for="pw">Senha</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<input type="hidden" name="next" value="${safeNext}">
<button type="submit">Entrar</button>
${msg ? `<div class="err">${msg}</div>` : ""}
<div class="foot">Estratégia onde o mundo decide.</div>
</form></body></html>`;
}

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export default async (request, context) => {
  const url = new URL(request.url);
  const pw = Netlify.env.get("HUB_PASSWORD");
  if (!pw) return html(page("Senha do hub ainda não configurada no Netlify (HUB_PASSWORD).", "/"), 503);
  const expected = await token(pw);

  if (url.pathname === "/__login" && request.method === "POST") {
    const form = await request.formData();
    const next = String(form.get("next") || "/");
    const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (String(form.get("password") || "") === pw) {
      return new Response(null, {
        status: 303,
        headers: { location: dest, "set-cookie": `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" },
      });
    }
    return html(page("Senha incorreta. Tente novamente.", dest), 401);
  }

  if (url.pathname === "/__sair") {
    return new Response(null, { status: 303, headers: { location: "/", "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  if (readCookie(request, COOKIE) === expected) {
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set("cache-control", "private, no-store");
    return out;
  }
  return html(page("", url.pathname + url.search), 401);
};

export const config = { path: "/*", excludedPath: ["/.netlify/*"] };
