// agente/email.js — HTML del correo (encabezado navy) + MIME multipart + envío Gmail.
window.VEmail = (function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function filaViajero(v) {
    const chips = [
      v.poliza && `<span style="font-family:monospace;background:#e6f1fb;color:#0c447c;padding:3px 10px;border-radius:6px;font-size:14px;font-weight:700">${esc(v.poliza)}</span>`,
      v.destino && `<span style="background:#eef2f7;color:#475569;padding:2px 8px;border-radius:6px;font-size:12px">${esc(v.destino)}</span>`,
      (v.vigenciaDesde && v.vigenciaHasta) && `<span style="background:#eef2f7;color:#475569;padding:2px 8px;border-radius:6px;font-size:12px">${esc(v.vigenciaDesde)} &rarr; ${esc(v.vigenciaHasta)}</span>`
    ].filter(Boolean).join(' ');
    const med = v.gastosMedicos ? `<div style="margin-top:8px;font-size:13px;color:#0f6e56;font-weight:600">&#127973; Gastos médicos contratados: ${esc(v.gastosMedicos)}</div>` : '';
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
      <div style="font-weight:600;font-size:14px;color:#0f172a">${esc(v.cliente)}</div>
      <div style="margin-top:6px;line-height:2">${chips}</div>${med}</td></tr>`;
  }

  function buildHtml(envio) {
    const C = VCfg;
    const A = (window.VAgent ? VAgent.get() : C.AGENT_DEFAULT);
    // Link de la guía personalizado con la identidad del agente activo, para que
    // el cliente abra la app pública con el nombre/licencia de SU agente.
    const guiaLink = (window.VAgent ? VAgent.publicLink(A) : C.APP_LINK);
    // CTA "Comprar de nuevo": link de cotización INS del agente (con SU código
    // de intermediario); fallback al de JC si el perfil no lo tiene.
    const cotizaLink = A.cotizaLink || C.COTIZA_LINK;
    const lineaLicencia = ['Licencia Sugese ' + (A.licencia || ''), A.codigo ? 'Código ' + A.codigo : '']
      .filter(s => s && s !== 'Licencia Sugese ').join(' · ');
    const lineaContacto = [A.tel, A.correo, A.web].filter(Boolean).join(' &middot; ');
    const viajeros = (envio.viajeros || []).map(filaViajero).join('');
    return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:18px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#13477e;background:linear-gradient(135deg,#0b2545 0%,#13477e 55%,#1c6fb8 100%);padding:20px 22px">
    <div style="font-size:20px;font-weight:700;color:#ffffff">Seguro INS Viajero</div>
    <div style="font-size:13px;color:#b5d4f4;margin-top:3px">Su viaje, protegido en todo el mundo &middot; INS</div>
  </td></tr>
  <tr><td style="padding:18px 22px">
    <p style="font-size:14px;margin:0 0 10px">Estimado(a) ${esc(envio.saludo)}, &#128075;</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 16px">Es un gusto saludarle. Le confirmo que su Seguro INS Viajero con Asistencia ya está activo y listo para proteger a los viajeros en esta aventura.</p>
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px">Viajeros amparados</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px">${viajeros}</table>
    <div style="background:#ecfdf5;border-radius:8px;padding:14px;text-align:center;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#0f6e56;margin-bottom:8px">Centro de asistencia 24/7</div>
      <a href="${esc(guiaLink)}" style="display:inline-block;background:#0f6e56;color:#e1f5ee;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px">&#128241; Abrir mi guía de emergencias</a>
      <div style="font-size:12px;color:#64748b;margin-top:8px">Ábrala en el celular y elija "Añadir a pantalla de inicio" para tenerla siempre a mano como una App.</div>
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
      <b style="color:#0f172a">${esc(A.nombre)}</b><br>${esc(A.rol)}<br>${esc(lineaLicencia)}<br>${lineaContacto}
    </div>
    <div style="margin-top:14px;background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:12px;color:#64748b;margin-bottom:8px">¿Planeando su próximo viaje?</div>
      <a href="${esc(cotizaLink)}" style="display:inline-block;font-size:13px;color:#13477e;text-decoration:none;border:1px solid #c7d2e0;border-radius:8px;padding:8px 16px">&#9992;&#65039; Comprar de nuevo un Seguro INS Viajero</a>
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
    const html = buildHtml(envio);
    const boundary = 'sdiv_' + Math.random().toString(36).slice(2);
    const to = (envio.destinatarios || []).join(', ');
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
