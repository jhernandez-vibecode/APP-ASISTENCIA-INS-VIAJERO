# Consola de Envíos · Seguro INS Viajero con Asistencia — Diseño

**Fecha:** 2026-06-23
**Autor:** Juan Carlos Hernández Vargas (Seguros Digitales SDI) + Claude
**Repo:** `jhernandez-vibecode/APP-ASISTENCIA-INS-VIAJERO`
**Estado:** Aprobado el diseño · pendiente plan de implementación

---

## 1. Objetivo

Agregar a la app existente una **consola privada para el agente** que permita:

1. Arrastrar los PDF de una póliza de Viajero ya emitida y **extraer los datos clave** automáticamente.
2. **Soportar varios viajeros en un mismo envío** (familia/grupo), cada uno con sus documentos.
3. Generar y **enviar el correo al cliente** (réplica de la plantilla "¡Todo listo para el viaje!") por Gmail API, con los adjuntos.
4. Generar **2 mensajes de WhatsApp** (póliza emitida / compra directa) con el link de la app.

El cliente solo recibe la plantilla + el link a la app pública (sección de reclamos/contactos que ya existe). Esa reutilización es la "economía de código".

## 2. Decisiones tomadas (con JC)

| # | Decisión | Elección |
|---|----------|----------|
| 1 | Arquitectura | Página `/agente/` aparte, mismo repo y sitio. La `index.html` pública NO se toca. |
| 2 | Adjuntos | App auto-adjunta los 2 estándar (Condiciones + Manual) desde el repo; JC arrastra los del cliente (póliza, tarjeta, comprobante). El Manual de 6 MB SÍ se adjunta. |
| 3 | Estilo del correo | Solo texto + color (CSS), sin imágenes. Encabezado con degradado navy + emoji. |
| 4 | Encabezado | **Opción A — Navy corporativo** (degradado azul, misma familia visual que el correo de Hogar Comprensivo). |
| 5 | Multi-viajero | La consola es una lista de viajeros; un solo correo los lista a todos. |
| 6 | Alcance v1 | Solo enviar (correo + 2 WhatsApp). Registro/estadísticas → fase 2. |
| 7 | Plantillas WhatsApp | Editables en la consola, con "guardar como predeterminado" en `localStorage`. |

## 3. Arquitectura

- **Un solo repo, un solo sitio Netlify, un solo deploy.** Se agrega la carpeta `agente/` con su `index.html`.
  - `/` → app pública del cliente (sin cambios).
  - `/agente/` → consola privada del agente.
- **Stack:** HTML + Tailwind CDN + Lucide (igual que la app pública), más:
  - `pdf.js` (CDN, pin de versión) para leer la capa de texto de los PDF.
  - Google Identity Services (GIS) + Gmail API (`gmail.send`) para enviar el correo. Mismo Client ID OAuth que los cotizadores (Autos / Vital 360 / INS Medical).
- **Login:** la consola exige iniciar sesión con Google y valida contra una **whitelist** (mínimo `jhernandez@segurosdelins.com`). Sin login no se ve nada operable.
- **Sin secretos en el código.** Solo el Client ID OAuth (público por diseño). Nada de API keys ni tokens hardcodeados; fail-closed si falta config.
- **Documentos estándar** (`Condiciones generales DERSA+CG.pdf`, `Manual de Indemnización paso a paso.pdf`) se guardan en `agente/assets/` y se adjuntan vía `fetch` → base64.

## 4. Modelo de datos (en memoria, no se persiste en v1)

```
Envio {
  destinatarios: string[]        // correos; default = correo del 1er viajero (editable)
  saludo: string                 // default = nombre de pila del 1er viajero (editable)
  viajeros: Viajero[]
  adjuntosEstandar: bool         // default true (Condiciones + Manual)
}

Viajero {
  cliente: string                // "CANGIANO ALMEYDA JOSE ANGEL"
  nombrePila: string             // editable; sugerido de cliente
  poliza: string                 // "0201VIA023182200"
  cedula: string
  destino: string                // "ESTADOS UNIDOS - ITALIA"
  gastosMedicos: string          // "US$1.000.000" (Gastos Médicos y Adicionales contratado)
  vigenciaDesde: string          // "24/07/2026"
  vigenciaHasta: string          // "07/08/2026"
  correo: string                 // correo del cliente extraído
  archivos: File[]               // póliza + tarjeta + comprobante de ESTE viajero
}
```

## 5. Flujo de la consola (UI)

1. **Login Google** (gate).
2. **Lista de viajeros.** Botón "➕ Agregar viajero". Cada viajero es una tarjeta con:
   - Zona para **arrastrar o hacer clic y cargar** sus PDF (input de archivo oculto, `multiple`, `accept=pdf`). La app identifica por contenido cuál es la póliza (Oferta-Constancia), cuál la tarjeta y cuál el comprobante.
   - Al detectar la póliza, **autocompleta** los campos (todos editables).
   - Badge por archivo: "datos extraídos" / "se adjunta".
3. **Datos del envío:** destinatarios (chips, editable) + saludo (editable).
4. **Canal de envío:** Correo + adjuntos · WhatsApp (emitida) · WhatsApp (compra directa).
5. **Vista previa** (modal con el correo o el texto de WhatsApp) y **Enviar**.
6. **Confirmación** de envío (éxito/error claro). Persistir/registrar NO aplica en v1.

## 6. Extracción de datos del PDF

`pdf.js` `getTextContent()` por página → texto concatenado. Reglas (tolerantes a espacios/saltos):

| Campo | Ancla / patrón |
|-------|----------------|
| N° Póliza | `\b\d{4}VIA\d{9}\b` (o tras "N° Póliza:") |
| Cliente | tras "Nombre o Razón Social:" hasta fin de línea |
| Cédula | tras "Número de Identificación:" → dígitos |
| Destino(s) | tras "Destino (s) del Viaje:" hasta "Motivo" |
| Gastos médicos | tras "Gastos Médicos y Adicionales:" → `$1 000 000` formateado a `US$1.000.000` |
| Vigencia | tras "Desde:" y "Hasta:" → `dd/mm/aaaa` |
| Correo cliente | tras "Correo Principal:" → primer email que NO sea `@segurosdelins.com` |

Notas:
- Nombre de pila sugerido = tokens después de los 2 primeros apellidos (formato CR). Siempre editable porque es ambiguo.
- Identificación de archivos: la póliza contiene "Oferta- Constancia"; tarjeta/comprobante por patrón de nombre (`_Tarjeta_`, `Comprobante`) y/o por tamaño/contenido.
- Si una extracción falla, el campo queda vacío y editable (nunca inventar).

## 7. Plantilla de correo (solo texto + color)

Réplica de "✈️ ¡Todo listo para el viaje!" generada con los datos detectados. Estructura:

1. **Encabezado (Opción A):** banda `linear-gradient(135deg,#0b2545,#13477e,#1c6fb8)`, texto blanco "✈️ Seguro INS Viajero" + subtítulo "Su viaje, protegido en todo el mundo · INS".
2. **Saludo:** "Estimado(a) {saludo}, 👋".
3. **Confirmación:** "Le confirmo que su Seguro INS Viajero con Asistencia ya está activo y listo…".
4. **Viajeros amparados:** una fila por viajero con nombre + chips (N° Póliza · destino · vigencia) + el **monto de Gastos Médicos y Adicionales contratado** por ese cliente (extraído de la póliza; varía según la opción, p.ej. US$1.000.000).
5. _(Decisión JC 23 jun: se eliminó la caja "¿Qué cubre su seguro?"; en su lugar se muestra solo el monto de gastos médicos contratado por viajero.)_
6. **Centro de asistencia 24/7:** botón-enlace a `https://appasistenciainsviajero.netlify.app/` + instrucción "añadir a pantalla de inicio".
7. **Documentos adjuntos:** lista con check.
8. **Contactos de emergencia (oficiales verificados):** USA 1 844 865 0804 · España 900 995 484 · Resto del mundo +34 (91) 189-5152 · `insinternacional@grupoins.com`. (Usar `grupoins.com`, NO `ins-cr.com` que era un typo del correo viejo.)
9. **Aviso importante:** contactar primero a la Unidad de Asistencia.
10. **Firma (texto):** Juan Carlos Hernández Vargas · Agente de Seguros Exclusivo · INS · Licencia Sugese 08-1318 · Código 110113 · 506 8822-1348 · jhernandez@segurosdelins.com · www.segurosdelins.com.
11. **CTA sutil al final:** botón discreto "Cotizar un nuevo Seguro INS Viajero" → `VCfg.COTIZA_LINK` (form de cotización INS con código de intermediario 1101130). El N° de póliza se muestra en letra más grande (14px, bold).

**Envío:** Gmail API `users.messages.send`, MIME `multipart/mixed`, cuerpo `text/html`, adjuntos en base64url. Remitente = la cuenta logueada (queda en Enviados).

**Adjuntos del correo:** por cada viajero sus archivos (póliza, tarjeta, comprobante) + 1 vez los 2 estándar (Condiciones + Manual).

## 8. Plantillas de WhatsApp

Endpoint **`https://web.whatsapp.com/send/?phone={tel}&text={texto}`** (NUNCA `wa.me`, corrompe emojis). El teléfono lo escribe JC (no viene en la póliza). `{Nombre}` = saludo.

**Editables:** cada plantilla se muestra en un `textarea` editable antes de enviar. El texto por defecto vive en el código (`WA_DEF`), pero si JC pulsa "guardar como predeterminado" el texto editado se persiste en `localStorage` y el editor lo carga de ahí en adelante (mismo patrón que el editor de WhatsApp de SASINS: el editor carga lo guardado, no el `WA_DEF`). `{Nombre}` se sustituye al generar el enlace, no al editar.

**1 · Póliza emitida por mí:**
> Listo {Nombre} 🌎 con mucho gusto le confirmo que ya enviamos a su correo toda la documentación de su *Seguro INS Viajero con Asistencia*. ✈️ *¡Su póliza está lista!* Desde nuestra oficina le preparamos una guía digital con los contactos de emergencia y la asistencia directa por WhatsApp (Wi‑Fi Call) para cualquier imprevisto en el exterior. Guárdela en favoritos o agréguela a la pantalla de inicio de su celular: 📲 https://appasistenciainsviajero.netlify.app/ Recuerde que ante cualquier emergencia debe avisar *de inmediato* a la Unidad de Asistencia del INS antes de actuar por su cuenta. Le agradezco confirmarme el recibido. ¡Que tenga un excelente viaje! 🧳

**2 · Compra directa:**
> ¡Hola {Nombre}! 👋 Soy *Juan Carlos Hernández, su Agente del INS*. Felicidades por adquirir su *Seguro INS Viajero con Asistencia*. ✈️ Quiero compartirle un recurso *exclusivo* que entregamos a los clientes de nuestra oficina: una guía digital con los números de emergencia gratuitos por país y el paso a paso de *qué hacer y a quién llamar* si necesita usar el seguro durante su viaje: 📲 https://appasistenciainsviajero.netlify.app/ Le recomiendo guardarla en favoritos o agregarla a la pantalla de inicio para tenerla siempre a mano. Cualquier consulta sobre su viaje, quedo a su disposición. ¡Buen viaje! 🌍

## 9. Seguridad

- OAuth Google + whitelist de correos. Nada operable sin sesión válida.
- Sin secretos en el repo (solo Client ID público). Fail-closed.
- Escapar/sanitizar todo dato extraído antes de meterlo en el HTML del correo (evitar inyección desde un PDF manipulado).

## 10. Fuera de alcance v1

- Registro/estadísticas de envíos (historial, seguimiento) → fase 2.
- Detección automática del teléfono del cliente (no está en la póliza).
- Cambios a la app pública del cliente (queda intacta salvo, si acaso, confirmar que el link/feature de "añadir a inicio" funciona).

## 11. Criterios de aceptación (smoke test)

- Arrastrar el PDF de Cangiano → autocompleta cliente, póliza `0201VIA023182200`, destino, vigencia `24/07→07/08/2026`, correo `jose.cangiano@gmail.com`.
- Agregar un 2.º viajero y ver ambos en la vista previa del correo.
- Enviar correo de prueba a una casilla propia → llega con encabezado navy, cuerpo completo y todos los adjuntos (incluido el Manual de 6 MB) + las 2 condiciones estándar una sola vez.
- Botón WhatsApp (cada plantilla) abre `web.whatsapp.com/send` con el texto y emojis correctos.
- Abrir `/` (app pública) en paralelo → sin cambios ni regresiones.
