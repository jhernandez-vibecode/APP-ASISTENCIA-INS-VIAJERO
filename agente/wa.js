// agente/wa.js — plantillas WhatsApp editables (localStorage) + link web.whatsapp.com.
window.VWa = (function () {
  const KEY = 'viajero_wa_';
  const WA_DEF = {
    emitida: 'Listo {Nombre}, con mucho gusto le confirmo que ya enviamos a su correo toda la documentación de su *Seguro INS Viajero con Asistencia*. ✈️ *¡Su póliza está lista!* ✅\n\n{Asegurados}\n\nDesde nuestra oficina le preparamos una guía digital con los contactos de emergencia y la asistencia directa por WhatsApp (Wi-Fi Call) para cualquier imprevisto en el exterior. Guárdela en favoritos o agréguela a la pantalla de inicio de su celular:\n\n📲 {Link}\n\nRecuerde que ante cualquier emergencia debe avisar *de inmediato* a la Unidad de Asistencia del INS antes de actuar por su cuenta. Le agradezco confirmarme el recibido. ¡Que tenga un excelente viaje! 🧳',
    // «Guía de asistencia» (9 nov 2026): para el cliente que compró en línea. JC
    // pidió poner adelante el compromiso de la oficina y que la app es un
    // beneficio EXCLUSIVO de sus clientes. {Poliza} es opcional: sin número la
    // línea entera se cae (conPoliza).
    directa: '¡Hola {Nombre}! 👋 Gracias por elegir el *Seguro INS Viajero con Asistencia*. ✅\n\n📄 *Póliza N° {Poliza}*\n\nEn la oficina de {Agente}, agente del INS, estamos comprometidos con la tranquilidad de nuestros asegurados. Por eso diseñamos una app de asistencia, un *beneficio exclusivo para los clientes de nuestra oficina*, para que tenga a mano toda la información que necesita si debe usar su seguro durante el viaje:\n\n✅ Qué hacer y a quién llamar en cada caso\n✅ Los teléfonos de emergencia por país\n✅ La asistencia por WhatsApp (Wi-Fi Call)\n✅ El paso a paso de cada trámite\n\n📲 {Link}\n\nGuárdela en favoritos o agréguela a la pantalla de inicio de su celular: funciona aun sin internet.\n\nRecuerde: ante cualquier emergencia, avise *primero* a la Unidad de Asistencia del INS, antes de pagar o actuar por su cuenta.\n\nQuedo a su disposición. ¡Buen viaje! ✈️',
    // «Solicitud de emisión» (9 nov 2026): reemplaza al Google Form. {Link} es el
    // de la solicitud con el código del agente, no el de la guía.
    solicitud: 'Hola {Nombre}, con gusto le ayudo con su *Seguro INS Viajero con Asistencia*. ✈️\n\nPara emitirlo, complete esta solicitud. Toma pocos minutos, y si viajan varias personas las puede agregar en el mismo formulario:\n\n📝 {Link}\n\nLe recomiendo enviarla *al menos 24 horas antes* de su viaje. En cuanto la reciba le confirmo por aquí y le indico cómo hacer el pago.\n\n{Agente}\nAgente INS · Lic. SUGESE {Licencia}'
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

  // Bloque "de quién es cada póliza". El nombre va TAL COMO viene de la póliza
  // del INS (mayúscula, apellidos primero): es el texto que el cliente reconoce
  // de su documento y no hay riesgo de acomodar mal un apellido compuesto.
  function bloqueAsegurados(lista) {
    const items = (lista || [])
      .map(a => ({ poliza: String(a && a.poliza || '').trim(), nombre: String(a && a.nombre || '').trim() }))
      .filter(a => a.poliza || a.nombre);
    if (!items.length) return '';
    const par = a => [a.poliza ? '*' + a.poliza + '*' : '', a.nombre].filter(Boolean).join('\n');
    if (items.length === 1) {
      const a = items[0];
      return [a.poliza ? '📄 *Póliza N° ' + a.poliza + '*' : '', a.nombre].filter(Boolean).join('\n');
    }
    return '📄 *Pólizas emitidas*\n\n' + items.map(par).join('\n\n');
  }
  // Igual que conPoliza(): sin datos se cae la LÍNEA del comodín, no queda un
  // encabezado suelto. El comodín va solo en su línea (el bloque es multilínea).
  function conAsegurados(texto, lista) {
    const bloque = bloqueAsegurados(lista);
    if (bloque) return texto.split('{Asegurados}').join(bloque);
    return texto.split('\n').filter(l => l.indexOf('{Asegurados}') === -1)
      .join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  }

  // El texto final del mensaje con todos los comodines resueltos. Lo usan las
  // pantallas «Solicitud de emisión» y «Guía de asistencia» (vista previa y
  // link). linkOverride = el enlace de {Link} cuando no es la guía.
  function fillText(texto, nombre, agente, poliza, asegurados, linkOverride) {
    const A = window.VAgent ? VAgent.get() : (VCfg.AGENT_DEFAULT || {});
    const link = linkOverride || (window.VAgent ? VAgent.publicLink() : (VCfg.APP_LINK || ''));
    const base = String(VCfg.APP_LINK || '').replace(/[?#].*$/, '');
    const PH = String.fromCharCode(0); // placeholder imposible de escribir
    let t = conPoliza(conAsegurados(texto || '', asegurados), poliza)
      .replace(/{Nombre}/g, nombre || '')
      .replace(/{Agente}/g, agente || '')
      .replace(/{Licencia}/g, A.licencia || '')
      .replace(/{WhatsApp}/g, A.tel || A.whatsapp || '');
    t = t.split('{Link}').join(PH);
    if (base && !linkOverride) t = t.split(base).join(PH);
    return t.split(PH).join(link);
  }
  // Mismo armado de buildLink, para un texto ya resuelto.
  function buildLinkTexto(tel, texto) {
    let phone = (tel || '').replace(/[^\d]/g, '');
    if (phone.length === 8) phone = '506' + phone;
    return 'https://web.whatsapp.com/send/?phone=' + phone + '&text=' + encodeURIComponent(texto);
  }

  function buildLink(tel, texto, nombre, agente, poliza, asegurados) {
    // Link de la app personalizado con la identidad del agente activo.
    const link = (window.VAgent ? VAgent.publicLink() : (VCfg.APP_LINK || ''));
    const base = String(VCfg.APP_LINK || '').replace(/[?#].*$/, '');
    const PH = String.fromCharCode(0); // placeholder imposible de escribir en la plantilla
    // {Asegurados} primero (bloque nuevo) y {Poliza} después: el comodín viejo
    // sigue vivo para las plantillas ya guardadas en localStorage por cualquier
    // agente, que solo llevan los números.
    let t = conPoliza(conAsegurados(texto || '', asegurados), poliza)
      .replace(/{Nombre}/g, nombre || '')
      .replace(/{Agente}/g, agente || '');
    // La URL cruda de plantillas viejas guardadas en localStorage también se
    // personaliza; el placeholder evita re-sustituir lo ya sustituido.
    t = t.split('{Link}').join(PH);
    if (base) t = t.split(base).join(PH);
    t = t.split(PH).join(link);
    // 🔴 WhatsApp necesita el número con código de país. Un número tico son 8
    // dígitos: si vienen exactamente 8, se le antepone el 506. Cualquier otra
    // cantidad se respeta tal cual (ya trae código, o es de otro país).
    let phone = (tel || '').replace(/[^\d]/g, '');
    if (phone.length === 8) phone = '506' + phone;
    return 'https://web.whatsapp.com/send/?phone=' + phone + '&text=' + encodeURIComponent(t);
  }
  return { getTemplate, saveTemplate, resetTemplate, buildLink, fillText, buildLinkTexto, conPoliza, conAsegurados, bloqueAsegurados, WA_DEF };
})();
