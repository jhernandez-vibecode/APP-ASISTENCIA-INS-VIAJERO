// agente/parse.js — extracción de campos del PDF de póliza. Puro y testeable.
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
  function fmtUsd(raw) { const d = (raw || '').replace(/\D/g, ''); return d ? 'US$' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; }
  function extractGastosMedicos(t) {
    const m = t.match(/Gastos M[eé]dicos y Adicionales:\s*\$\s*([\d ]+)/i);
    return m ? fmtUsd(m[1]) : '';
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
      destino: extractDestino(t), gastosMedicos: extractGastosMedicos(t),
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
  return { normalize, extractAll, classifyFile, readPdfText, sugerirNombrePila };
})();
