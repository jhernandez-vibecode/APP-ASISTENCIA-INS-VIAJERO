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

La consola enlaza a la página pública para reclamos/contactos → "economía de código" (no se duplica esa info). Fue pedido expreso de JC: reusar la sección de reclamos de la pública en vez de duplicarla en la consola.

## Fuente oficial de los datos (REGLA 🔴)

Todo dato del producto que aparezca en la app (coberturas, exclusiones, montos, contactos, plazos) debe poder rastrearse a **`C:/Users/segur/Viajero Asistencia/_INFO-OFICIAL-VERIFICADA.md`**, junto con los 6 PDF oficiales del INS en esa misma carpeta (Condiciones Generales · Kit Cliente · Manual · Montos asegurados · Publi · Tarifas). Producto: **Seguro INS Viajero con Asistencia Autoexpedible, registro SUGESE `P19-57-A01-972 V5`**. Si un dato no está ahí, NO se escribe en la app.

## Estado actual

- **EN PROD:** [appasistenciainsviajero.netlify.app](https://appasistenciainsviajero.netlify.app) (público) + [/agente/](https://appasistenciainsviajero.netlify.app/agente/) (consola).
- **Repo:** [jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO](https://github.com/jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO). Local: `C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO`.
- **Consola `/agente/` (23 jun 2026, commits `2bc66bc` + `61a38b9`):** PDF→correo Gmail multi-viajero + 2 WhatsApp editables. Verificada (parser self-test 12/12).
- **Cross-sell público "Comprá/Recomendá":** live desde 3 jun 2026.
- **Personalización multi-agente COMPLETA (1 jul 2026, commits `732be18` + `c9693b9`):** el link de la app dentro del correo (botón "Abrir mi guía de emergencias") y de las plantillas WhatsApp (comodín `{Link}`) ahora usa `VAgent.publicLink()` → el cliente abre la pública con la identidad de SU agente. Además: campo `cotizaLink` en el perfil (CTA "Comprar de nuevo" con el código de intermediario de CADA agente, fallback al de JC) y cross-sell público personalizado (`salesUrl()`: `sales` precargado > web del agente `?aw=` > SDI). Verificado en preview (JC default, agente autoservicio y plantilla legacy). Para dar acceso a la consola a otro agente solo falta agregar su Gmail a `WHITELIST` en `config.js`. Icono "Regla de oro" = estrella dorada (antes alert-triangle). Banner ámbar de exclusividad SIN la coletilla "no es un recurso estándar del INS" (quitada 1 jul por decisión de JC: lo importante es que sepan que es del agente).
- **FIX permiso de envío Gmail (27 jul 2026, último commit del repo):** un agente reportó `Gmail API 403 … ACCESS_TOKEN_SCOPE_INSUFFICIENT` al presionar Enviar. Causa: entró con Google sin marcar la casilla *"Enviar correo electrónico en tu nombre"* y `prompt:''` nunca se la volvió a mostrar (ver "Gotcha del consentimiento granular" abajo). Fix en `auth.js` + `app.js`: (1) `grantedSend()` verifica el scope realmente concedido en la respuesta del token; (2) si falta, `signIn()` reintenta solo con `prompt:'consent'`; (3) `VAuth.canSend()` + `grantSend()` nuevos en la API; (4) banner ámbar en la consola con botón "Conceder permiso de envío" (el login NO se bloquea: los canales de WhatsApp siguen sirviendo); (5) `enviar()` pide el permiso ANTES de preparar los adjuntos, montado sobre el clic del agente para que el navegador no bloquee la ventana emergente; (6) el 403 en el envío ahora reconsiente y reintenta (antes solo se atrapaba el 401); (7) el volcado JSON crudo de Google se traduce a un mensaje en español. Verificado en preview con los 3 caminos: sin permiso (0 llamadas a Gmail, banner reaparece), 403 con reconsentimiento (reintenta y envía) y camino feliz (1 envío, sin popups extra).
- **FIX 🔴 se perdían la tarjeta y el comprobante (3 ago 2026):** JC reportó que el correo llegaba solo con la póliza + condiciones generales + manual; la **tarjeta de asistencia nunca se adjuntaba**. Causa raíz: `onFiles()` recorría con `for…of` la **`FileList` viva** del navegador y hacía `await VParse.readPdfText(f)` DENTRO del ciclo; el handler del input ejecuta `fi.value = ''` apenas ese primer `await` cede el control, lo que **vacía la FileList en pleno recorrido** → el ciclo moría después del PRIMER archivo. Reproducido en el navegador: de 3 archivos elegidos quedaba **1** (`["poliza.pdf"]`). El mismo riesgo tenía el arrastre (`e.dataTransfer.files` se neutraliza al terminar el evento). Fix en `app.js`: `Array.from(fileList)` **sincrónico antes de cualquier `await`**. Además: (1) la clasificación detectada se recuerda en `f.vKind` (ahí sí hay texto del PDF); (2) chips por archivo con contador visible "N archivos que se van a adjuntar" + botón × para quitar uno (antes la pérdida era silenciosa); (3) el `accept` admite imágenes y se saltea el parseo de PDF si el archivo no es PDF; (4) `email.js` rotula cada adjunto con su **tipo MIME real** (antes todo iba como `application/pdf`, lo que rompería una tarjeta en JPG) y codifica el nombre con RFC 2047/2231 si trae acentos; (5) la lista "Documentos adjuntos" del correo se arma con lo que REALMENTE se cargó, para no prometer una tarjeta que no viaja. Verificado en preview: 3/3 archivos, 12/12 selftest, cabeceras MIME inspeccionadas.
- **FIX cross-sell por agente (2 jul 2026, commit `9d4020c`):** el cross-sell de la pública ("Cotizar mi próximo viaje" / "Compartí el seguro") le filtraba a otros agentes el link de compra de JC. Doble causa: (1) el `cotizaLink` del agente NO viajaba en el link público; (2) `getAgent()` copiaba el objeto base de JC y los campos ausentes en el link quedaban con el valor de JC. Fix: parámetro nuevo `ac` en `publicLink()` + `getAgent()` sin herencia + `appUrl()` preserva `ac` + footer web oculto si el agente no tiene web (ver detalle en "Página pública").

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
│   ├── config.js           # window.VCfg (Client ID, whitelist, links, docs, AGENT_DEFAULT + AGENTES)
│   ├── parse.js            # window.VParse (extracción PDF + clasificación)
│   ├── auth.js             # window.VAuth (login GIS + whitelist + token Gmail)
│   ├── agent.js            # window.VAgent (perfil de agente personalizable + link público)
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

Inicio · Contactos de Emergencia · Reclamos y Reembolsos · Guía Wi-Fi Call · Coberturas y Exclusiones · Vigencia y Prórroga · **Comprá / Recomendá** (cross-sell ámbar). Branding INS + Licencia 08-1318 + pie SDI. WhatsApp Universal Assistance: `wa.me/5491167502557` (link al bot de asistencia, se mantiene; es la excepción a la regla "nunca wa.me" — no lleva texto con emojis).

**Pestaña Comprá / Recomendá (agregada 3 jun 2026):** CTA "Cotizar mi próximo viaje" → `https://www.segurosdelins.com/seguros-de-viaje` (o el link del agente, ver `salesUrl()` abajo) + "recomendar a un amigo", que comparte la página de ventas O la app por tres vías: WhatsApp `api.whatsapp.com/send?text=` (sin teléfono, solo texto), Web Share API y copiar link. La URL de "compartir esta app" se arma en caliente con `window.location.origin + window.location.pathname` → auto-detecta el dominio real, no hay dominio hardcodeado.

**Agente personalizable (link por agente):** la info del agente (nombre, licencia, web, copyright, banner de exclusividad, texto de recomendación, título de la pestaña) NO está hardcodeada — se marca con `data-ag="nombre|licencia|web-link|sales-link"` y `applyAgent()` la sustituye al cargar. Registro `AGENTES` (default `jc`, con `sales` = página de ventas) + `getAgent()` lee `?a=<id>` (precargado) o los parámetros de autoservicio (`?an` nombre `/&ar` rol `/&al` licencia `/&aw` web `/&ac` link de compra). **REGLA anti-fuga (2 jul 2026):** si el link trae CUALQUIER parámetro de autoservicio, `getAgent()` construye la identidad SOLO desde el link y NO hereda NADA del base JC — un campo ausente queda vacío, nunca con el dato de JC (antes se copiaba `Object.assign({}, base)` y los campos no sobreescritos filtraban la web/licencia/link de JC). Cross-sell: `salesUrl()` = `a.sales` (param `ac` = link de compra/cotización del agente con SU código de intermediario; o `sales` precargado de JC) > web del agente > `segurosdelins.com/seguros-de-viaje` literal (NO var — `applyAgent()` corre antes de esa sección). El footer "Visítenos en…" se oculta si el agente no trae web propia (no muestra la de JC). `appUrl()` preserva `a/an/ar/al/aw/ac`. Los WhatsApp de Universal Assistance NO son del agente y se dejan fijos.

**Guarda del `publicLink()` (agent.js):** al generar el link, un campo que quedó EXACTAMENTE igual al `AGENT_DEFAULT` (JC) NO viaja (`if (p.x && p.x !== D.x)`). Motivo: la consola prefija el perfil del agente nuevo con los datos de JC (incluido `cotizaLink` con el código 1101130); si el agente cambia su nombre pero olvida cambiar el link de cotización, sin esta guarda difundiría el código de JC bajo su propio nombre. Con la guarda, ese campo simplemente no viaja → el cross-sell cae a la web del agente o al genérico, nunca al código de JC. **Onboarding:** cada agente DEBE llenar su "Link de cotización INS" con su propio código; si lo deja en el default de JC, su cross-sell no venderá con su código.

**Gotcha Lucide (aplica a TODAS las single-file de JC que usan Lucide):** `lucide.createIcons()` convierte `<i data-lucide>` en `<svg>` cuyo `className` es objeto (SVGAnimatedString), NO texto → `icon.className.replace(...)` truena. Usar `classList.add/remove/toggle` para recolorar. Era un bug pre-existente en `switchTab`, corregido el 3 jun 2026.

## Consola `/agente/` — arquitectura

Módulos como globales `window.*` cargados en orden por `agente/index.html`. Contrato:

```
VParse.extractAll(text) -> { cliente, nombrePila, poliza, cedula, destino, gastosMedicos, vigenciaDesde, vigenciaHasta, correo }
VParse.classifyFile(filename, text) -> 'poliza' | 'tarjeta' | 'comprobante' | 'otro'
VParse.readPdfText(file) -> Promise<string>     // import dinámico de pdf.js 4.4.168
VAuth.init() ; VAuth.signIn() -> Promise<{email, token}> ; VAuth.ensureToken() ; VAuth.getToken()
VEmail.buildHtml(envio) ; VEmail.buildAndSend(envio, attachments, token) ; VEmail.fileToB64 ; VEmail.pathToB64
VWa.getTemplate(tipo) ; VWa.saveTemplate(tipo, txt) ; VWa.resetTemplate(tipo) ; VWa.buildLink(tel, txt, nombre, agente)
VAgent.get() -> perfil activo ; VAgent.save(p) ; VAgent.reset() ; VAgent.publicLink(p) -> string
VApp.state = { viajeros:[Viajero], destinatarios:[string], saludo, canal }
Viajero = { cliente, nombrePila, poliza, cedula, destino, gastosMedicos, vigenciaDesde, vigenciaHasta, correo, files:File[] }
```

### config.js (window.VCfg)
- `GOOGLE_CLIENT_ID`: `255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com` (mismo de los cotizadores, público por diseño).
- `GMAIL_SCOPE`: `gmail.send openid email profile`. `WHITELIST` (3 correos, comparación case-insensitive): `jhernandez@segurosdelins.com`, `tramites@segurosdelins.com`, `chernandez@seguros-ins.com` (dominio `seguros-ins.com` CORRECTO — confirmado por JC 1 jul: ese agente tiene su propio dominio, NO es typo).
- `APP_LINK`: la pública. `COTIZA_LINK`: `https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130` (form INS, código intermediario 1101130).
- `STANDARD_DOCS`: condiciones.pdf + manual.pdf (auto-adjuntos). `EMERGENCIA`: contactos oficiales (`insinternacional@grupoins.com`, NO `ins-cr.com`).
- `AGENT_DEFAULT`: perfil del agente por defecto (JC) con campos discretos `{ id, nombre, rol, licencia, codigo, tel, whatsapp, correo, web, cotizaLink }`. Reemplaza al viejo `FIRMA`. `AGENTES`: registro de agentes precargados por `id` para el link público `?a=<id>` (por ahora solo `jc`). `cotizaLink` = form INS con el código de intermediario del agente (CTA "Comprar de nuevo" del correo; fallback `COTIZA_LINK` de JC).

### agente/agent.js (window.VAgent) — personalización del agente
- `get()` → perfil activo (localStorage `viajero_agente`, default = `VCfg.AGENT_DEFAULT`). `save(p)` (auto-genera `id`/slug si falta). `reset()` → vuelve a JC. `publicLink(p)` → arma el link que el agente envía a sus clientes.
- Lo usan: el correo (firma en `email.js`), la plantilla WhatsApp `directa` (token `{Agente}`) y el botón "Copiar link para clientes" de la consola.
- **Autoservicio:** un agente NO precargado no necesita editar código — su identidad viaja en el link como parámetros (`?an=`nombre `&ar=`rol `&al=`licencia `&aw=`web). Si está en `VCfg.AGENTES`, el link es corto (`?a=<id>`).

### parse.js
Lee la capa de texto del PDF. Anclas: póliza `\d{4}VIA\d{9}` · cliente tras "Nombre o Razón Social:" hasta "Tipo de" · cédula tras "Número de Identificación:" · destino tras "Destino (s) del Viaje:" hasta "Motivo" · gastos médicos tras "Gastos Médicos y Adicionales:" → formateado `US$1.000.000` · vigencia "Desde:/Hasta:" · correo tras "Correo Principal:" (el primero que NO sea @segurosdelins.com). `nombrePila` = tokens después de los 2 apellidos (CR). Todo editable; si algo falla queda vacío (nunca inventar). Verificar con `agente/selftest.html`.

### email.js — plantilla del correo (solo texto + color, SIN imágenes)
La **firma** se arma desde el agente activo (`VAgent.get()`), no hardcodeada. Encabezado navy `linear-gradient(135deg,#0b2545,#13477e,#1c6fb8)` "Seguro INS Viajero" (SIN avión) → saludo → confirmación → **Viajeros amparados** (fila por viajero: nombre + chips póliza[14px bold]/destino/vigencia + "Gastos médicos contratados: US$X") → botón verde "Centro de asistencia" al link personalizado del agente activo (`VAgent.publicLink(A)`, fallback `APP_LINK`) ("…para tenerla siempre a mano como una App") → adjuntos → contactos emergencia → aviso → firma texto → **CTA sutil "Comprar de nuevo un Seguro INS Viajero"** al `cotizaLink` del agente activo (fallback `COTIZA_LINK`). Envío: Gmail API `users.messages.send`, MIME `multipart/mixed`, base64url, remitente = cuenta logueada. Adjuntos: por viajero (póliza+tarjeta+comprobante) + condiciones+manual UNA vez.

### wa.js — 2 plantillas WhatsApp (editables)
`emitida` (póliza que emití yo) y `directa` (compra externa). Editables en la consola; "guardar como predeterminado" → `localStorage` clave `viajero_wa_<tipo>` (carga lo guardado, no el `WA_DEF`). Link SIEMPRE `https://web.whatsapp.com/send/?phone=...&text=...` — **NUNCA `wa.me`** (corrompe emojis). `{Nombre}` (cliente), `{Agente}` (nombre del agente activo) y `{Link}` (link personalizado `VAgent.publicLink()`) se sustituyen al generar el link; las plantillas viejas guardadas en localStorage con la URL cruda también se personalizan (la URL base se reemplaza por el link del agente vía placeholder `String.fromCharCode(0)` — NUNCA escribir el carácter NUL crudo en el fuente: git trata el archivo como binario). El teléfono lo escribe JC (no viene en la póliza).

### app.js — UI
Login gate → **panel colapsable "⚙️ Mi información de agente"** (campos del perfil + Guardar/Restaurar + "Tu link para clientes" con Copiar/Ver) → **stepper "1 Cargar el PDF · 2 Revisión · 3 Enviar"** (se recalcula en cada `render()`; paso 1 ✓ al haber datos, paso 3 activo al haber destinatario, los 3 ✓ tras enviar) → lista de viajeros con "➕ Agregar viajero". Cada viajero: **drop zone que sirve para arrastrar O hacer clic** (input file oculto `multiple accept=pdf`) → clasifica y autocompleta. Datos del envío: destinatarios (default = correo del 1er viajero) + saludo (default = nombrePila del 1er viajero), editables. Canales: Correo / WhatsApp emitida / WhatsApp directa. Vista previa + Enviar.

**🔴 Gotcha FileList viva (aplica a CUALQUIER app de JC que cargue archivos):** `input.files` y `e.dataTransfer.files` NO son arrays ni copias — son colecciones vivas. Si se las recorre con `for…of` y hay un `await` dentro del ciclo, cualquier cosa que las vacíe mientras tanto (`input.value = ''`, el fin del evento `drop`) **corta el recorrido en silencio** y solo sobrevive el primer archivo. Regla: **`Array.from(fileList)` como primera línea, antes de esperar nada.** Este fue el bug del 3 ago 2026 (se perdían tarjeta y comprobante). Revisar el mismo patrón en los cotizadores que suben PDF.

**Hardening de sesión:** al enviar, `VAuth.ensureToken()` renueva el token si tiene >50 min; si Gmail responde 401 (sesión vencida), reconecta en silencio (`signIn()`) y reintenta el envío una vez. El encabezado de la consola usa degradado navy `linear-gradient(135deg,#0b2545,#13477e,#1c6fb8)` (igual al del correo).

## Multi-viajero
Un solo correo lista a TODOS los viajeros y adjunta los documentos de cada uno + condiciones/manual una sola vez. Cada viajero puede tener distinta opción → distinto monto de gastos médicos (se muestra por viajero).

## Flujo de trabajo (cómo hacer cambios)

1. Editar en `C:/Users/segur/APP-ASISTENCIA-INS-VIAJERO/`.
2. Verificar local: preview `asistencia-viajero` puerto 8960 (`.claude/launch.json`). Self-test del parser: `/agente/selftest.html`.
3. `git add` + `commit` + `push origin main` cuando JC autorice → Netlify auto-deploya.
4. **Sincronizar SKILL.md en las 3 ubicaciones** (ver abajo).

## Pre-requisito OAuth (producción)

**Gotcha del consentimiento granular de Google (27 jul 2026, causa del 403 "insufficient authentication scopes"):** Google presenta los permisos sensibles como **casillas que el usuario puede dejar SIN marcar**. Si un agente no marca *"Enviar correo electrónico en tu nombre"*, el login sale bien igual (entra a la consola, la whitelist lo acepta) pero el token NO trae `gmail.send` y Gmail responde **403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT`** al enviar. Peor: `requestAccessToken({ prompt: '' })` reusa lo ya concedido y **nunca vuelve a preguntar**, así que el agente quedaba trabado para siempre. `enable_granular_consent:false` NO sirve — Google hizo obligatorias las casillas para todas las apps. La única salida es verificar el scope concedido y volver a pedirlo con `prompt:'consent'`. Ya implementado (ver abajo); si el mismo síntoma aparece en otro proyecto con Gmail API (cotizadores), el patrón es el mismo.

Para que el login funcione, el origen del sitio (`https://appasistenciainsviajero.netlify.app`) y, para pruebas, `http://localhost:8960`, deben estar en **"Orígenes de JavaScript autorizados"** del Client ID en Google Cloud Console. Sin eso, el login falla aunque el correo esté en la whitelist. JC confirmó (23 jun 2026) que el origen de Netlify ya está agregado. Si algún día se estrena subdominio propio, hay que agregar ESE origen también.

## Sincronización del SKILL.md (REGLA 🔴)

Este SKILL nació el 23 jun 2026 (commit `14b44fb`) y cubre las DOS caras: la pública del cliente y la consola `/agente/`. Al actualizarlo, sincronizar en las 3 ubicaciones:

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
