---
name: especialista-asistencia-viajero
description: ESPECIALISTA APP ASISTENCIA VIAJERO INS — App de asistencia post-venta para clientes del Seguro INS Viajero con Asistencia Autoexpedible (registro SUGESE P19-57-A01-972 V5), marca Seguros Digitales SDI. Stack HTML + Tailwind CDN + Lucide, single-file vanilla (NO React, sin build, sin npm). Dos caras en el MISMO repo/sitio: (1) `index.html` pública = portal del cliente (contactos de emergencia, paso a paso de reclamos, Wi-Fi Call, coberturas, vigencia/prórroga, cross-sell Comprá/Recomendá); (2) `/agente/` privada = consola del agente (login Google + whitelist) que arrastra o carga el PDF de la póliza, extrae datos con pdf.js, arma y envía el correo al cliente por Gmail API (multi-viajero, encabezado navy solo-texto, monto de gastos médicos por viajero, CTA "Comprar de nuevo" al form INS) y genera 2 plantillas de WhatsApp editables vía web.whatsapp.com/send. EN PROD appasistenciainsviajero.netlify.app (auto-deploy desde main). Repo jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO. Usar este skill cuando JC pida cualquier cambio, bug o mejora a la app de asistencia viajero, ya sea la página del cliente o la consola del agente.
---

# Especialista App Asistencia Viajero INS

Contexto completo del proyecto para retomar trabajo sin perder contexto. Leer COMPLETO antes de tocar código.

## Qué es

App de **asistencia post-venta** para clientes que YA compraron el Seguro INS Viajero con Asistencia. Hermana "viajero" de [especialista-asistencia-autos], pero **vanilla JS** (no React). Tiene **dos caras en el mismo repo/sitio/dominio**:

1. **`/` (index.html) — PÚBLICA, del cliente.** El agente la comparte por correo/WhatsApp. El cliente ve contactos de emergencia, paso a paso de reclamos, guía Wi-Fi Call, coberturas/exclusiones, vigencia/prórroga y cross-sell. No configura nada.
2. **`/agente/` — PRIVADA, del agente (JC).** Consola con login Google + whitelist para preparar y enviar la documentación de pólizas ya emitidas. El cliente NUNCA la ve.

La consola enlaza a la página pública para reclamos/contactos → "economía de código" (no se duplica esa info).

## Estado actual

- **EN PROD:** [appasistenciainsviajero.netlify.app](https://appasistenciainsviajero.netlify.app) (público) + [/agente/](https://appasistenciainsviajero.netlify.app/agente/) (consola).
- **Repo:** [jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO](https://github.com/jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO). Local: `C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO`.
- **Consola `/agente/` (23 jun 2026, commits `2bc66bc` + `61a38b9`):** PDF→correo Gmail multi-viajero + 2 WhatsApp editables. Verificada (parser self-test 12/12).
- **Cross-sell público "Comprá/Recomendá":** live desde 3 jun 2026.

## Stack técnico

- **Frontend:** HTML + Tailwind CDN + Lucide CDN. Single-file en la pública; scripts clásicos (no ES modules) con globales `window.*` en la consola. **Sin build, sin npm.**
- **PDF:** `pdf.js` 4.4.168 (import dinámico desde cdnjs) en la consola.
- **Envío correo:** Google Identity Services (GIS) + Gmail API `gmail.send`. Mismo Client ID que los cotizadores.
- **Hosting:** Netlify, auto-deploy desde `main` (1-2 min). Sin backend, sin DB.

## Estructura del repo

```
APP-ASISTENCIA-INS-VIAJERO/
├── index.html              # App PÚBLICA del cliente (single-file, ~900 líneas)
├── INS BLANCO.png          # Logo INS header
├── favicon.ico             # Favicon de viaje (sirve para / y /agente/)
├── SKILL.md                # Este archivo
├── agente/                 # CONSOLA PRIVADA del agente
│   ├── index.html          # Markup + CDNs + includes
│   ├── config.js           # window.VCfg (Client ID, whitelist, links, docs, firma)
│   ├── parse.js            # window.VParse (extracción PDF + clasificación)
│   ├── auth.js             # window.VAuth (login GIS + whitelist + token Gmail)
│   ├── email.js            # window.VEmail (HTML navy + MIME + envío Gmail)
│   ├── wa.js               # window.VWa (plantillas WhatsApp editables + link)
│   ├── app.js              # window.VApp (UI: viajeros, canales, preview, enviar)
│   ├── selftest.html       # Asserts de VParse contra PDF de muestra (12/12)
│   └── assets/
│       ├── condiciones.pdf # DERSA+CG estándar (auto-adjunto)
│       └── manual.pdf      # Indemnización paso a paso 6MB (auto-adjunto)
└── docs/superpowers/       # spec + plan de la consola
```

## Página pública (index.html) — pestañas

Inicio · Contactos de Emergencia · Reclamos y Reembolsos · Guía Wi-Fi Call · Coberturas y Exclusiones · Vigencia y Prórroga · **Comprá / Recomendá** (cross-sell ámbar). Branding INS + Licencia 08-1318 + pie SDI. WhatsApp Universal Assistance: `wa.me/5491167502557` (link al bot de asistencia, se mantiene). Cross-sell a `segurosdelins.com/seguros-de-viaje`.

**Gotcha Lucide:** `lucide.createIcons()` convierte `<i data-lucide>` en `<svg>` cuyo `className` es objeto (SVGAnimatedString) → usar `classList.add/remove/toggle` para recolorar, nunca `.className.replace`.

## Consola `/agente/` — arquitectura

Módulos como globales `window.*` cargados en orden por `agente/index.html`. Contrato:

```
VParse.extractAll(text) -> { cliente, nombrePila, poliza, cedula, destino, gastosMedicos, vigenciaDesde, vigenciaHasta, correo }
VParse.classifyFile(filename, text) -> 'poliza' | 'tarjeta' | 'comprobante' | 'otro'
VParse.readPdfText(file) -> Promise<string>     // import dinámico de pdf.js 4.4.168
VAuth.init() ; VAuth.signIn() -> Promise<{email, token}> ; VAuth.getToken()
VEmail.buildHtml(envio) ; VEmail.buildAndSend(envio, attachments, token) ; VEmail.fileToB64 ; VEmail.pathToB64
VWa.getTemplate(tipo) ; VWa.saveTemplate(tipo, txt) ; VWa.resetTemplate(tipo) ; VWa.buildLink(tel, txt, nombre)
VApp.state = { viajeros:[Viajero], destinatarios:[string], saludo, canal }
Viajero = { cliente, nombrePila, poliza, cedula, destino, gastosMedicos, vigenciaDesde, vigenciaHasta, correo, files:File[] }
```

### config.js (window.VCfg)
- `GOOGLE_CLIENT_ID`: `255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com` (mismo de los cotizadores, público por diseño).
- `GMAIL_SCOPE`: `gmail.send openid email profile`. `WHITELIST`: `['jhernandez@segurosdelins.com']`.
- `APP_LINK`: la pública. `COTIZA_LINK`: `https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130` (form INS, código intermediario 1101130).
- `STANDARD_DOCS`: condiciones.pdf + manual.pdf (auto-adjuntos). `EMERGENCIA`: contactos oficiales (`insinternacional@grupoins.com`, NO `ins-cr.com`). `FIRMA`.

### parse.js
Lee la capa de texto del PDF. Anclas: póliza `\d{4}VIA\d{9}` · cliente tras "Nombre o Razón Social:" hasta "Tipo de" · cédula tras "Número de Identificación:" · destino tras "Destino (s) del Viaje:" hasta "Motivo" · gastos médicos tras "Gastos Médicos y Adicionales:" → formateado `US$1.000.000` · vigencia "Desde:/Hasta:" · correo tras "Correo Principal:" (el primero que NO sea @segurosdelins.com). `nombrePila` = tokens después de los 2 apellidos (CR). Todo editable; si algo falla queda vacío (nunca inventar). Verificar con `agente/selftest.html`.

### email.js — plantilla del correo (solo texto + color, SIN imágenes)
Encabezado navy `linear-gradient(135deg,#0b2545,#13477e,#1c6fb8)` "Seguro INS Viajero" (SIN avión) → saludo → confirmación → **Viajeros amparados** (fila por viajero: nombre + chips póliza[14px bold]/destino/vigencia + "Gastos médicos contratados: US$X") → botón verde "Centro de asistencia" a `APP_LINK` ("…para tenerla siempre a mano como una App") → adjuntos → contactos emergencia → aviso → firma texto → **CTA sutil "Comprar de nuevo un Seguro INS Viajero"** a `COTIZA_LINK`. Envío: Gmail API `users.messages.send`, MIME `multipart/mixed`, base64url, remitente = cuenta logueada. Adjuntos: por viajero (póliza+tarjeta+comprobante) + condiciones+manual UNA vez.

### wa.js — 2 plantillas WhatsApp (editables)
`emitida` (póliza que emití yo) y `directa` (compra externa). Editables en la consola; "guardar como predeterminado" → `localStorage` clave `viajero_wa_<tipo>` (carga lo guardado, no el `WA_DEF`). Link SIEMPRE `https://web.whatsapp.com/send/?phone=...&text=...` — **NUNCA `wa.me`** (corrompe emojis). `{Nombre}` se sustituye al generar el link. El teléfono lo escribe JC (no viene en la póliza).

### app.js — UI
Login gate → lista de viajeros con "➕ Agregar viajero". Cada viajero: **drop zone que sirve para arrastrar O hacer clic** (input file oculto `multiple accept=pdf`) → clasifica y autocompleta. Datos del envío: destinatarios (default = correo del 1er viajero) + saludo (default = nombrePila del 1er viajero), editables. Canales: Correo / WhatsApp emitida / WhatsApp directa. Vista previa + Enviar.

## Multi-viajero
Un solo correo lista a TODOS los viajeros y adjunta los documentos de cada uno + condiciones/manual una sola vez. Cada viajero puede tener distinta opción → distinto monto de gastos médicos (se muestra por viajero).

## Flujo de trabajo (cómo hacer cambios)

1. Editar en `C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/`.
2. Verificar local: preview `asistencia-viajero` puerto 8960 (`.claude/launch.json`). Self-test del parser: `/agente/selftest.html`.
3. `git add` + `commit` + `push origin main` cuando JC autorice → Netlify auto-deploya.
4. **Sincronizar SKILL.md en las 3 ubicaciones** (ver abajo).

## Pre-requisito OAuth (producción)
Para que el login funcione, el origen del sitio (`https://appasistenciainsviajero.netlify.app`) y, para pruebas, `http://localhost:8960`, deben estar en **"Orígenes de JavaScript autorizados"** del Client ID en Google Cloud Console. Sin eso, el login falla aunque el correo esté en la whitelist.

## Sincronización del SKILL.md (REGLA 🔴)

Al actualizar este SKILL.md, sincronizar en las 3 ubicaciones:

1. **Repo (GitHub):** `C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/SKILL.md`
2. **Skill instalado (Claude Code):** `C:/Users/segur/.claude/skills/especialista-asistencia-viajero/SKILL.md`
3. **Backup en Downloads:** `C:/Users/segur/Downloads/SKILL_APP_ASISTENCIA_VIAJERO.md`

```bash
cp C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/SKILL.md \
   C:/Users/segur/.claude/skills/especialista-asistencia-viajero/SKILL.md && \
cp C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/SKILL.md \
   C:/Users/segur/Downloads/SKILL_APP_ASISTENCIA_VIAJERO.md
```

## Pendiente / Fase 2
- Registro/estadísticas de envíos (localStorage) en la consola, con seguimiento — como los cotizadores.
- Subdominio propio tipo `asistencia-viajero.appsegurosdigitales.com` (opcional).

## Reglas de trabajo con Juan Carlos (JC)
- JC NO programa. Necesita cambios completos y/o ya pusheados.
- Pushear a main directo cuando JC autorice ("listo", "ok", "push", "actualiza github").
- Mockups previos = archivo separado / widget, sin tocar el código en producción.
- Verificación obligatoria antes de marcar completo (self-test del parser y/o preview).
- Correos HTML: SIEMPRE solo texto + color (degradados CSS y emojis OK), nunca `<img>`/SVG/base64 — Gmail los bloquea.
