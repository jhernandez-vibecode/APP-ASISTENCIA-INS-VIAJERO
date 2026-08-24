// agente/zip.js — abre lo que manda el INS tal como llega: el ZIP de cada póliza,
// una carpeta con varios ZIP adentro, o la carpeta ya descomprimida.
//
// 🔴 Las colecciones que entrega el navegador (FileList, DataTransferItemList) son
// VIVAS: se vacían apenas el handler cede el control en el primer `await`. Por eso
// todo lo que las toca acá copia primero, de forma SINCRÓNICA, y recién después
// espera algo. Es la misma lección del 3 ago 2026 (se perdían tarjeta y comprobante).
window.VZip = (function () {
  // CDN pineado a una versión fija: un "latest" que cambie de la noche a la mañana
  // deja la consola en blanco sin que nadie toque el código.
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const MAX_PROFUNDIDAD = 3; // un ZIP de ZIPs de ZIPs ya es un error del usuario, no un caso real
  let cargandoLib = null;

  function cargarJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (cargandoLib) return cargandoLib;
    cargandoLib = new Promise((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = JSZIP_URL;
      s.onload = () => window.JSZip
        ? resolver(window.JSZip)
        : rechazar(new Error('El lector de archivos ZIP cargó incompleto. Recargá la página e intentá de nuevo.'));
      s.onerror = () => { cargandoLib = null; rechazar(new Error('No se pudo cargar el lector de archivos ZIP. Revisá la conexión a internet y volvé a intentarlo.')); };
      document.head.appendChild(s);
    });
    return cargandoLib;
  }

  const MIME_POR_EXT = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', zip: 'application/zip'
  };
  function tipoPorNombre(n) {
    const ext = (String(n || '').split('.').pop() || '').toLowerCase();
    return MIME_POR_EXT[ext] || 'application/octet-stream';
  }
  function soloNombre(ruta) { return String(ruta || '').split(/[\/]/).pop(); }
  function esZip(f) {
    return /\.zip$/i.test(f && f.name || '') || /^application\/(x-)?zip/i.test(f && f.type || '');
  }
  // Basura que meten Windows y macOS al comprimir; no es documentación del cliente.
  function esBasura(ruta) {
    const n = soloNombre(ruta);
    return !n || n.startsWith('.') || /^__MACOSX/.test(ruta) || /^thumbs\.db$|^desktop\.ini$/i.test(n);
  }

  // ----- ZIP -----
  async function abrirZip(file, profundidad, onPaso) {
    const JSZip = await cargarJSZip();
    let zip;
    try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
    catch (e) { throw new Error('No se pudo abrir "' + file.name + '": el archivo comprimido está dañado o tiene contraseña.'); }
    const entradas = [];
    zip.forEach((ruta, entrada) => { if (!entrada.dir && !esBasura(ruta)) entradas.push([ruta, entrada]); });
    const salida = [];
    for (const [ruta, entrada] of entradas) {
      const nombre = soloNombre(ruta);
      if (onPaso) onPaso('Abriendo ' + nombre);
      const blob = await entrada.async('blob');
      const archivo = new File([blob], nombre, { type: tipoPorNombre(nombre) });
      // Un ZIP con los 9 ZIP del INS adentro es exactamente lo que manda un
      // agente que comprimió la carpeta entera: hay que seguir abriendo.
      if (esZip(archivo) && profundidad < MAX_PROFUNDIDAD) {
        salida.push(...await abrirZip(archivo, profundidad + 1, onPaso));
      } else {
        salida.push(archivo);
      }
    }
    return salida;
  }

  // Recibe la copia YA sincrónica de los archivos y devuelve la lista plana, con
  // los ZIP abiertos. onPaso({etapa, hechos, total}) para la barra de progreso.
  async function expandir(archivos, onPaso) {
    const lista = Array.from(archivos || []);
    const zips = lista.filter(esZip);
    if (!zips.length) return lista;
    const salida = [];
    let hechos = 0;
    for (const f of lista) {
      if (!esZip(f)) { salida.push(f); continue; }
      if (onPaso) onPaso({ etapa: 'Abriendo ' + f.name, hechos, total: zips.length });
      salida.push(...await abrirZip(f, 1, null));
      hechos++;
      if (onPaso) onPaso({ etapa: 'Abriendo archivos comprimidos', hechos, total: zips.length });
    }
    return salida;
  }

  // ----- Carpetas arrastradas -----
  // webkitGetAsEntry() hay que llamarlo SINCRÓNICAMENTE dentro del handler del
  // drop: después del primer await, dataTransfer.items ya está neutralizado.
  function entradasDe(dataTransfer) {
    const items = Array.from(dataTransfer && dataTransfer.items || []);
    return items
      .map(it => (it && typeof it.webkitGetAsEntry === 'function') ? it.webkitGetAsEntry() : null)
      .filter(Boolean);
  }
  function hayCarpetas(entradas) { return entradas.some(e => e && e.isDirectory); }

  async function leerEntrada(entrada, salida) {
    if (!entrada) return;
    if (entrada.isFile) {
      const f = await new Promise((res, rej) => entrada.file(res, rej)).catch(() => null);
      if (f && !esBasura(f.name)) salida.push(f);
      return;
    }
    if (!entrada.isDirectory) return;
    const lector = entrada.createReader();
    // readEntries() devuelve como mucho 100 por llamada: hay que insistir hasta
    // que conteste vacío, o una carpeta grande se lee a medias en silencio.
    let lote;
    do {
      lote = await new Promise((res) => lector.readEntries(res, () => res([])));
      for (const e of lote) await leerEntrada(e, salida);
    } while (lote.length);
  }

  async function desdeEntradas(entradas) {
    const salida = [];
    for (const e of entradas) await leerEntrada(e, salida);
    return salida;
  }

  return { esZip, expandir, entradasDe, hayCarpetas, desdeEntradas, tipoPorNombre, soloNombre };
})();
