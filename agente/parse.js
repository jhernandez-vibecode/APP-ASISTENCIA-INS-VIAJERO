// agente/parse.js — extracción de campos del PDF de póliza. Puro y testeable.
window.VParse = (function () {
  function normalize(t) { return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  // 🔴 NO usar `\b` para partir palabras: en JavaScript la frontera se define por
  // `\w` = [A-Za-z0-9_], así que una letra acentuada CUENTA como frontera y dispara
  // una mayúscula de más — "MARÍA" salía "MarÍA" y "NÚÑEZ" salía "NÚñEz", y de acá
  // sale el saludo del correo y de los dos WhatsApp. Se parte por inicio de cadena,
  // espacio o guion, que es lo que de verdad separa un nombre.
  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s\-])(\p{L})/gu, (m, sep, letra) => sep + letra.toUpperCase());
  }

  function extractPoliza(t) { const m = t.match(/\b(\d{4}VIA\d{9})\b/); return m ? m[1] : ''; }
  // Hay DOS plantillas de oferta-constancia y solo cambian en la cabecera:
  //  · Sucursal Central (serie 0201): "Nombre o Razón Social: X Tipo de Identificación:"
  //  · Sucursal Virtual (serie 0221): "DATOS DEL RIESGO Nombre: X N° Identificación:"
  // La segunda quedaba sin nombre ni cédula: con un asegurado por envio casi no se
  // notaba, pero al cargar nueve de golpe salian tres filas en blanco en el correo.
  function extractCliente(t) {
    const m = t.match(/Nombre o Raz[oó]n Social:\s*(.+?)\s+Tipo de Identifica/i);
    if (m) return m[1].trim();
    const v = t.match(/\bNombre:\s*(.+?)\s+N[°ºøo]?\s*Identificaci[oó]n:/i);
    return v ? v[1].trim() : '';
  }
  function extractCedula(t) {
    const m = t.match(/N[uú]mero de Identificaci[oó]n:\s*([0-9A-Za-z-]+)/i);
    if (m) return m[1].trim();
    const v = t.match(/N[°ºøo]?\s*Identificaci[oó]n:\s*([0-9A-Za-z-]+)/i);
    return v ? v[1].trim() : '';
  }
  function extractDestino(t) {
    const m = t.match(/Destino \(s\) del Viaje:\s*(.+?)\s+Motivo/i);
    return m ? m[1].trim() : '';
  }
  function extractVigencia(t) {
    const m = t.match(/Desde:\s*(\d{2}\/\d{2}\/\d{4})\s*Hasta:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return m ? { desde: m[1], hasta: m[2] } : { desde: '', hasta: '' };
  }
  // 🔴 En la plantilla de Sucursal Virtual "Correo Principal:" viene VACÍO y lo
  // siguiente en el texto es la etiqueta "Cc:". Sin este filtro, "Cc:" terminaba
  // cargado como correo del cliente y de ahí pasaba al campo del destinatario.
  function esCorreo(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
  function extractCorreo(t) {
    const m = t.match(/Correo Principal:\s*([^\s]+)/i);
    if (!m) return '';
    const mails = m[1].split(',').map(s => s.trim()).filter(esCorreo);
    return mails.find(e => !/segurosdelins\.com$/i.test(e)) || mails[0] || '';
  }
  function fmtUsd(raw) { const d = (raw || '').replace(/\D/g, ''); return d ? 'US$' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; }
  function extractGastosMedicos(t) {
    const m = t.match(/Gastos M[eé]dicos y Adicionales:\s*\$\s*([\d ]+)/i);
    return m ? fmtUsd(m[1]) : '';
  }
  // La prima viene en la MISMA línea que el nombre en las dos plantillas:
  //   Central: "... Monto Asegurado: $200 000 Prima: $ 164.79"
  //   Virtual: "... Monto Asegurado: $50 000 Prima: $ 159.70 Plan: Plan Unificado V4"
  // El número se ancla en "Prima:" y corta en la primera letra: un patrón glotón
  // se comería "Plan:" o el texto que siga. 🔴 NO usar fmtUsd() para esto: su
  // replace(/\D/g,'') borra el punto decimal y $164.79 saldría US$16.479. La
  // prima se muestra con coma decimal y punto de miles (US$1.164,79), el MISMO
  // criterio de US$1.000.000 en gastos médicos: en un correo donde el punto ya
  // significa miles, no puede significar decimales dos renglones más abajo.
  function parsePrimaUsd(s) {
    const t = String(s == null ? '' : s).replace(/[^0-9.,]/g, '');
    if (!t) return NaN;
    if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
    const partes = t.split('.');
    if (partes.length > 1 && partes[partes.length - 1].length === 3) return parseFloat(partes.join(''));
    return parseFloat(t);
  }
  function fmtPrima(raw) {
    const n = parsePrimaUsd(raw);
    if (!isFinite(n)) return '';
    const conDec = Math.round(n * 100) % 100 !== 0;
    return 'US$' + n.toLocaleString('de-DE', { minimumFractionDigits: conDec ? 2 : 0, maximumFractionDigits: 2 });
  }
  function extractPrima(t) {
    const m = t.match(/Prima:\s*\$?\s*(\d[\d ]*(?:[.,]\d{1,2})?)/i);
    return m ? fmtPrima(m[1]) : '';
  }
  function sugerirNombrePila(cliente) {
    const toks = (cliente || '').trim().split(/\s+/);
    const pila = toks.length > 2 ? toks.slice(2).join(' ') : cliente;
    return pila ? titleCase(pila) : '';
  }
  // El numero de poliza viene en el nombre de TODOS los archivos que manda el INS
  // (la poliza y la tarjeta lo llevan de prefijo, y el ZIP tambien): es la llave
  // que permite repartir un lote de nueve asegurados sin abrir un solo PDF.
  function polizaDeNombre(filename) {
    const m = String(filename || '').match(/(\d{4}VIA\d{9})/i);
    return m ? m[1].toUpperCase() : '';
  }
  function classifyFile(filename, text) {
    // Dentro de un ZIP el nombre puede venir con carpetas adelante.
    const f = String(filename || '').toLowerCase().split(/[\\/]/).pop();
    // El ZIP del INS trae las Condiciones Generales (DERSA+CG) en CADA poliza. La
    // consola ya adjunta su propia copia una sola vez, asi que se reconocen para
    // no mandarle al cliente nueve veces el mismo documento.
    if (/dersa|condiciones\s*generales/.test(f)) return 'condiciones';
    if (/tarjeta/.test(f)) return 'tarjeta';
    if (/comprobante/.test(f)) return 'comprobante';
    // Lamina publicitaria que el INS mete en algunos ZIP: no es documentacion.
    if (/bienvenida/.test(f)) return 'promo';
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
      destino: extractDestino(t), gastosMedicos: extractGastosMedicos(t),
      prima: extractPrima(t),
      vigenciaDesde: vig.desde, vigenciaHasta: vig.hasta,
      correo: extractCorreo(t)
    };
  }
  async function readPdfText(file) {
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
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
  return { normalize, extractAll, classifyFile, polizaDeNombre, readPdfText, sugerirNombrePila, parsePrimaUsd };
})();
