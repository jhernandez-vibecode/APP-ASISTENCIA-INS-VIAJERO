// agente/email.js — HTML del correo (marca SDI) + MIME multipart + envío Gmail.
//
// La imagen del correo es la MISMA de las cotizaciones de autos (25 ago 2026):
//   - Encabezado navy PLANO con el logo del INS. Nada de degradados: Outlook
//     no los dibuja y el correo se veía distinto según el programa.
//   - Filete de marca 60/25/10/5 bajo el encabezado.
//   - Los datos del viaje en bloques sobrios: rótulo en versalitas sobre una
//     regla de 1 px. Sin barras de color a la izquierda (el tic de plantilla
//     automática que JC pidió sacar) y sin emojis.
//   - Pie navy con el logotipo SDI full color. Va como IMAGEN y no dibujado
//     con texto: su tipografía está vectorizada en el kit y en correo las
//     fuentes web no cargan, así que hecho con texto saldría en Arial.
window.VEmail = (function () {
  const SDI_COLORES = ['#0369A1', '#0D9488', '#EA580C', '#C9A227'];
  const SDI_NAVY   = '#0c2340';
  const SDI_VERDE  = '#047857';   // 5,48:1 con letra blanca
  const SDI_GRIS   = '#64748b';
  const SDI_LINEA  = '#e2e8f0';
  const FF   = "'Space Grotesk','Poppins',Arial,Helvetica,sans-serif";
  const FTXT = "'Inter',Arial,Helvetica,sans-serif";

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /** Filete de marca: cuatro celdas de color 60/25/10/5. No es un degradado a propósito. */
  function filete() {
    const p = [60, 25, 10, 5];
    return '<tr><td style="padding:0;font-size:0;line-height:0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" ' +
      'style="border-collapse:collapse;table-layout:fixed;"><tr>' +
      SDI_COLORES.map(function (c, i) {
        return '<td bgcolor="' + c + '" width="' + p[i] + '%" height="4" style="background:' + c +
          ';width:' + p[i] + '%;height:4px;line-height:4px;font-size:0;">&nbsp;</td>';
      }).join('') +
      '</tr></table></td></tr>';
  }

  /** Rótulo en versalitas: el mismo de las cotizaciones de autos. */
  function rotulo(t) {
    return '<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:' + SDI_GRIS +
      ';letter-spacing:0.1em;text-transform:uppercase;">' + t + '</p>';
  }

  /** Bloque sobrio: rótulo sobre una regla de 1 px. Reemplaza a las cajas de color. */
  function bloque(rot, contenido, padTop) {
    return '<tr><td style="padding:' + (padTop == null ? 20 : padTop) + 'px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + SDI_LINEA + ';">' +
      '<tr><td style="padding:13px 0 0;">' + rotulo(rot) + contenido + '</td></tr></table></td></tr>';
  }

  /**
   * El número de póliza dibujado como el sello que es: banda arriba y el número
   * abajo. Es el equivalente de la placa del cliente en el correo de autos.
   * 🔴 El ancho de la caja lo manda el NÚMERO, no la banda: si el rótulo de la
   * banda crece más que el número de abajo, la caja se estira y deja de leerse
   * como un sello. Con 8,5 px y 17 caracteres queda holgado.
   */
  function chapaPoliza(poliza) {
    if (!poliza) return '';
    return '<td align="right" valign="middle" style="padding:0 0 0 14px;">' +
      '<table cellpadding="0" cellspacing="0" border="0" style="border:2px solid ' + SDI_NAVY + ';border-radius:5px;background:#ffffff;">' +
        '<tr><td bgcolor="' + SDI_NAVY + '" style="background:' + SDI_NAVY + ';padding:3px 10px;text-align:center;">' +
          '<span style="font-family:' + FF + ';font-size:8.5px;font-weight:700;color:#ffffff;letter-spacing:0.16em;">N&Uacute;MERO P&Oacute;LIZA INS</span></td></tr>' +
        '<tr><td style="padding:5px 12px 6px;text-align:center;white-space:nowrap;">' +
          '<span style="font-family:' + FF + ';font-size:15px;font-weight:700;color:' + SDI_NAVY +
          ';letter-spacing:0.05em;white-space:nowrap;">' + esc(poliza) + '</span></td></tr>' +
      '</table></td>';
  }

  /** Una celda del renglón de datos del viaje. */
  function dato(rot, valor, ancho, alinear, grande) {
    return '<td width="' + ancho + '%" align="' + alinear + '" valign="top" style="padding:0 0 16px;">' +
      rotulo(rot) +
      '<p style="margin:0;font-family:' + (grande ? FF : FTXT) + ';font-size:' + (grande ? '16px' : '13.5px') +
      ';font-weight:' + (grande ? '700' : '500') + ';color:' + (grande ? '#0c4a6e' : '#334155') +
      ';line-height:1.4;">' + valor + '</p></td>';
  }

  /**
   * Tarjeta del viajero: quién viaja, con su póliza al lado, y debajo los datos
   * del viaje. Las celdas que el PDF no trajo NO se dibujan: no se rellenan con
   * un guion ni con un dato inventado.
   */
  function tarjetaViajero(v, i, total) {
    const orden = total > 1
      ? rotulo('Viajero ' + (i + 1) + ' de ' + total)
      : rotulo('Viajero amparado');
    const celdas = [];
    if (v.destino) celdas.push({ rot: 'Destino', val: esc(v.destino) });
    if (v.vigenciaDesde && v.vigenciaHasta) {
      celdas.push({ rot: 'Vigencia', val: esc(v.vigenciaDesde) + ' &rarr; ' + esc(v.vigenciaHasta) });
    }
    if (v.gastosMedicos) {
      celdas.push({ rot: 'Gastos m&eacute;dicos', val: esc(v.gastosMedicos), grande: true });
    }

    const anchos = ({ 1: [100], 2: [55, 45], 3: [36, 34, 30] })[celdas.length] || [];
    const renglon = celdas.length
      ? '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        celdas.map(function (c, k) {
          const alinear = (k === celdas.length - 1 && celdas.length > 1) ? 'right' : 'left';
          return dato(c.rot, c.val, anchos[k], alinear, c.grande);
        }).join('') +
        '</tr></table>'
      : '';

    return '<table width="100%" cellpadding="0" cellspacing="0" border="0" ' +
      'style="border-bottom:1px solid ' + SDI_LINEA + ';">' +
      '<tr><td style="padding:14px 0 10px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          '<td valign="middle">' + orden +
            '<p style="margin:2px 0 0;font-family:' + FF + ';font-size:18px;font-weight:700;color:' + SDI_NAVY +
            ';line-height:1.25;">' + esc(v.cliente || 'Viajero') + '</p></td>' +
          chapaPoliza(v.poliza) +
        '</tr></table>' +
      '</td></tr>' +
      (renglon ? '<tr><td>' + renglon + '</td></tr>' : '') +
      '</table>';
  }

  // Lista de "Documentos adjuntos" armada con lo que el agente REALMENTE cargó,
  // para no prometer una tarjeta o un comprobante que no viaja en el correo.
  function listaAdjuntos(envio) {
    const kinds = new Set();
    (envio.viajeros || []).forEach(v => (v.files || []).forEach(f => {
      kinds.add(f.vKind || (window.VParse ? VParse.classifyFile(f.name, '') : 'otro'));
    }));
    const items = [];
    if (kinds.has('poliza') && kinds.has('tarjeta')) items.push('P&oacute;liza y tarjeta de asistencia de cada viajero');
    else if (kinds.has('poliza')) items.push('P&oacute;liza de cada viajero');
    else if (kinds.has('tarjeta')) items.push('Tarjeta de asistencia de cada viajero');
    if (kinds.has('comprobante')) items.push('Comprobante de pago');
    items.push('Condiciones generales y Manual de reembolsos');
    return items.map(function (t) {
      return '<span style="color:' + SDI_COLORES[0] + ';font-weight:700;">&#8226;</span>&nbsp;&nbsp;' + t;
    }).join('<br>');
  }

  // ----- Beneficio Sala VIP (Circular INS 0388-2026) -----
  // Tres llaves, las tres tienen que estar abiertas: el interruptor maestro de
  // config.js, la fecha (fuera del período se apaga SOLO, nadie tiene que
  // acordarse el 1 nov) y el toggle del envío en el paso 3 (envio.salaVip).

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** ¿El beneficio existe hoy? `hoy` es inyectable solo para el selftest. */
  function salaVipEnFecha(hoy) {
    const cfg = VCfg.SALA_VIP;
    if (!cfg || !cfg.activo) return false;
    const h = hoy || hoyISO();
    return h >= cfg.desde && h <= cfg.hasta;
  }
  /** Los viajeros cuya prima llega al mínimo. Se mide UNO POR UNO: cada viajero
   *  tiene su póliza y su prima; nunca se promedia ni se suma. */
  function salaVipCalifican(viajeros) {
    const cfg = VCfg.SALA_VIP || {};
    const min = Number(cfg.primaMinima) || 0;
    const vs = viajeros || [];
    if (min === 0) return vs.slice();
    if (!window.VParse) return [];
    return vs.filter(v => VParse.parsePrimaUsd(v.prima) >= min);
  }

  // '2026-08-24' -> partes SIN new Date(iso): un string ISO se parsea como UTC
  // y en Costa Rica (UTC-6) retrocedería un día.
  const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaLarga(iso) {
    const p = String(iso || '').split('-');
    return { d: parseInt(p[2], 10), mes: MESES_LARGOS[parseInt(p[1], 10) - 1] || '', a: p[0] };
  }
  function periodoSalaVip(cfg) {
    const a = fechaLarga(cfg.desde), b = fechaLarga(cfg.hasta);
    const desde = a.d + ' de ' + a.mes + (a.a !== b.a ? ' de ' + a.a : '');
    return 'del ' + desde + ' al ' + b.d + ' de ' + b.mes + ' de ' + b.a;
  }
  function unirNombres(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }

  /**
   * La tarjeta del beneficio. Va entre los datos del viaje y el centro de
   * asistencia: es un beneficio de la póliza y el cliente tiene que VERLO
   * (pedido de JC del 28 ago — al pie quedaba demasiado oculto). Acento DORADO
   * #C9A227 (el oro del filete SDI, y "VIP") con la señal arriba como
   * border-top, el mismo patrón del aviso ámbar. Sin degradados ni emojis.
   *
   * Reglas de la circular, ya probadas en el cotizador:
   *  - Solo se menciona si al menos un viajero califica. Si nadie llega al
   *    monto, SILENCIO: el cliente ya compró y no puede cambiar de opción.
   *  - Si unos califican y otros no, se nombra a quién aplica.
   *  - primaMinima 0 = califican todos y desaparece la mención del monto
   *    (nombrar un mínimo que ya no existe haría dudar a quien pagó menos).
   *  - Solo lo que la circular respalda: nada de acompañante, número de
   *    accesos, regreso ni servicios de la sala. Solo Juan Santamaría.
   *  - Se atribuye al INS y lleva el período, reescrito desde config.
   */
  function bloqueSalaVip(envio) {
    if (!salaVipEnFecha()) return '';
    if (envio.salaVip === false) return '';       // el toggle del paso 3
    const vs = envio.viajeros || [];
    if (!vs.length) return '';
    const cfg = VCfg.SALA_VIP;
    const min = Number(cfg.primaMinima) || 0;
    const califican = salaVipCalifican(vs);
    if (!califican.length) return '';
    const todos = califican.length === vs.length;

    const ORO = '#C9A227', ORO_TXT = '#7c621c', BORDE = '#e8d9a6', FONDO = '#fffdf4';
    const minTxt = '<b style="color:' + SDI_NAVY + ';">US$' + min + ' por persona</b>';
    let cuerpo;
    if (min === 0) {
      cuerpo = 'El INS otorga a ' + (vs.length > 1 ? 'sus seguros' : 'su seguro') +
        ' acceso a la Sala VIP del aeropuerto.';
    } else if (todos) {
      cuerpo = 'Por tener una prima igual o superior a ' + minTxt + ', el INS otorga a ' +
        (vs.length > 1 ? 'sus seguros' : 'su seguro') + ' acceso a la Sala VIP del aeropuerto.';
    } else {
      const nombres = califican.map(v => (v.nombrePila || v.cliente || 'el viajero').trim());
      cuerpo = 'El INS otorga acceso a la Sala VIP del aeropuerto a las p&oacute;lizas con prima igual o superior a ' +
        minTxt + '. En este env&iacute;o, el beneficio aplica para <b style="color:' + SDI_NAVY + ';">' +
        esc(unirNombres(nombres)) + '</b>.';
    }
    // La oferta-constancia ES el PDF de la póliza: si viaja adjunta en este
    // correo se dice; si el envío se armó sin PDF, se remite al correo del INS.
    const hayPoliza = vs.some(v => (v.files || []).some(f =>
      (f.vKind || (window.VParse ? VParse.classifyFile(f.name, '') : 'otro')) === 'poliza'));
    const constancia = hayPoliza
      ? '&mdash;el documento de p&oacute;liza adjunto en este correo&mdash;'
      : '&mdash;que el INS le envi&oacute; al correo registrado en la compra&mdash;';

    return '<tr><td style="padding:22px 32px 0;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + FONDO +
        ';border:1px solid ' + BORDE + ';border-top:3px solid ' + ORO + ';border-radius:10px;">' +
      '<tr><td style="padding:16px 18px 15px;">' +
        '<p style="margin:0 0 3px;font-size:10px;font-weight:700;color:' + ORO_TXT + ';letter-spacing:0.12em;text-transform:uppercase;">Beneficio para su viaje</p>' +
        '<p style="margin:0 0 8px;font-family:' + FF + ';font-size:16px;font-weight:700;color:' + SDI_NAVY + ';line-height:1.3;">Acceso a la Sala VIP &middot; Aeropuerto Internacional Juan Santamar&iacute;a</p>' +
        '<p style="margin:0;font-size:13px;color:#334155;line-height:1.7;">' + cuerpo +
          ' Para ingresar, presente la <b style="color:' + SDI_NAVY + ';">oferta-constancia de seguro</b> ' + constancia +
          ' con la p&oacute;liza vigente al momento de usar el beneficio.</p>' +
        '<p style="margin:9px 0 0;font-size:10.5px;color:' + SDI_GRIS + ';line-height:1.5;">Beneficio otorgado por el INS &middot; Vigente ' + periodoSalaVip(cfg) + '.</p>' +
      '</td></tr></table></td></tr>';
  }

  /**
   * Pie con el logotipo SDI full color y la nota legal completa.
   * Grises: #94a3b8 da 6,16:1 sobre el navy. La licencia SUGESE es dato
   * regulatorio y no puede ir en un gris que no llegue a AA.
   */
  function pieSDI(A, logo) {
    const linea = function (t, top) {
      return '<p style="margin:' + top + 'px 0 0;font-size:10.5px;color:#94a3b8;line-height:1.6;">' + t + '</p>';
    };
    const web = String(A.web || '').replace(/^https?:\/\//i, '').trim();
    return '<tr><td bgcolor="' + SDI_NAVY + '" style="background:' + SDI_NAVY + ';color:#cbd5e1;padding:30px 32px 26px;text-align:center;">' +
      // 120 px sobre un correo de 600: el pie firma, no compite con el contenido.
      '<img src="' + esc(logo) + '" alt="Seguros Digitales SDI" width="120" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:120px;height:auto;" />' +
      '<p style="margin:18px 0 0;font-size:12px;">' +
        '<a href="mailto:' + esc(A.correo) + '" style="color:#7dd3fc;text-decoration:none;font-weight:600;">' + esc(A.correo) + '</a>' +
        (web ? ' &middot; <a href="https://' + esc(web) + '" style="color:#7dd3fc;text-decoration:none;font-weight:600;">' + esc(web) + '</a>' : '') +
      '</p>' +
      '<p style="margin:6px 0 0;font-size:12px;color:#cbd5e1;">Tel: ' + esc(A.tel) + '</p>' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>' +
        '<td style="border-top:1px solid #1e3a5f;height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table>' +
      linea('&copy; Propiedad intelectual de ' + esc(A.nombre), 14) +
      linea('Seguros Digitales SDI &mdash; Todos los derechos reservados', 3) +
      linea('Agente exclusivo INS &middot; Licencia SUGESE ' + esc(A.licencia), 3) +
      '</td></tr>';
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
    // Los dos logos van hosteados en el propio sitio: en correo no sirven ni el
    // SVG ni el base64, Gmail los bloquea.
    const logoIns = C.LOGO_INS_URL;
    const logoSdi = C.LOGO_SDI_URL;

    const lineaLicencia = ['Licencia Sugese ' + (A.licencia || ''), A.codigo ? 'C&oacute;digo ' + A.codigo : '']
      .filter(s => s && s !== 'Licencia Sugese ').join(' &middot; ');
    const total = (envio.viajeros || []).length;
    const viajeros = (envio.viajeros || []).map((v, i) => tarjetaViajero(v, i, total)).join('');

    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Su Seguro INS Viajero est&aacute; activo</title>' +
'<!--[if !mso]><!-->' +
'<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<!--<![endif]--></head>' +
'<body style="margin:0;padding:0;background:#f5f5f5;font-family:' + FTXT + ';">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;"><tr><td align="center">' +
'<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;box-shadow:0 4px 20px rgba(12,35,64,.08);">' +

  // 1 · Encabezado + filete de marca
  '<tr><td bgcolor="' + SDI_NAVY + '" style="background:' + SDI_NAVY + ';color:#ffffff;padding:26px 32px;text-align:center;">' +
    '<img src="' + esc(logoIns) + '" alt="INS" height="44" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;height:44px;">' +
    '<h1 style="margin:0;font-family:' + FF + ';font-size:21px;font-weight:700;letter-spacing:-.01em;">Seguro INS Viajero</h1>' +
    '<p style="margin:6px 0 0;font-size:12px;opacity:.78;">Con Asistencia &middot; Su viaje protegido en todo el mundo</p>' +
  '</td></tr>' +
  filete() +

  // 2 · Saludo + confirmación
  '<tr><td style="padding:26px 32px 0;">' +
    '<p style="margin:0 0 14px;font-family:' + FF + ';font-size:18px;font-weight:700;color:' + SDI_NAVY + ';">Hola ' + esc(envio.saludo) + ',</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;">' +
      '<tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;color:#065f46;">' +
        'Es un gusto saludarle. Le confirmo que su <b style="color:' + SDI_NAVY + ';">Seguro INS Viajero con Asistencia</b> ' +
        '<b style="color:' + SDI_VERDE + ';">ya se encuentra activo</b> y listo para proteger ' +
        (total > 1 ? 'a los ' + total + ' viajeros' : 'el viaje') + '.' +
      '</td></tr></table>' +
  '</td></tr>' +

  // 3 · Los datos del viaje
  '<tr><td style="padding:22px 32px 0;">' +
    '<h2 style="margin:0 0 2px;font-family:' + FF + ';font-size:13px;font-weight:700;color:' + SDI_NAVY +
      ';text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid ' + SDI_COLORES[0] + ';padding-bottom:8px;">' +
      (total > 1 ? total + ' viajeros amparados' : 'El viaje amparado') + '</h2>' +
    viajeros +
  '</td></tr>' +

  // 3b · Beneficio Sala VIP (si está prendido, en fecha y alguien califica)
  bloqueSalaVip(envio) +

  // 4 · Centro de asistencia
  '<tr><td style="padding:22px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">' +
      '<tr><td style="padding:18px;text-align:center;">' +
        '<p style="margin:0 0 4px;font-family:' + FF + ';font-size:14px;font-weight:700;color:#0c4a6e;">Centro de asistencia 24/7</p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#475569;line-height:1.55;">Si necesita un m&eacute;dico o le pasa algo en el viaje, esta gu&iacute;a le dice qu&eacute; hacer paso a paso y le conecta al instante con el contacto correcto.</p>' +
        '<a href="' + esc(guiaLink) + '" style="display:inline-block;background:' + SDI_VERDE + ';color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;font-family:' + FF + ';font-weight:700;font-size:14px;">Abrir mi gu&iacute;a de emergencias &rarr;</a>' +
        '<p style="margin:10px 0 0;font-size:11px;color:' + SDI_GRIS + ';line-height:1.5;">&Aacute;brala en el celular y elija <b>"A&ntilde;adir a pantalla de inicio"</b> para tenerla siempre a mano, como una App. Sin descargas.</p>' +
      '</td></tr></table>' +
  '</td></tr>' +

  // 5 · Adjuntos
  bloque('Documentos adjuntos',
    '<p style="margin:0;font-size:13px;color:#334155;line-height:1.95;">' + listaAdjuntos(envio) + '</p>') +

  // 6 · Contactos de emergencia
  bloque('Contactos de emergencia (gu&aacute;rdelos)',
    '<p style="margin:0;font-size:13px;color:#334155;line-height:1.9;">' +
      'USA (gratuito): <b style="color:' + SDI_NAVY + ';">' + esc(C.EMERGENCIA.usa) + '</b><br>' +
      'Espa&ntilde;a (gratuito): <b style="color:' + SDI_NAVY + ';">' + esc(C.EMERGENCIA.espana) + '</b><br>' +
      'Resto del mundo: <b style="color:' + SDI_NAVY + ';">' + esc(C.EMERGENCIA.mundo) + '</b><br>' +
      'Correo: ' + esc(C.EMERGENCIA.email) + '</p>') +

  // 7 · El único aviso del correo: la señal va arriba, no como barra a la izquierda
  '<tr><td style="padding:18px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-top:3px solid #f59e0b;border-radius:8px;">' +
      '<tr><td width="30" valign="top" style="padding:12px 0 12px 14px;color:#b45309;font-size:16px;line-height:1.2;">&#9888;</td>' +
      '<td valign="top" style="padding:12px 14px 12px 4px;">' +
        '<p style="margin:0;font-size:12px;color:#78350f;line-height:1.55;"><b style="color:#422006;">Importante:</b> ante cualquier emergencia m&eacute;dica contacte primero a la Unidad de Asistencia del INS. Tenga a mano su pasaporte y su n&uacute;mero de p&oacute;liza.</p>' +
      '</td></tr></table>' +
  '</td></tr>' +

  // 8 · Firma
  '<tr><td style="padding:24px 32px 0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ' + SDI_LINEA + ';"><tr><td style="padding:18px 0 0;">' +
      '<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">Quedo a su entera disposici&oacute;n para cualquier consulta. Atentamente,</p>' +
      '<p style="margin:10px 0 0;font-family:' + FF + ';font-weight:700;color:' + SDI_NAVY + ';font-size:14px;">' + esc(A.nombre) + '</p>' +
      '<p style="margin:2px 0 0;font-size:11px;color:' + SDI_GRIS + ';line-height:1.6;">' + esc(A.rol) + '<br>' + lineaLicencia +
        (A.tel ? '<br>Tel: ' + esc(A.tel) : '') + '</p>' +
    '</td></tr></table>' +
  '</td></tr>' +

  // 9 · Comprar de nuevo
  '<tr><td style="padding:20px 32px 28px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;">' +
      '<tr><td style="padding:14px;text-align:center;">' +
        '<p style="margin:0 0 8px;font-size:12px;color:' + SDI_GRIS + ';">&iquest;Planeando su pr&oacute;ximo viaje?</p>' +
        '<a href="' + esc(cotizaLink) + '" style="display:inline-block;font-family:' + FF + ';font-size:13px;font-weight:600;color:' + SDI_COLORES[0] +
          ';text-decoration:none;border:1px solid #c7d2e0;border-radius:8px;padding:9px 18px;background:#ffffff;">Comprar de nuevo un Seguro INS Viajero</a>' +
      '</td></tr></table>' +
  '</td></tr>' +

  pieSDI(A, logoSdi) +

'</table></td></tr></table></body></html>';
  }

  const MIME_POR_EXT = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic'
  };
  function tipoPorNombre(n) {
    const ext = (String(n || '').split('.').pop() || '').toLowerCase();
    return MIME_POR_EXT[ext] || 'application/octet-stream';
  }
  // Las comillas y los saltos de línea en el nombre romperían la cabecera MIME.
  function nombreSeguro(n) { return String(n || 'documento').replace(/[\r\n"]/g, ' ').trim() || 'documento'; }

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
      // El tipo real del archivo: si la tarjeta viene como imagen, no se puede
      // rotular application/pdf o el cliente de correo la muestra rota.
      const tipo = a.mime || tipoPorNombre(a.name);
      const nombre = nombreSeguro(a.name);
      // Nombre con acentos: RFC 2047 en name= y RFC 2231 en filename*= para que
      // Gmail y Outlook lo muestren bien en vez de mojibake.
      const ascii = !/[^\x20-\x7E]/.test(nombre);
      const name47 = ascii ? `"${nombre}"` : '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(nombre))) + '?=';
      const disp = ascii ? `filename="${nombre}"` : `filename*=UTF-8''${encodeURIComponent(nombre)}`;
      mime += `--${boundary}\r\nContent-Type: ${tipo}; name=${name47}\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; ${disp}\r\n\r\n${a.b64}\r\n`;
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

  return { buildHtml, buildAndSend, fileToB64, pathToB64, salaVipEnFecha, salaVipCalifican };
})();
