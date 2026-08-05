// agente/wa.js — plantillas WhatsApp editables (localStorage) + link web.whatsapp.com.
window.VWa = (function () {
  const KEY = 'viajero_wa_';
  const WA_DEF = {
    emitida: 'Listo {Nombre} ✈️ con mucho gusto le confirmo que ya enviamos a su correo toda la documentación de su *Seguro INS Viajero con Asistencia*. ✅ *¡Su póliza está lista!*\n\n📄 *Póliza N° {Poliza}*\n\nDesde nuestra oficina le preparamos una guía digital con los contactos de emergencia y la asistencia directa por WhatsApp (Wi-Fi Call) para cualquier imprevisto en el exterior. Guárdela en favoritos o agréguela a la pantalla de inicio de su celular:\n\n📲 {Link}\n\nRecuerde que ante cualquier emergencia debe avisar *de inmediato* a la Unidad de Asistencia del INS antes de actuar por su cuenta. Le agradezco confirmarme el recibido. ¡Que tenga un excelente viaje! 🧳',
    directa: '¡Hola {Nombre}! 👋 Soy *{Agente}, su Agente del INS*. Felicidades por adquirir su *Seguro INS Viajero con Asistencia*. ✅\n\n📄 *Póliza N° {Poliza}*\n\nQuiero compartirle un recurso *exclusivo* que entregamos a los clientes de nuestra oficina: una guía digital con los números de emergencia gratuitos por país y el paso a paso de *qué hacer y a quién llamar* si necesita usar el seguro durante su viaje:\n\n📲 {Link}\n\nLe recomiendo guardarla en favoritos o agregarla a la pantalla de inicio para tenerla siempre a mano. Cualquier consulta sobre su viaje, quedo a su disposición. ¡Buen viaje! ✈️'
  };
  function getTemplate(tipo) { return localStorage.getItem(KEY + tipo) || WA_DEF[tipo] || ''; }
  function saveTemplate(tipo, texto) { localStorage.setItem(KEY + tipo, texto); }
  function resetTemplate(tipo) { localStorage.removeItem(KEY + tipo); return WA_DEF[tipo]; }
  // El número de póliza es opcional: en "WhatsApp directa" el cliente compró por
  // su cuenta y el agente puede no tenerlo. Si no hay número, se cae la LÍNEA
  // entera del comodín para no mandar un "Póliza N°" a medias.
  function conPoliza(texto, poliza) {
    const p = String(poliza == null ? '' : poliza).trim();
    if (p) return texto.split('{Poliza}').join(p);
    return texto.split('\n').filter(l => l.indexOf('{Poliza}') === -1)
      .join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  }

  function buildLink(tel, texto, nombre, agente, poliza) {
    // Link de la app personalizado con la identidad del agente activo.
    const link = (window.VAgent ? VAgent.publicLink() : (VCfg.APP_LINK || ''));
    const base = String(VCfg.APP_LINK || '').replace(/[?#].*$/, '');
    const PH = String.fromCharCode(0); // placeholder imposible de escribir en la plantilla
    let t = conPoliza(texto || '', poliza)
      .replace(/{Nombre}/g, nombre || '')
      .replace(/{Agente}/g, agente || '');
    // La URL cruda de plantillas viejas guardadas en localStorage también se
    // personaliza; el placeholder evita re-sustituir lo ya sustituido.
    t = t.split('{Link}').join(PH);
    if (base) t = t.split(base).join(PH);
    t = t.split(PH).join(link);
    const phone = (tel || '').replace(/[^\d]/g, '');
    return 'https://web.whatsapp.com/send/?phone=' + phone + '&text=' + encodeURIComponent(t);
  }
  return { getTemplate, saveTemplate, resetTemplate, buildLink, conPoliza, WA_DEF };
})();
