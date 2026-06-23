# Consola de Envíos · Viajero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una consola privada en `/agente/` que extrae datos de los PDF de pólizas de Viajero, arma y envía el correo al cliente por Gmail API (multi-viajero) y genera 2 mensajes de WhatsApp editables.

**Architecture:** Página estática nueva dentro del mismo repo/sitio. Scripts clásicos (no ES modules, no build) que exponen objetos en `window` (`VCfg`, `VParse`, `VAuth`, `VEmail`, `VWa`, `VApp`). La `index.html` pública NO se toca. Login con Google Identity Services + whitelist; envío con Gmail API `gmail.send`. Lectura de PDF con `pdf.js`. Verificación con `agente/selftest.html` (asserts del parser) + smoke en navegador.

**Tech Stack:** HTML, Tailwind CDN, Lucide CDN, pdf.js (pin `4.x`), Google Identity Services (GIS), Gmail REST API. Sin npm.

**Referencia de diseño:** `docs/superpowers/specs/2026-06-23-consola-envios-viajero-design.md`

---

## File Structure

| Archivo | Responsabilidad |
|---------|-----------------|
| `agente/index.html` | Markup de la consola + CDNs + includes de scripts. |
| `agente/config.js` | `window.VCfg`: Client ID OAuth, whitelist, link app, docs estándar, contactos, firma. |
| `agente/parse.js` | `window.VParse`: extracción de campos del PDF + clasificación de archivos. Puro, testeable. |
| `agente/auth.js` | `window.VAuth`: login GIS, whitelist, token Gmail, userinfo. |
| `agente/email.js` | `window.VEmail`: HTML del correo (encabezado navy), MIME multipart, base64url, envío Gmail. |
| `agente/wa.js` | `window.VWa`: plantillas editables (localStorage) + link `web.whatsapp.com/send`. |
| `agente/app.js` | `window.VApp`: estado, lista de viajeros, drop/clasificación, render, preview, enviar. |
| `agente/selftest.html` | Corre asserts de `VParse` contra el texto real de la póliza de muestra. |
| `agente/assets/condiciones.pdf` | Condiciones Generales DERSA+CG (estándar). |
| `agente/assets/manual.pdf` | Manual de Indemnización paso a paso (estándar). |

**Contrato entre módulos (nombres fijos, respetar en todas las tareas):**

```
VParse.normalize(text) -> string
VParse.extractAll(text) -> { cliente, nombrePila, poliza, cedula, destino, vigenciaDesde, vigenciaHasta, correo }
VParse.classifyFile(filename, text) -> 'poliza' | 'tarjeta' | 'comprobante' | 'otro'
VParse.readPdfText(file) -> Promise<string>        // usa pdfjsLib

VAuth.init() ; VAuth.signIn() -> Promise<{email, token}> ; VAuth.getToken() -> string ; VAuth.getEmail() -> string

VEmail.buildHtml(envio) -> string                   // envio = { saludo, destinatarios[], viajeros[] }
VEmail.fileToB64(file) -> Promise<string> ; VEmail.pathToB64(path) -> Promise<string>
VEmail.buildAndSend(envio, attachments, token) -> Promise   // attachments = [{ name, b64 }]

VWa.getTemplate(tipo) -> string                     // tipo: 'emitida' | 'directa'
VWa.saveTemplate(tipo, texto) ; VWa.buildLink(tel, texto, nombre) -> string

VApp.state = { viajeros: [ Viajero ], destinatarios: [string], saludo: string }
Viajero = { cliente, nombrePila, poliza, cedula, destino, vigenciaDesde, vigenciaHasta, correo, files:File[] }
```

---

### Task 0: Scaffold `/agente/` y verificar que carga

**Files:**
- Create: `agente/index.html`
- Create: `agente/config.js`

- [ ] **Step 1: Crear `agente/config.js`**

```javascript
// agente/config.js — sin secretos: el Client ID OAuth es público por diseño.
window.VCfg = {
  // Pegar el MISMO Client ID que usan los cotizadores (Autos / Vital 360 / INS Medical).
  // Además: en Google Cloud Console agregar el origen de Netlify a "Authorized JavaScript origins".
  GOOGLE_CLIENT_ID: 'PEGAR_AQUI_EL_CLIENT_ID.apps.googleusercontent.com',
  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.send openid email profile',
  WHITELIST: ['jhernandez@segurosdelins.com'],
  APP_LINK: 'https://appasistenciainsviajero.netlify.app/',
  STANDARD_DOCS: [
    { name: 'Condiciones Generales - Seguro INS Viajero.pdf', path: 'assets/condiciones.pdf' },
    { name: 'Manual de Indemnizacion - Viajero paso a paso.pdf', path: 'assets/manual.pdf' }
  ],
  EMERGENCIA: { usa: '1 844 865 0804', espana: '900 995 484', mundo: '+34 (91) 189-5152', email: 'insinternacional@grupoins.com' },
  FIRMA: {
    nombre: 'Juan Carlos Hernández Vargas', rol: 'Agente de Seguros Exclusivo · INS',
    licencia: 'Licencia Sugese 08-1318 · Código 110113', tel: '506 8822-1348',
    correo: 'jhernandez@segurosdelins.com', web: 'www.segurosdelins.com'
  }
};
```

- [ ] **Step 2: Crear `agente/index.html` (esqueleto con CDNs e includes)**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Consola de Envíos · Viajero</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs" type="module"></script>
  <script src="https://accounts.google.com/gsi/client" async></script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-800">
  <header class="bg-blue-900 text-white">
    <div class="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
      <i data-lucide="plane" class="w-5 h-5"></i>
      <div class="font-bold">Consola de envíos · Viajero</div>
      <span class="ml-auto text-xs text-blue-200" id="who">uso interno</span>
    </div>
  </header>
  <main class="max-w-5xl mx-auto px-4 py-6">
    <div id="gate" class="text-center py-20">
      <p class="text-slate-600 mb-4">Iniciá sesión con tu cuenta autorizada para continuar.</p>
      <button id="btn-login" class="bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium">Iniciar sesión con Google</button>
      <p id="gate-err" class="text-red-600 text-sm mt-4 hidden"></p>
    </div>
    <div id="console" class="hidden"></div>
  </main>
  <script src="config.js"></script>
  <script src="parse.js"></script>
  <script src="auth.js"></script>
  <script src="email.js"></script>
  <script src="wa.js"></script>
  <script src="app.js"></script>
  <script>lucide.createIcons();</script>
</body>
</html>
```

- [ ] **Step 3: Verificar que carga**

Run: `cd C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO && python -m http.server 8970` y abrir `http://localhost:8970/agente/`.
Expected: se ve el header azul y el botón "Iniciar sesión con Google" sin errores rojos en consola (salvo que `config.js` aún tiene el Client ID placeholder).

- [ ] **Step 4: Commit**

```bash
git add agente/index.html agente/config.js
git commit -m "feat(agente): scaffold consola de envios viajero"
```

---

### Task 1: `parse.js` con self-test (núcleo de extracción — TDD)

**Files:**
- Create: `agente/parse.js`
- Create: `agente/selftest.html`

- [ ] **Step 1: Escribir `agente/selftest.html` (los asserts primero)**

```html
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Selftest VParse</title></head>
<body style="font-family:monospace;padding:20px">
<h3>Selftest VParse</h3><pre id="out"></pre>
<script src="config.js"></script>
<script src="parse.js"></script>
<script>
const SAMPLE = `INSTITUTO NACIONAL DE SEGUROS Oferta- Constancia de Seguro Seguro INS Viajero con Asistencia Autoexpedible
N° Póliza: 0201VIA023182200 Lugar: Sucursal Central Fecha: 23/06/2026
Nombre o Razón Social: CANGIANO ALMEYDA JOSE ANGEL Tipo de Identificación: Número de Identificación: 6184000178709
Nombre: CANGIANO ALMEYDA JOSE ANGEL N° Identificación: 184000178709 Monto Asegurado: $200 000 Prima: $ 164.79
Destino (s) del Viaje: ESTADOS UNIDOS- ITALIA Motivo (s) del viaje:
Vigencia: Desde: 24/07/2026 Hasta: 07/08/2026
Correo Principal: jose.cangiano@gmail.com,jhernandez@segurosdelins.com`;
const r = VParse.extractAll(SAMPLE);
const checks = [
  ['poliza', r.poliza, '0201VIA023182200'],
  ['cliente', r.cliente, 'CANGIANO ALMEYDA JOSE ANGEL'],
  ['cedula', r.cedula, '6184000178709'],
  ['destino', r.destino, 'ESTADOS UNIDOS- ITALIA'],
  ['vigenciaDesde', r.vigenciaDesde, '24/07/2026'],
  ['vigenciaHasta', r.vigenciaHasta, '07/08/2026'],
  ['correo', r.correo, 'jose.cangiano@gmail.com'],
  ['nombrePila', r.nombrePila, 'Jose Angel'],
  ['classify poliza', VParse.classifyFile('0201VIA023182200_054_540_Seguro_Viajero.pdf',''), 'poliza'],
  ['classify tarjeta', VParse.classifyFile('0201VIA0_Tarjeta_Seguro_Viajero.pdf',''), 'tarjeta'],
  ['classify comprobante', VParse.classifyFile('Comprobante De Pago.pdf',''), 'comprobante'],
];
let pass=0; const lines=checks.map(([n,got,exp])=>{const ok=got===exp;if(ok)pass++;return `${ok?'PASS':'FAIL'}  ${n}: ${JSON.stringify(got)}${ok?'':' != '+JSON.stringify(exp)}`;});
document.getElementById('out').textContent = lines.join('\n')+`\n\n${pass}/${checks.length} OK`;
</script></body></html>
```

- [ ] **Step 2: Abrir selftest y verificar que FALLA**

Run: abrir `http://localhost:8970/agente/selftest.html`.
Expected: error `VParse is not defined` (parse.js aún no existe).

- [ ] **Step 3: Escribir `agente/parse.js`**

```javascript
// agente/parse.js
window.VParse = (function () {
  function normalize(t) { return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function titleCase(s) { return s.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()); }

  function extractPoliza(t) { const m = t.match(/\b(\d{4}VIA\d{9})\b/); return m ? m[1] : ''; }
  function extractCliente(t) {
    const m = t.match(/Nombre o Raz[oó]n Social:\s*(.+?)\s+Tipo de Identifica/i);
    return m ? m[1].trim() : '';
  }
  function extractCedula(t) {
    const m = t.match(/N[uú]mero de Identificaci[oó]n:\s*([0-9A-Za-z-]+)/i);
    return m ? m[1].trim() : '';
  }
  function extractDestino(t) {
    const m = t.match(/Destino \(s\) del Viaje:\s*(.+?)\s+Motivo/i);
    return m ? m[1].trim() : '';
  }
  function extractVigencia(t) {
    const m = t.match(/Desde:\s*(\d{2}\/\d{2}\/\d{4})\s*Hasta:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return m ? { desde: m[1], hasta: m[2] } : { desde: '', hasta: '' };
  }
  function extractCorreo(t) {
    const m = t.match(/Correo Principal:\s*([^\s]+)/i);
    if (!m) return '';
    const mails = m[1].split(',').map(s => s.trim()).filter(Boolean);
    return mails.find(e => !/segurosdelins\.com$/i.test(e)) || mails[0] || '';
  }
  function sugerirNombrePila(cliente) {
    const toks = (cliente || '').trim().split(/\s+/);
    const pila = toks.length > 2 ? toks.slice(2).join(' ') : cliente;
    return pila ? titleCase(pila) : '';
  }
  function classifyFile(filename, text) {
    const f = (filename || '').toLowerCase();
    if (/tarjeta/.test(f)) return 'tarjeta';
    if (/comprobante/.test(f)) return 'comprobante';
    if (/_054_540_|oferta- ?constancia/.test(f) || /Oferta- ?Constancia de Seguro/i.test(text || '')) return 'poliza';
    if (/\d{4}via\d{9}/.test(f)) return 'poliza';
    return 'otro';
  }
  function extractAll(raw) {
    const t = normalize(raw);
    const cliente = extractCliente(t);
    const vig = extractVigencia(t);
    return {
      cliente, nombrePila: sugerirNombrePila(cliente),
      poliza: extractPoliza(t), cedula: extractCedula(t),
      destino: extractDestino(t), vigenciaDesde: vig.desde, vigenciaHasta: vig.hasta,
      correo: extractCorreo(t)
    };
  }
  async function readPdfText(file) {
    const pdfjsLib = window.pdfjsLib || (await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += ' ' + tc.items.map(it => it.str).join(' ');
    }
    return out;
  }
  return { normalize, extractAll, classifyFile, readPdfText, sugerirNombrePila };
})();
```

- [ ] **Step 4: Recargar selftest y verificar PASS**

Run: recargar `http://localhost:8970/agente/selftest.html`.
Expected: `11/11 OK` (todas PASS).

- [ ] **Step 5: Commit**

```bash
git add agente/parse.js agente/selftest.html
git commit -m "feat(agente): parser de PDF de poliza con self-test"
```

---

### Task 2: `auth.js` — login Google + whitelist + token Gmail

**Files:**
- Create: `agente/auth.js`

- [ ] **Step 1: Escribir `agente/auth.js`**

```javascript
// agente/auth.js
window.VAuth = (function () {
  let tokenClient = null, accessToken = '', userEmail = '';
  function init() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: VCfg.GOOGLE_CLIENT_ID, scope: VCfg.GMAIL_SCOPE,
      callback: () => {}
    });
  }
  function signIn() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) { try { init(); } catch (e) { return reject(e); } }
      tokenClient.callback = async (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
          const info = await r.json();
          userEmail = (info.email || '').toLowerCase();
        } catch (e) { return reject(e); }
        if (!VCfg.WHITELIST.map(x => x.toLowerCase()).includes(userEmail)) {
          accessToken = ''; return reject(new Error('Cuenta no autorizada: ' + userEmail));
        }
        resolve({ email: userEmail, token: accessToken });
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }
  return { init, signIn, getToken: () => accessToken, getEmail: () => userEmail };
})();
```

- [ ] **Step 2: Verificar login (requiere Client ID real)**

Pre-requisito: pegar el Client ID real en `config.js` y agregar `http://localhost:8970` y el dominio Netlify a los orígenes autorizados en Google Cloud Console.
Run: abrir `/agente/`, clic en "Iniciar sesión con Google", elegir `jhernandez@segurosdelins.com`.
Expected: la promesa resuelve con el email; con otra cuenta, rechaza con "Cuenta no autorizada".
(El cableado del botón al `signIn` se hace en Task 6; por ahora probar desde consola: `VAuth.signIn().then(console.log).catch(console.error)`.)

- [ ] **Step 3: Commit**

```bash
git add agente/auth.js
git commit -m "feat(agente): login Google con whitelist y token Gmail"
```

---

### Task 3: `email.js` — HTML del correo (encabezado navy) + MIME + envío

**Files:**
- Create: `agente/email.js`

- [ ] **Step 1: Escribir `agente/email.js`**

```javascript
// agente/email.js
window.VEmail = (function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function filaViajero(v) {
    const chips = [
      v.poliza && `<span style="font-family:monospace;background:#e6f1fb;color:#0c447c;padding:2px 8px;border-radius:6px;font-size:12px">${esc(v.poliza)}</span>`,
      v.destino && `<span style="background:#eef2f7;color:#475569;padding:2px 8px;border-radius:6px;font-size:12px">${esc(v.destino)}</span>`,
      (v.vigenciaDesde && v.vigenciaHasta) && `<span style="background:#eef2f7;color:#475569;padding:2px 8px;border-radius:6px;font-size:12px">${esc(v.vigenciaDesde)} &rarr; ${esc(v.vigenciaHasta)}</span>`
    ].filter(Boolean).join(' ');
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
      <div style="font-weight:600;font-size:14px;color:#0f172a">${esc(v.cliente)}</div>
      <div style="margin-top:6px;line-height:2">${chips}</div></td></tr>`;
  }

  function buildHtml(envio) {
    const C = VCfg;
    const viajeros = envio.viajeros.map(filaViajero).join('');
    return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:18px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#13477e;background:linear-gradient(135deg,#0b2545 0%,#13477e 55%,#1c6fb8 100%);padding:20px 22px">
    <div style="font-size:20px;font-weight:700;color:#ffffff">&#9992;&#65039; Seguro INS Viajero</div>
    <div style="font-size:13px;color:#b5d4f4;margin-top:3px">Su viaje, protegido en todo el mundo &middot; INS</div>
  </td></tr>
  <tr><td style="padding:18px 22px">
    <p style="font-size:14px;margin:0 0 10px">Estimado(a) ${esc(envio.saludo)}, &#128075;</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 16px">Es un gusto saludarle. Le confirmo que su Seguro INS Viajero con Asistencia ya está activo y listo para proteger a los viajeros en esta aventura.</p>
    <div style="background:#ecfdf5;border-left:3px solid #1d9e75;border-radius:0 8px 8px 0;padding:12px 14px;margin:0 0 16px">
      <div style="font-weight:600;color:#0f6e56;font-size:13px;margin-bottom:8px">&#128737;&#65039; ¿Qué cubre su seguro?</div>
      <div style="font-size:13px;color:#475569;line-height:1.9">
        &#127973; <b style="color:#0f172a">Gastos médicos</b> por accidente o enfermedad &mdash; hasta US$1.000.000.<br>
        &#129512; <b style="color:#0f172a">Equipaje y pasaporte</b> &mdash; pérdida temporal o definitiva.<br>
        &#10060; <b style="color:#0f172a">Cancelación</b> de viaje y retraso de vuelo.
      </div>
    </div>
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px">Viajeros amparados</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px">${viajeros}</table>
    <div style="background:#ecfdf5;border-radius:8px;padding:14px;text-align:center;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#0f6e56;margin-bottom:8px">Centro de asistencia 24/7</div>
      <a href="${esc(C.APP_LINK)}" style="display:inline-block;background:#0f6e56;color:#e1f5ee;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px">&#128241; Abrir mi guía de emergencias</a>
      <div style="font-size:12px;color:#64748b;margin-top:8px">Ábrala en el celular y elija "Añadir a pantalla de inicio" como botón de pánico.</div>
    </div>
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px">Documentos adjuntos</div>
    <div style="font-size:13px;color:#334155;line-height:1.9;margin-bottom:16px">
      &#9989; Póliza y tarjeta de cada viajero<br>&#9989; Comprobante de pago<br>&#9989; Condiciones generales y Manual de reembolsos
    </div>
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px">Contactos de emergencia</div>
    <div style="font-size:13px;color:#334155;line-height:1.9;margin-bottom:16px">
      USA (gratuito): ${esc(C.EMERGENCIA.usa)}<br>España (gratuito): ${esc(C.EMERGENCIA.espana)}<br>Resto del mundo: ${esc(C.EMERGENCIA.mundo)}<br>Correo: ${esc(C.EMERGENCIA.email)}
    </div>
    <div style="background:#fffbeb;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.6;margin-bottom:16px">
      &#9888;&#65039; <b>Importante:</b> ante cualquier emergencia médica, contacte primero a la Unidad de Asistencia del INS. Tenga a mano su pasaporte y número de póliza.
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;font-size:12px;color:#64748b;line-height:1.7">
      <b style="color:#0f172a">${esc(C.FIRMA.nombre)}</b><br>${esc(C.FIRMA.rol)}<br>${esc(C.FIRMA.licencia)}<br>${esc(C.FIRMA.tel)} &middot; ${esc(C.FIRMA.correo)} &middot; ${esc(C.FIRMA.web)}
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;
  }

  function abToB64(buf) {
    let bin = ''; const bytes = new Uint8Array(buf), chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function b64url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  async function buildAndSend(envio, attachments, token) {
    // attachments: [{ name, b64 }]
    const html = buildHtml(envio);
    const boundary = 'sdiv_' + Math.random().toString(36).slice(2);
    const to = envio.destinatarios.join(', ');
    const subject = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent('✈️ ¡Todo listo para el viaje!'))) + '?=';
    let mime = `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    mime += `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${html}\r\n`;
    for (const a of attachments) {
      mime += `--${boundary}\r\nContent-Type: application/pdf; name="${a.name}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.name}"\r\n\r\n${a.b64}\r\n`;
    }
    mime += `--${boundary}--`;
    const raw = b64url(mime);
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw })
    });
    if (!res.ok) throw new Error('Gmail API ' + res.status + ': ' + (await res.text()));
    return res.json();
  }

  async function fileToB64(file) { return abToB64(await file.arrayBuffer()); }
  async function pathToB64(path) { const r = await fetch(path); if (!r.ok) throw new Error('No se pudo cargar ' + path); return abToB64(await r.arrayBuffer()); }

  return { buildHtml, buildAndSend, fileToB64, pathToB64 };
})();
```

- [ ] **Step 2: Verificar el HTML (preview rápido)**

Run: en la consola del navegador en `/agente/`:
```js
document.write(VEmail.buildHtml({ saludo:'Jose Angel', destinatarios:['x@y.com'], viajeros:[{cliente:'CANGIANO ALMEYDA JOSE ANGEL',poliza:'0201VIA023182200',destino:'ESTADOS UNIDOS- ITALIA',vigenciaDesde:'24/07/2026',vigenciaHasta:'07/08/2026'}] }))
```
Expected: se renderiza el correo con encabezado navy, caja verde "¿Qué cubre?", el viajero con sus chips, botón de asistencia y firma.

- [ ] **Step 3: Commit**

```bash
git add agente/email.js
git commit -m "feat(agente): plantilla de correo navy + MIME + envio Gmail"
```

---

### Task 4: `wa.js` — plantillas editables + link WhatsApp

**Files:**
- Create: `agente/wa.js`

- [ ] **Step 1: Escribir `agente/wa.js`**

```javascript
// agente/wa.js
window.VWa = (function () {
  const KEY = 'viajero_wa_';
  const WA_DEF = {
    emitida: 'Listo {Nombre} 🌎 con mucho gusto le confirmo que ya enviamos a su correo toda la documentación de su *Seguro INS Viajero con Asistencia*. ✈️ *¡Su póliza está lista!*\n\nDesde nuestra oficina le preparamos una guía digital con los contactos de emergencia y la asistencia directa por WhatsApp (Wi-Fi Call) para cualquier imprevisto en el exterior. Guárdela en favoritos o agréguela a la pantalla de inicio de su celular:\n\n📲 https://appasistenciainsviajero.netlify.app/\n\nRecuerde que ante cualquier emergencia debe avisar *de inmediato* a la Unidad de Asistencia del INS antes de actuar por su cuenta. Le agradezco confirmarme el recibido. ¡Que tenga un excelente viaje! 🧳',
    directa: '¡Hola {Nombre}! 👋 Soy *Juan Carlos Hernández, su Agente del INS*. Felicidades por adquirir su *Seguro INS Viajero con Asistencia*. ✈️\n\nQuiero compartirle un recurso *exclusivo* que entregamos a los clientes de nuestra oficina: una guía digital con los números de emergencia gratuitos por país y el paso a paso de *qué hacer y a quién llamar* si necesita usar el seguro durante su viaje:\n\n📲 https://appasistenciainsviajero.netlify.app/\n\nLe recomiendo guardarla en favoritos o agregarla a la pantalla de inicio para tenerla siempre a mano. Cualquier consulta sobre su viaje, quedo a su disposición. ¡Buen viaje! 🌍'
  };
  function getTemplate(tipo) { return localStorage.getItem(KEY + tipo) || WA_DEF[tipo] || ''; }
  function saveTemplate(tipo, texto) { localStorage.setItem(KEY + tipo, texto); }
  function resetTemplate(tipo) { localStorage.removeItem(KEY + tipo); return WA_DEF[tipo]; }
  function buildLink(tel, texto, nombre) {
    const t = (texto || '').replace(/{Nombre}/g, nombre || '');
    const phone = (tel || '').replace(/[^\d]/g, '');
    return 'https://web.whatsapp.com/send/?phone=' + phone + '&text=' + encodeURIComponent(t);
  }
  return { getTemplate, saveTemplate, resetTemplate, buildLink, WA_DEF };
})();
```

- [ ] **Step 2: Verificar link**

Run: consola del navegador: `VWa.buildLink('506 8888 8888', VWa.getTemplate('emitida'), 'Jose Angel')`
Expected: una URL `https://web.whatsapp.com/send/?phone=50688888888&text=...` con el texto codificado y `Jose Angel` ya sustituido.

- [ ] **Step 3: Commit**

```bash
git add agente/wa.js
git commit -m "feat(agente): plantillas WhatsApp editables + link web.whatsapp"
```

---

### Task 5: `app.js` — UI de la consola (login, viajeros, envío)

**Files:**
- Create: `agente/app.js`

- [ ] **Step 1: Escribir `agente/app.js`**

```javascript
// agente/app.js
window.VApp = (function () {
  const state = { viajeros: [], destinatarios: [], saludo: '', canal: 'correo' };
  let nextId = 1;

  function el(id) { return document.getElementById(id); }
  function showConsole() { el('gate').classList.add('hidden'); el('console').classList.remove('hidden'); render(); }

  async function login() {
    el('gate-err').classList.add('hidden');
    try { const { email } = await VAuth.signIn(); el('who').textContent = email; showConsole(); }
    catch (e) { el('gate-err').textContent = e.message; el('gate-err').classList.remove('hidden'); }
  }

  function addViajero() { state.viajeros.push({ id: nextId++, cliente: '', nombrePila: '', poliza: '', cedula: '', destino: '', vigenciaDesde: '', vigenciaHasta: '', correo: '', files: [] }); syncEnvio(); render(); }
  function removeViajero(id) { state.viajeros = state.viajeros.filter(v => v.id !== id); syncEnvio(); render(); }

  function syncEnvio() {
    const first = state.viajeros[0];
    if (first && !state.saludo) state.saludo = first.nombrePila || '';
    const mails = state.viajeros.map(v => v.correo).filter(Boolean);
    if (mails.length && !state.destinatarios.length) state.destinatarios = [mails[0]];
  }

  async function onFiles(viajeroId, fileList) {
    const v = state.viajeros.find(x => x.id === viajeroId); if (!v) return;
    for (const f of fileList) {
      v.files.push(f);
      const text = await VParse.readPdfText(f).catch(() => '');
      const kind = VParse.classifyFile(f.name, text);
      if (kind === 'poliza') { Object.assign(v, VParse.extractAll(text)); }
    }
    syncEnvio(); render();
  }

  function field(v, key, label, mono) {
    return `<label style="display:block"><span style="font-size:11px;color:#94a3b8">${label}</span>
      <input data-vid="${v.id}" data-key="${key}" value="${(v[key]||'').replace(/"/g,'&quot;')}" class="w-full text-sm border rounded px-2 py-1 ${mono?'font-mono':''}"/></label>`;
  }

  function viajeroCard(v, idx) {
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between mb-3"><b class="text-sm">Viajero ${idx + 1}</b>
        <button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button></div>
      <div class="dropzone border-2 border-dashed rounded-lg p-4 text-center text-sm text-slate-500 mb-3" data-vid="${v.id}">Arrastrá aquí los PDF de este viajero</div>
      <div class="text-xs text-slate-400 mb-2">${v.files.map(f => VParse.classifyFile(f.name, '') + ': ' + f.name).join(' · ') || 'sin archivos'}</div>
      <div class="grid grid-cols-2 gap-2">
        ${field(v, 'cliente', 'Cliente')}${field(v, 'nombrePila', 'Saludo (nombre)')}
        ${field(v, 'poliza', 'N° Póliza', true)}${field(v, 'correo', 'Correo')}
        ${field(v, 'destino', 'Destino')}${field(v, 'vigenciaDesde', 'Desde')}
      </div></div>`;
  }

  function render() {
    el('console').innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Envío de pólizas</h2>
        <button onclick="VApp.addViajero()" class="bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg">➕ Agregar viajero</button>
      </div>
      ${state.viajeros.map(viajeroCard).join('') || '<p class="text-slate-500 text-sm mb-3">Agregá un viajero para empezar.</p>'}
      <div class="border rounded-xl p-4 bg-white mb-3">
        <label class="block mb-2"><span class="text-xs text-slate-400">Destinatarios (separados por coma)</span>
          <input id="dest" value="${state.destinatarios.join(', ')}" class="w-full text-sm border rounded px-2 py-1"/></label>
        <label class="block"><span class="text-xs text-slate-400">Saludo</span>
          <input id="saludo" value="${state.saludo.replace(/"/g,'&quot;')}" class="w-full text-sm border rounded px-2 py-1"/></label>
      </div>
      <div class="flex gap-2 mb-3">
        ${['correo','emitida','directa'].map(c => `<button onclick="VApp.setCanal('${c}')" class="flex-1 border rounded-lg py-2 text-sm ${state.canal===c?'border-blue-600 border-2 text-blue-700':''}">${c==='correo'?'Correo':c==='emitida'?'WhatsApp emitida':'WhatsApp directa'}</button>`).join('')}
      </div>
      <div id="canalbox"></div>
      <div class="flex gap-2 mt-3">
        <button onclick="VApp.preview()" class="border rounded-lg px-4 py-2 text-sm">Vista previa</button>
        <button onclick="VApp.enviar()" class="bg-blue-800 text-white rounded-lg px-4 py-2 text-sm flex-1" id="btn-enviar">Enviar</button>
      </div>
      <p id="status" class="text-sm mt-3"></p>`;
    wire(); renderCanal();
  }

  function wire() {
    el('console').querySelectorAll('input[data-vid]').forEach(inp => inp.addEventListener('input', e => {
      const v = state.viajeros.find(x => x.id == e.target.dataset.vid); if (v) v[e.target.dataset.key] = e.target.value;
    }));
    el('dest') && el('dest').addEventListener('input', e => state.destinatarios = e.target.value.split(',').map(s => s.trim()).filter(Boolean));
    el('saludo') && el('saludo').addEventListener('input', e => state.saludo = e.target.value);
    el('console').querySelectorAll('.dropzone').forEach(dz => {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('bg-blue-50'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('bg-blue-50'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('bg-blue-50'); onFiles(+dz.dataset.vid, e.dataTransfer.files); });
    });
  }

  function setCanal(c) { state.canal = c; render(); }
  function renderCanal() {
    if (state.canal === 'correo') { el('canalbox').innerHTML = `<p class="text-xs text-slate-500">Se enviará el correo con los adjuntos de cada viajero + Condiciones y Manual.</p>`; return; }
    const tipo = state.canal, txt = VWa.getTemplate(tipo);
    el('canalbox').innerHTML = `<div class="border rounded-xl p-3 bg-white">
      <label class="block mb-2"><span class="text-xs text-slate-400">Teléfono del cliente</span><input id="watel" placeholder="506 8888 8888" class="w-full text-sm border rounded px-2 py-1"/></label>
      <textarea id="watxt" rows="6" class="w-full text-sm border rounded px-2 py-1">${txt.replace(/</g,'&lt;')}</textarea>
      <div class="flex gap-2 mt-2"><button onclick="VApp.waSave()" class="text-xs border rounded px-2 py-1">Guardar como predeterminado</button>
      <button onclick="VApp.waReset()" class="text-xs border rounded px-2 py-1">Restaurar</button></div></div>`;
  }
  function waSave() { VWa.saveTemplate(state.canal, el('watxt').value); el('status').textContent = 'Plantilla guardada.'; }
  function waReset() { el('watxt').value = VWa.resetTemplate(state.canal); }

  function preview() {
    if (state.canal === 'correo') { const w = window.open('', '_blank'); w.document.write(VEmail.buildHtml(state)); }
    else { window.open(VWa.buildLink(el('watel').value, el('watxt').value, state.saludo), '_blank'); }
  }

  async function enviar() {
    const st = el('status'); st.textContent = '';
    if (state.canal !== 'correo') { return preview(); }
    if (!state.viajeros.length) { st.textContent = 'Agregá al menos un viajero.'; return; }
    if (!state.destinatarios.length) { st.textContent = 'Indicá al menos un destinatario.'; return; }
    el('btn-enviar').disabled = true; st.textContent = 'Preparando adjuntos…';
    try {
      const att = [];
      for (const v of state.viajeros) for (const f of v.files) att.push({ name: f.name, b64: await VEmail.fileToB64(f) });
      for (const d of VCfg.STANDARD_DOCS) att.push({ name: d.name, b64: await VEmail.pathToB64('' + d.path) });
      st.textContent = 'Enviando correo…';
      await VEmail.buildAndSend(state, att, VAuth.getToken());
      st.textContent = '✅ Correo enviado a ' + state.destinatarios.join(', ');
    } catch (e) { st.textContent = '❌ ' + e.message; }
    finally { el('btn-enviar').disabled = false; }
  }

  function boot() { try { VAuth.init(); } catch (e) {} el('btn-login').addEventListener('click', login); }
  return { boot, login, addViajero, removeViajero, setCanal, waSave, waReset, preview, enviar };
})();
document.addEventListener('DOMContentLoaded', () => VApp.boot());
```

- [ ] **Step 2: Smoke en navegador (sin enviar)**

Run: con Client ID real, abrir `/agente/`, login, "Agregar viajero", arrastrar el PDF de Cangiano.
Expected: los campos se autocompletan (póliza `0201VIA023182200`, destino, vigencia, correo). "Vista previa" abre el correo correcto. Cambiar a "WhatsApp emitida" muestra el textarea editable.

- [ ] **Step 3: Commit**

```bash
git add agente/app.js
git commit -m "feat(agente): UI de consola multi-viajero + envio"
```

---

### Task 6: Documentos estándar + cableado final del gate

**Files:**
- Create: `agente/assets/condiciones.pdf` (copiar el DERSA+CG local)
- Create: `agente/assets/manual.pdf` (copiar el INDEMNIZACIÓN PASO A PASO local)

- [ ] **Step 1: Copiar los 2 PDF estándar al repo**

```bash
mkdir -p "C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/agente/assets"
cp "C:/Users/segur/OneDrive/ARCHIVO DIGITAL/Viajeros Asistencia/C/Cangiano Almeyda Jose Angel/DERSA+CG Seguro INS Viajero con Asistencia Autoexpedible.pdf" "C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/agente/assets/condiciones.pdf"
cp "C:/Users/segur/OneDrive/ARCHIVO DIGITAL/Viajeros Asistencia/INDEMNIZACIÓN VIAJERO PASO A PASO.pdf" "C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/agente/assets/manual.pdf"
```

- [ ] **Step 2: Verificar que se sirven**

Run: abrir `http://localhost:8970/agente/assets/condiciones.pdf` y `.../manual.pdf`.
Expected: ambos PDF abren (Netlify y el server local los sirven como estáticos).

- [ ] **Step 3: Commit**

```bash
git add agente/assets/condiciones.pdf agente/assets/manual.pdf
git commit -m "feat(agente): adjuntos estandar (condiciones + manual)"
```

---

### Task 7: Smoke end-to-end + verificación de no-regresión

- [ ] **Step 1: Envío real de prueba a casilla propia**

Run: en `/agente/`, login, agregar 2 viajeros (Cangiano + uno manual), poner como destinatario tu propio correo, Enviar.
Expected: llega el correo con encabezado navy, ambos viajeros listados, y los adjuntos (póliza+tarjeta+comprobante de cada viajero + condiciones + manual de 6 MB). Verificar que el correo no excede el límite de Gmail (~25 MB); si lo excede, avisar y dejar el manual fuera para ese envío.

- [ ] **Step 2: WhatsApp**

Run: canal "WhatsApp emitida", teléfono propio, "Vista previa".
Expected: abre `web.whatsapp.com` con el texto y los emojis intactos, `{Nombre}` sustituido. Editar el texto + "Guardar como predeterminado" y recargar: el texto editado persiste.

- [ ] **Step 3: No-regresión de la app pública**

Run: abrir `http://localhost:8970/` (la app del cliente).
Expected: idéntica a antes, sin errores. `git status` no muestra cambios en `index.html` de la raíz.

- [ ] **Step 4: Self-test del parser sigue verde**

Run: abrir `/agente/selftest.html`.
Expected: `11/11 OK`.

- [ ] **Step 5: Commit final / tag**

```bash
git add -A && git commit -m "chore(agente): smoke e2e consola de envios viajero v1"
```

---

## Notas de despliegue

- **Push:** NO empujar a `main` hasta que JC lo autorice (deploy auto a Netlify). El `/agente/` queda público en el dominio, por eso la whitelist OAuth es la barrera real.
- **OAuth:** agregar el origen de Netlify (`https://appasistenciainsviajero.netlify.app`) a "Authorized JavaScript origins" del Client ID en Google Cloud Console, o el login fallará en producción.
- **Pendiente fase 2:** registro/estadísticas de envíos (localStorage), detección de teléfono.
