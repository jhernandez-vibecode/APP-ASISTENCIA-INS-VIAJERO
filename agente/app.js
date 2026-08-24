// agente/app.js — UI de la consola: login, lista de viajeros, canales, envío.
window.VApp = (function () {
  // asegurados = [{poliza, nombre}] — lo que sale en el mensaje de WhatsApp.
  // tel = teléfono del cliente; se guarda en el estado porque antes vivía solo en
  // el input y cualquier render() lo borraba en silencio.
  // paso = la pantalla que se ve: 1 cargar · 2 revisar · 3 enviar. Desde el
  // 21 ago la consola muestra UNA sola por vez (opción A del rediseño): antes
  // todo vivía en el mismo scroll y los tres botones de canal se confundían
  // con los dos de envío.
  const state = { paso: 1, viajeros: [], destinatarios: [], saludo: '', poliza: '', asegurados: [], tel: '', canal: 'correo', sent: false, envio: null, cargando: null, descartes: [] };
  let nextId = 1;
  let agentOpen = false;
  let asegManual = false; // el agente editó a mano las pólizas/nombres del mensaje

  function el(id) { return document.getElementById(id); }
  function showConsole() {
    el('gate').classList.add('hidden');
    el('console').classList.remove('hidden');
    const g = el('btn-agente'); if (g) g.classList.remove('hidden');
    render();
  }

  // ----- Panel "Mi información de agente" -----
  const AG_LABELS = {
    nombre: 'Nombre completo', rol: 'Rol / cargo', licencia: 'Licencia Sugese (n.º)',
    codigo: 'Código', tel: 'Teléfono', whatsapp: 'WhatsApp (solo dígitos, ej. 50688221348)',
    correo: 'Correo', web: 'Sitio web', id: 'Identificador para el link (ej. jc)',
    cotizaLink: 'Link de cotización INS (con tu código de intermediario)'
  };
  function agentField(a, key) {
    const order = key;
    return `<label style="display:block"><span style="font-size:11px;color:#94a3b8">${AG_LABELS[key]}</span>
      <input data-ag="${order}" value="${(a[key] || '').replace(/"/g, '&quot;')}" class="w-full text-sm border rounded px-2 py-1"/></label>`;
  }
  // Se dibuja SOLO si el agente abrió el engranaje del encabezado. Cerrado no
  // ocupa ni una línea: el trabajo del día empieza arriba de todo.
  function agentePanel() {
    if (!agentOpen) return '';
    const a = VAgent.get();
    const link = VAgent.publicLink(a);
    const body = `
      <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${agentField(a, 'nombre')}${agentField(a, 'rol')}
        ${agentField(a, 'licencia')}${agentField(a, 'codigo')}
        ${agentField(a, 'tel')}${agentField(a, 'correo')}
        ${agentField(a, 'whatsapp')}${agentField(a, 'web')}
        ${agentField(a, 'cotizaLink')}${agentField(a, 'id')}
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <button onclick="VApp.agentSave()" class="text-white text-xs font-medium rounded-lg px-3 py-1.5" style="background:linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)">Guardar mi información</button>
        <button onclick="VApp.agentReset()" class="text-xs border rounded-lg px-3 py-1.5">Restaurar a Juan Carlos</button>
      </div>
      <div class="mt-3 border-t pt-3">
        <span class="text-xs text-slate-400">Tu link para enviar a clientes (ya personalizado con tu información)</span>
        <div class="flex gap-2 mt-1">
          <input id="ag-link" readonly value="${link.replace(/"/g, '&quot;')}" class="flex-1 text-xs border rounded px-2 py-1 bg-slate-50 font-mono"/>
          <button onclick="VApp.agentCopyLink()" class="text-xs border rounded-lg px-3 py-1.5 whitespace-nowrap">Copiar</button>
          <button onclick="VApp.agentPreviewLink()" class="text-xs border rounded-lg px-3 py-1.5 whitespace-nowrap">Ver</button>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Guardá primero tus cambios para que el link se actualice. Este es el link de la página pública del cliente.</p>
      </div>`;
    return `<div class="v-pop border-2 border-sdi-azul rounded-xl p-4 bg-white mb-4">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-slate-700">⚙️ Mi información de agente</span>
        <button onclick="VApp.agentToggle()" class="text-xs border rounded-lg px-3 py-1.5 whitespace-nowrap hover:bg-slate-50">Cerrar ✕</button>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">${esc(a.nombre)} · esto se guarda en este navegador y no hace falta volver a tocarlo.</p>
      ${body}</div>`;
  }

  async function login() {
    el('gate-err').classList.add('hidden');
    try { const { email } = await VAuth.signIn(); el('who').textContent = email; showConsole(); }
    catch (e) { el('gate-err').textContent = e.message; el('gate-err').classList.remove('hidden'); }
  }

  // ----- Permiso de envío de Gmail -----
  // Google muestra "Enviar correo electrónico en tu nombre" como una casilla que
  // el agente puede dejar sin marcar: entra a la consola igual, pero Gmail
  // rechaza el envío con 403. Este aviso lo deja arreglarlo con un clic.
  function avisoPermiso() {
    if (!window.VAuth || VAuth.canSend()) return '';
    return `<div class="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 mb-4">
      <div class="text-sm font-semibold text-amber-900">⚠️ Falta el permiso para enviar correos</div>
      <p class="text-xs text-amber-800 mt-1 leading-relaxed">Google no recibió el permiso de envío, así que el correo va a fallar. Hacé clic en el botón y, en la pantalla de Google, <b>marcá la casilla “Enviar correo electrónico en tu nombre”</b> antes de continuar.</p>
      <button onclick="VApp.pedirPermiso()" class="mt-2 text-white text-xs font-medium rounded-lg px-3 py-1.5" style="background:linear-gradient(135deg,#d97706 0%,#b45309 100%)">Conceder permiso de envío</button>
    </div>`;
  }
  async function pedirPermiso() {
    try {
      await VAuth.grantSend(); render();
      const st = el('status');
      if (st) st.textContent = VAuth.canSend()
        ? '✅ Permiso concedido, ya podés enviar correos.'
        : '❌ Seguís sin el permiso de envío: repetí el paso y marcá la casilla “Enviar correo electrónico en tu nombre”.';
    } catch (e) { const st = el('status'); if (st) st.textContent = '❌ ' + e.message; }
  }

  // Traduce el volcado crudo de la API de Gmail a algo que el agente entienda.
  function msgError(e) {
    const m = String(e && e.message || e);
    if (esErrorDePermiso(m)) return 'Google no dio el permiso para enviar correos. Usá el botón “Conceder permiso de envío” y marcá la casilla “Enviar correo electrónico en tu nombre”.';
    if (/\b401\b|UNAUTHENTICATED/i.test(m)) return 'La sesión de Google venció. Volvé a conectar e intentá de nuevo.';
    return m;
  }
  function esErrorDePermiso(m) {
    return /\b403\b|insufficient|SCOPE_INSUFFICIENT|PERMISSION_DENIED|insufficientPermissions/i.test(String(m));
  }

  // Crea la tarjeta y la devuelve SIN redibujar: durante la carga de un lote se
  // crean varias seguidas y un render() por cada una destruiria la zona de
  // arrastre en plena operacion.
  function crearViajero() {
    const v = { id: nextId++, cliente: '', nombrePila: '', poliza: '', cedula: '', destino: '', gastosMedicos: '', vigenciaDesde: '', vigenciaHasta: '', correo: '', files: [] };
    state.viajeros.push(v);
    return v;
  }
  function pushViajero() {
    state.sent = false;
    crearViajero();
    syncEnvio(); render();
  }

  // "+ Agregar viajero" agregaba en silencio: un doble clic por error dejaba una
  // tarjeta vacía sin que el agente se enterara. Se pregunta SOLO del segundo
  // asegurado en adelante (al primero siempre se lo agrega a propósito) y la
  // ventana va CENTRADA, lejos del botón: si apareciera debajo, el segundo clic
  // del doble clic caería justo encima del "Sí" y no serviría de nada.
  function addViajero() {
    if (!state.viajeros.length) return pushViajero();
    if (modal.abierto) return; // el 2º clic del doble clic no abre una segunda ventana
    pedirConfirmacionViajero();
  }
  function removeViajero(id) { state.viajeros = state.viajeros.filter(v => v.id !== id); syncEnvio(); render(); }

  // ----- Ventana de confirmación -----
  // Vive colgada del <body>, no de #console, para que un render() no la borre.
  const modal = { abierto: false, desde: 0 };
  function cerrarModal() {
    const ov = el('v-modal'); if (ov) ov.remove();
    modal.abierto = false;
    document.removeEventListener('keydown', escModal);
  }
  function escModal(e) { if (e.key === 'Escape') cerrarModal(); }
  // o = { icono, fondo, titulo, detalle, recuadroTitulo, recuadroTexto, si, no, rojo, onSi }
  function confirmar(o) {
    const ov = document.createElement('div');
    ov.id = 'v-modal';
    ov.className = 'fixed inset-0 z-50 flex items-center justify-center px-4';
    ov.style.background = 'rgba(15,23,42,.5)';
    const fondoSi = o.rojo ? 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)' : 'linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)';
    ov.innerHTML = `<div class="v-pop bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
      <div class="w-11 h-11 mx-auto mb-3 rounded-full ${o.fondo} flex items-center justify-center text-xl">${o.icono}</div>
      <h4 class="text-base font-bold leading-snug" style="color:#0b2545">${o.titulo}</h4>
      <p class="text-xs text-slate-500 mt-2 leading-relaxed">${o.detalle}</p>
      <div class="bg-slate-50 border rounded-lg px-3 py-2 mt-3 text-left text-[11px] text-slate-600 leading-relaxed">
        <b class="block text-xs mb-0.5" style="color:#0b2545">${o.recuadroTitulo}</b>${o.recuadroTexto}</div>
      <div class="flex gap-2 mt-4">
        <button id="v-no" class="flex-1 text-xs font-semibold border rounded-lg px-3 py-2.5 bg-white hover:bg-slate-50">${o.no}</button>
        <button id="v-si" class="flex-1 text-white text-xs font-semibold rounded-lg px-3 py-2.5 shadow-sm transition-all duration-200 hover:shadow-lg active:scale-95" style="background:${fondoSi}">${o.si}</button>
      </div></div>`;
    document.body.appendChild(ov);
    modal.abierto = true; modal.desde = Date.now();
    // El clic de afuera cierra, pero NO durante el primer instante: si no, el
    // segundo clic del doble clic accidental cerraría la ventana de un plumazo y
    // el agente solo vería un parpadeo en vez de la pregunta.
    ov.addEventListener('click', e => {
      if (e.target === ov && (Date.now() - modal.desde) > 400) cerrarModal();
    });
    el('v-no').addEventListener('click', cerrarModal);
    el('v-si').addEventListener('click', () => { cerrarModal(); o.onSi(); });
    document.addEventListener('keydown', escModal);
    el('v-no').focus(); // con Enter se cancela: es lo seguro ante un clic accidental
  }

  function pedirConfirmacionViajero() {
    const n = state.viajeros.length;
    const nombres = state.viajeros.map(v => (v.cliente || v.nombrePila || '').trim()).filter(Boolean);
    confirmar({
      icono: '👤', fondo: 'bg-blue-50',
      titulo: '¿Querés enviar los documentos de otro asegurado?',
      detalle: 'Se va a abrir una segunda tarjeta para cargar su póliza. Todos los asegurados viajan en el <b>mismo correo</b>.',
      recuadroTitulo: `Ya cargaste ${n} asegurado${n === 1 ? '' : 's'}`,
      recuadroTexto: nombres.length ? nombres.map(x => esc(x)).join('<br>')
        : '<span class="text-slate-400">Todavía sin nombre: no cargaste el PDF.</span>',
      no: 'No, era sin querer', si: 'Sí, agregar otro',
      onSi: () => {
        pushViajero();
        const zonas = el('console').querySelectorAll('.dropzone');
        if (zonas.length) zonas[zonas.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  // ----- Limpiar para preparar otro cliente -----
  // Antes, terminado el correo Y el WhatsApp, no quedaba salida: el botón
  // "Enviar a otro cliente" solo vivía en el panel del canal Correo, así que al
  // pasarse a WhatsApp la única forma de empezar de nuevo era recargar con F5.
  function hayAlgoQueLimpiar() {
    return state.sent || String(state.tel).trim() !== '' || state.destinatarios.length > 0 ||
      state.viajeros.some(v => v.files.length || v.poliza || v.cliente || v.correo);
  }
  // Cuántos asegurados hay de verdad: una tarjeta recién agregada a mano todavía
  // no cuenta como asegurado hasta que tenga póliza, nombre o archivos.
  function aseguradosReales() { return state.viajeros.filter(v => v.poliza || v.cliente || v.files.length).length; }
  function resumenDeLoQueSeBorra() {
    const partes = [];
    const conDatos = state.viajeros.filter(v => v.poliza || v.cliente || v.files.length).length;
    if (conDatos) partes.push(conDatos + (conDatos === 1 ? ' asegurado cargado' : ' asegurados cargados'));
    const arch = state.viajeros.reduce((s, v) => s + v.files.length, 0);
    if (arch) partes.push(arch + (arch === 1 ? ' archivo' : ' archivos'));
    if (state.destinatarios.length) partes.push('el destinatario');
    if (String(state.tel).trim()) partes.push('el teléfono');
    return partes.length ? unir(partes) + '.' : 'La pantalla ya está vacía.';
  }
  function pedirLimpiar() {
    if (modal.abierto) return;
    confirmar({
      icono: '🧹', fondo: 'bg-red-50', rojo: true,
      titulo: '¿Borrar todo y empezar de cero?',
      detalle: 'Se va a limpiar la pantalla para preparar el envío de otro cliente. <b>Lo que ya enviaste no se toca.</b>',
      recuadroTitulo: 'Se va a borrar', recuadroTexto: esc(resumenDeLoQueSeBorra()),
      no: 'No, seguir acá', si: 'Sí, limpiar',
      onSi: nuevoEnvio
    });
  }

  // "A, B y C" — el número de póliza va dentro del mensaje de WhatsApp, así que
  // se une en español y no con separadores técnicos.
  function unir(arr) {
    if (arr.length < 2) return arr[0] || '';
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }
  function polizasAuto() { return unir(state.asegurados.map(a => a.poliza).filter(Boolean)); }
  // El nombre sale TAL COMO viene de la póliza del INS (mayúscula, apellidos
  // primero): es lo que el cliente reconoce de su documento.
  function aseguradosAuto() {
    return state.viajeros.map(v => ({ poliza: (v.poliza || '').trim(), nombre: (v.cliente || '').trim() }));
  }
  function telDigitos() { return String(state.tel || '').replace(/\D/g, ''); }
  function telOk() { return telDigitos().length >= 8; }
  function telConCodigo() { const d = telDigitos(); return d.length === 8 ? '506' + d : d; }

  function syncEnvio() {
    const first = state.viajeros[0];
    if (first && !state.saludo) state.saludo = first.nombrePila || '';
    const mails = state.viajeros.map(v => v.correo).filter(Boolean);
    if (mails.length && !state.destinatarios.length) state.destinatarios = [mails[0]];
    // 🔴 Las pólizas del mensaje SIGUEN a los viajeros cargados, no se llenan una
    // sola vez: si entra un segundo asegurado, el mensaje de WhatsApp tiene que
    // llevar las DOS pólizas (las mismas que viajaron adjuntas en el correo).
    // Solo se congela si el agente las editó a mano.
    if (!asegManual) state.asegurados = aseguradosAuto();
    // En "WhatsApp directa" el cliente compró por su cuenta y no hay viajeros
    // cargados: queda una fila vacía para escribir la póliza y el nombre.
    if (!state.asegurados.length) state.asegurados = [{ poliza: '', nombre: '' }];
    state.poliza = polizasAuto(); // comodín viejo {Poliza}: solo los números
  }

  // ═══════ Entrada de documentos ═══════
  // El INS manda UN ZIP por póliza: la oferta-constancia, la tarjeta de asistencia
  // y una copia de las Condiciones Generales. Nueve viajeros son nueve ZIP. Acá se
  // abren solos, se descarta lo repetido y cada póliza arma SU tarjeta: antes todo
  // caía en el mismo asegurado y solo sobrevivían los datos del último PDF leído.
  //
  // 🔴 Las colecciones del navegador (FileList, DataTransferItemList) son VIVAS: el
  // handler las vacía apenas cede el control en el primer `await`. Toda la copia se
  // hace SINCRÓNICAMENTE antes de esperar nada. Lección del 3 ago 2026.

  function esPdfArchivo(f) { return /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || ''); }
  function yaCargado(v, f) { return v.files.some(x => x.name === f.name && x.size === f.size); }
  // Rellena SOLO lo que el PDF trajo: nunca borra un dato que el agente ya corrigió.
  function asignarDatos(v, d) { Object.keys(d).forEach(k => { if (d[k]) v[k] = d[k]; }); }

  // A qué tarjeta va una póliza: la que ya la tiene, si no una vacía sin estrenar,
  // si no una nueva. Así volver a soltar el mismo ZIP no duplica el asegurado.
  function tarjetaPara(poliza) {
    if (poliza) {
      const ya = state.viajeros.find(v => (v.poliza || '').toUpperCase() === poliza);
      if (ya) return ya;
    }
    const vacia = state.viajeros.find(v => !v.files.length && !v.poliza && !v.cliente && !v.correo);
    return vacia || crearViajero();
  }

  // ----- Barra de progreso -----
  // Se pinta sobre #carga sin render(): un redibujado en plena carga se lleva por
  // delante la zona de arrastre y los archivos que el navegador todavía está leyendo.
  function pintarCarga() {
    const c = el('carga'); if (!c) return;
    const p = state.cargando;
    if (!p) { c.innerHTML = ''; return; }
    const conTotal = p.total > 0;
    const pct = conTotal ? Math.round(100 * p.hechos / p.total) : 100;
    const barra = conTotal
      ? '<div class="h-full bg-sdi-azul rounded-full transition-all duration-300" style="width:' + pct + '%"></div>'
      : '<div class="h-full bg-sdi-azul rounded-full v-indeterminada"></div>';
    c.innerHTML = '<div class="v-pop border-2 border-sdi-azul rounded-xl px-4 py-3.5 mb-3 bg-blue-50">' +
      '<div class="flex items-center gap-2">' +
        '<span class="v-spin w-4 h-4 flex-none rounded-full border-2 border-sdi-azul border-t-transparent"></span>' +
        '<span class="text-sm font-semibold text-sdi-azul truncate">' + esc(p.etapa || 'Procesando…') + '</span>' +
      '</div>' +
      '<div class="h-1.5 bg-white rounded-full mt-2.5 overflow-hidden">' + barra + '</div>' +
      (conTotal ? '<div class="text-[11px] text-slate-500 mt-1">' + p.hechos + ' de ' + p.total + '</div>' : '') +
    '</div>';
  }
  function cargando(p) { state.cargando = p; pintarCarga(); }
  function avisar(txt) { const st = el('status'); if (st) st.textContent = txt; }

  // ----- Arrastre: ZIP, carpeta o archivos sueltos -----
  // webkitGetAsEntry() SOLO funciona dentro del handler, antes del primer await:
  // por eso las dos colecciones se copian de una vez y recién después se espera.
  function soltar(dataTransfer, destinoId) {
    const entradas = VZip.entradasDe(dataTransfer);
    const sueltos = Array.from(dataTransfer && dataTransfer.files || []);
    if (VZip.hayCarpetas(entradas)) {
      cargando({ etapa: 'Abriendo la carpeta…', hechos: 0, total: 0 });
      VZip.desdeEntradas(entradas)
        .then(fs => procesarEntrada(fs.length ? fs : sueltos, destinoId))
        .catch(() => procesarEntrada(sueltos, destinoId));
      return;
    }
    procesarEntrada(sueltos, destinoId);
  }

  function elegirArchivos() { const i = el('fi-lote'); if (i) i.click(); }
  function elegirCarpeta() { const i = el('fi-carpeta'); if (i) i.click(); }

  // Lee un PDF y devuelve { texto, kind }. El catch va acá adentro para que un PDF
  // dañado no tumbe la carga de los otros ocho asegurados.
  async function leerPdf(f) {
    const texto = await VParse.readPdfText(f).catch(() => '');
    return { texto, kind: VParse.classifyFile(f.name, texto) };
  }

  // Soltar un segundo lote con el primero a medio abrir dejaba dos recorridos
  // pisandose sobre el mismo state (tarjetas duplicadas, contadores mezclados).
  let procesando = false;

  async function procesarEntrada(archivos, destinoId) {
    const brutos = Array.from(archivos || []); // 🔴 copia sincrónica, antes de todo await
    if (!brutos.length) return;
    if (procesando) { avisar('Esperá a que termine de abrir lo anterior y volvé a soltarlo.'); return; }
    procesando = true;
    try { await abrirLote(brutos, destinoId); } finally { procesando = false; }
  }

  async function abrirLote(brutos, destinoId) {
    state.sent = false;
    state.descartes = [];
    cargando({ etapa: 'Revisando lo que cargaste…', hechos: 0, total: 0 });

    let planos;
    try { planos = await VZip.expandir(brutos, p => cargando(p)); }
    catch (e) { cargando(null); render(); avisar('❌ ' + e.message); return; }

    // 1. Clasificar por NOMBRE (gratis) y apartar lo que no se adjunta.
    const utiles = [];
    for (const f of planos) {
      const kind = VParse.classifyFile(f.name, '');
      if (kind === 'condiciones') { state.descartes.push({ nombre: f.name, motivo: 'las Condiciones Generales ya viajan adjuntas una sola vez' }); continue; }
      if (kind === 'promo') { state.descartes.push({ nombre: f.name, motivo: 'lámina publicitaria del INS' }); continue; }
      utiles.push({ f, kind, poliza: VParse.polizaDeNombre(f.name) });
    }
    if (!utiles.length) {
      cargando(null); syncEnvio(); render();
      avisar('No encontré pólizas ni tarjetas en lo que cargaste. Revisá que sean los archivos que manda el INS.');
      return;
    }

    // 2. Agrupar por número de póliza. Lo que trae número SIEMPRE se va con su
    //    póliza, aunque se haya soltado sobre otra tarjeta: es lo único que evita
    //    que nueve asegurados terminen amontonados en uno.
    const grupos = new Map();
    const sueltos = [];
    for (const it of utiles) {
      if (!it.poliza) { sueltos.push(it); continue; }
      if (!grupos.has(it.poliza)) grupos.set(it.poliza, []);
      grupos.get(it.poliza).push(it);
    }

    const total = grupos.size + (sueltos.length ? 1 : 0);
    let hechos = 0;
    const tocadas = new Set();

    for (const [poliza, items] of grupos) {
      cargando({ etapa: 'Leyendo la póliza ' + poliza, hechos, total });
      const v = tarjetaPara(poliza);
      tocadas.add(v);
      await volcar(v, items);
      hechos++;
      cargando({ etapa: 'Leyendo pólizas', hechos, total });
    }

    // 3. Lo que no trae número de póliza (el comprobante de pago, un escaneo): va a
    //    la tarjeta donde se soltó; si no hubo, a la única del lote; y si hay varias,
    //    se abre el PDF para ver a cuál pertenece antes de dejarlo en cualquiera.
    if (sueltos.length) {
      cargando({ etapa: 'Ubicando los documentos sueltos', hechos, total });
      const destino = destinoId ? state.viajeros.find(v => v.id === destinoId) : null;
      const conDatos = state.viajeros.filter(v => v.poliza || v.files.length);
      const unica = tocadas.size === 1 ? Array.from(tocadas)[0] : (conDatos.length === 1 ? conDatos[0] : null);
      for (const it of sueltos) {
        let v = destino || unica;
        if (!v && esPdfArchivo(it.f)) {
          const leido = await leerPdf(it.f);
          it.kind = leido.kind;
          const datos = VParse.extractAll(leido.texto);
          if (datos.poliza) { v = tarjetaPara(datos.poliza.toUpperCase()); asignarDatos(v, datos); }
        }
        if (!v) v = tarjetaPara('');
        await volcar(v, [it]);
      }
      hechos++;
    }

    cargando(null);
    syncEnvio();
    render();
    const asegurados = aseguradosReales();
    const arch = totalArchivos();
    avisar('✅ ' + asegurados + ' asegurado' + (asegurados === 1 ? '' : 's') + ' · ' +
           arch + ' archivo' + (arch === 1 ? '' : 's') + ' listos para adjuntar.');
  }

  // Mete los archivos de un grupo en su tarjeta y saca los datos de la póliza.
  async function volcar(v, items) {
    for (const it of items) {
      if (yaCargado(v, it.f)) { state.descartes.push({ nombre: it.f.name, motivo: 'ya estaba cargado' }); continue; }
      it.f.vKind = it.kind;
      v.files.push(it.f);
    }
    // La póliza es el único PDF que hay que leer: de la tarjeta no sale ningún dato
    // y abrirla costaba varios segundos por asegurado.
    const pol = items.find(i => i.kind === 'poliza' && esPdfArchivo(i.f));
    if (pol) asignarDatos(v, VParse.extractAll((await leerPdf(pol.f)).texto));
    // Un PDF que el nombre no alcanzó a clasificar: se abre para ver qué es.
    for (const it of items) {
      if (it.kind !== 'otro' || !esPdfArchivo(it.f)) continue;
      const leido = await leerPdf(it.f);
      it.f.vKind = leido.kind;
      if (leido.kind === 'poliza') asignarDatos(v, VParse.extractAll(leido.texto));
    }
  }

  function field(v, key, label, mono) {
    return `<label style="display:block"><span style="font-size:11px;color:#94a3b8">${label}</span>
      <input data-vid="${v.id}" data-key="${key}" value="${(v[key]||'').replace(/"/g,'&quot;')}" class="w-full text-sm border rounded px-2 py-1 ${mono?'font-mono':''}"/></label>`;
  }

  // ----- Archivos cargados por viajero -----
  const KIND_LABEL = { poliza: 'Póliza', tarjeta: 'Tarjeta', comprobante: 'Comprobante', otro: 'Otro' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function kindOf(f) { return f.vKind || VParse.classifyFile(f.name, ''); }
  function listaArchivos(v) {
    if (!v.files.length) return `<div class="text-xs text-slate-400 mb-2">Sin archivos cargados todavía.</div>`;
    // 🔴 Los nombres que manda el INS pasan los 70 caracteres
    // ("0221VIA040890800_054_540_Seguro_Viajero_con_Asis_Dolares_V4_20260621_204531.pdf").
    // En chips en línea empujaban la página a 578 px de ancho en un celular de 375:
    // una fila por archivo, con el nombre recortado, y el ancho vuelve a mandarlo
    // la pantalla. El nombre completo queda en el title, al pasar el mouse.
    const chips = v.files.map((f, i) => {
      const k = kindOf(f);
      const color = k === 'otro' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800';
      return `<span class="flex items-center gap-1.5 max-w-full ${color} rounded px-2 py-1 mb-1 text-[11px]">
        <b class="flex-none">${KIND_LABEL[k]}</b>
        <span class="truncate min-w-0 flex-1" title="${esc(f.name)}">${esc(f.name)}</span>
        <button onclick="VApp.quitarArchivo(${v.id},${i})" class="flex-none text-slate-400 hover:text-red-600 font-bold px-1" title="Quitar este archivo">&times;</button></span>`;
    }).join('');
    return `<div class="mb-2"><div class="text-[11px] text-slate-400 mb-1">${v.files.length} archivo${v.files.length > 1 ? 's' : ''} que se van a adjuntar</div>${chips}</div>`;
  }
  function quitarArchivo(vid, idx) {
    const v = state.viajeros.find(x => x.id === vid); if (!v) return;
    v.files.splice(idx, 1); state.sent = false; render();
  }

  // Tarjeta del paso 2: acá se revisan los datos. Los archivos se cargan en el
  // paso 1, así que sobra la zona de arrastre — queda solo la lista, con su ×
  // por si algo entró de más.
  function viajeroCard(v, idx) {
    const titulo = (v.cliente || '').trim() || `Asegurado ${idx + 1}`;
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between mb-3"><b class="text-sm" id="tit-v${v.id}">👤 ${esc(titulo)}</b>
        ${state.viajeros.length > 1 ? `<button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button>` : ''}</div>
      ${listaArchivos(v)}
      <div class="grid grid-cols-2 gap-2">
        ${field(v, 'cliente', 'Cliente')}${field(v, 'nombrePila', 'Saludo (nombre)')}
        ${field(v, 'poliza', 'N° Póliza', true)}${field(v, 'correo', 'Correo')}
        ${field(v, 'destino', 'Destino')}${field(v, 'gastosMedicos', 'Gastos médicos contratados')}
        ${field(v, 'vigenciaDesde', 'Desde')}${field(v, 'vigenciaHasta', 'Hasta')}
      </div></div>`;
  }

  // ----- Confirmación del envío -----
  // Con el correo ya enviado, el panel OCUPA el lugar de los botones: además de
  // dejar claro que salió, quita la tentación de volver a hacer clic en Enviar y
  // mandarle el correo dos veces al cliente. Si el agente se pasa a un canal de
  // WhatsApp, el panel se encoge a una franja para no estorbar ese envío.
  function datoEnvio(valor, etiqueta) {
    return `<div class="flex-1 px-1.5">
      <div class="text-base font-bold" style="color:#14532d">${esc(valor)}</div>
      <div class="text-[10px] uppercase tracking-wide mt-px" style="color:#4d7c5f">${etiqueta}</div></div>`;
  }
  function panelExito() {
    const e = state.envio || {};
    return `<div class="v-pop border-2 border-green-300 rounded-2xl p-6 text-center mt-3" style="background:linear-gradient(180deg,#f0fdf4 0%,#ffffff 78%)">
      <div class="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style="background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 0 0 7px rgba(34,197,94,.14)">
        <svg viewBox="0 0 24 24" class="v-check w-7 h-7"><path d="M4.5 12.5l5 5 10-10" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h3 class="text-lg font-bold" style="color:#14532d">Correo enviado</h3>
      <p class="text-sm mt-0.5" style="color:#166534">a <b class="font-semibold">${esc((e.to || []).join(', '))}</b></p>
      <div class="flex justify-center mt-4 pt-3.5 border-t border-green-100 mx-auto" style="max-width:430px">
        ${datoEnvio(e.viajeros, e.viajeros === 1 ? 'Viajero' : 'Viajeros')}
        ${datoEnvio(e.adjuntos, e.adjuntos === 1 ? 'Adjunto' : 'Adjuntos')}
        ${datoEnvio(e.hora, 'Hora')}
      </div>
      <div class="flex flex-wrap justify-center gap-2 mt-4">
        <button onclick="VApp.setCanal('emitida')" class="text-white text-xs font-semibold rounded-lg px-3.5 py-2 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95" style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%)">Seguir por WhatsApp</button>
        <button onclick="VApp.pedirLimpiar()" class="text-xs font-semibold border rounded-lg px-3.5 py-2 bg-white hover:bg-slate-50">Enviar a otro cliente</button>
      </div></div>`;
  }
  function bannerExito() {
    const e = state.envio || {};
    return `<div class="v-pop flex items-center gap-3 rounded-lg mt-3 px-4 py-3 bg-green-50 border-l-4 border-green-600">
      <div class="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-none">✓</div>
      <div><div class="text-sm font-bold" style="color:#14532d">Correo enviado a ${esc((e.to || []).join(', '))}</div>
        <div class="text-xs" style="color:#3f6b4d">${e.viajeros} ${e.viajeros === 1 ? 'viajero' : 'viajeros'} · ${e.adjuntos} ${e.adjuntos === 1 ? 'adjunto' : 'adjuntos'} · ${esc(e.hora)}</div></div>
      <div class="flex-1"></div>
      <button onclick="VApp.pedirLimpiar()" class="text-xs font-semibold border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 whitespace-nowrap flex-none">Enviar a otro cliente</button></div>`;
  }
  function nuevoEnvio() {
    state.viajeros = []; state.destinatarios = []; state.saludo = ''; state.poliza = '';
    state.asegurados = []; state.tel = ''; asegManual = false;
    state.canal = 'correo'; state.sent = false; state.envio = null;
    state.cargando = null; state.descartes = [];
    state.paso = 1; // el siguiente cliente arranca por donde se arranca siempre
    // Ya no se deja una tarjeta vacía esperando: la zona de carga del paso 1 es la
    // que arma las tarjetas, una por póliza, apenas caen los ZIP.
    syncEnvio(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════ Los tres pasos ═══════════════
  // La barra de pasos dejó de ser un dibujo: es la navegación. Los tres puntos
  // se pueden tocar siempre — el paso 3 valida por su cuenta antes de enviar,
  // así que nunca hay que dejar al agente encerrado en un paso.
  const PASOS = ['Cargar', 'Revisar', 'Enviar'];
  function irA(p) {
    state.paso = Math.min(3, Math.max(1, p));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function totalArchivos() { return state.viajeros.reduce((s, v) => s + v.files.length, 0); }
  function totalAdjuntos() { return totalArchivos() + (VCfg.STANDARD_DOCS || []).length; }

  function rail() {
    const punto = i => {
      const n = i + 1;
      const hecho = state.sent || n < state.paso;
      const aqui = n === state.paso;
      const cls = hecho ? 'bg-green-600 text-white' : aqui ? 'bg-sdi-azul text-white' : 'bg-slate-200 text-slate-400';
      const anillo = aqui ? 'box-shadow:0 0 0 4px rgba(3,105,161,.16)' : '';
      const txt = aqui ? 'text-slate-800 font-bold' : hecho ? 'text-slate-600' : 'text-slate-400';
      return `<button onclick="VApp.irA(${n})" class="flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-slate-100 transition-colors" ${aqui ? 'aria-current="step"' : ''}>
        <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-none ${cls}" style="${anillo}">${hecho ? '✓' : n}</span>
        <span class="text-sm ${txt} whitespace-nowrap">${PASOS[i]}</span></button>`;
    };
    const linea = i => `<div class="flex-1 h-0.5 rounded mx-2 sm:mx-3 min-w-[16px] ${(state.sent || state.paso > i + 1) ? 'bg-green-600' : 'bg-slate-200'}"></div>`;
    return `<div class="flex items-center mb-5">${punto(0)}${linea(0)}${punto(1)}${linea(1)}${punto(2)}</div>`;
  }

  // Botón de avance de los pasos 1 y 2. Nunca se bloquea: los datos se pueden
  // escribir a mano y hay clientes que compraron por su cuenta (sin PDF).
  function botonSiguiente(texto, sub) {
    return `<div class="mt-4">
      <button onclick="VApp.irA(${state.paso + 1})" class="w-full text-white text-sm font-semibold rounded-xl px-4 py-3.5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0" style="background:linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)">${texto}</button>
      ${sub ? `<p id="paso-sub" class="text-[11px] text-slate-400 mt-1.5 text-center">${sub}</p>` : ''}
    </div>`;
  }
  function botonAtras(texto) {
    return `<button onclick="VApp.irA(${state.paso - 1})" class="text-sm text-slate-500 hover:text-slate-800 mb-3">← ${texto}</button>`;
  }
  // Con la lista vacía no hay ningún "otro": el botón es la salida para el cliente
  // sin PDF, y con la lista llena es el botón de agregar uno más al mismo correo.
  function ghostAgregar() {
    const t = state.viajeros.length
      ? '+ Agregar otro asegurado al mismo correo'
      : '+ Escribir los datos a mano, sin PDF';
    return `<button onclick="VApp.addViajero()" class="w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm font-semibold text-sdi-azul hover:bg-blue-50 transition-colors">${t}</button>`;
  }

  // ---- Paso 1: cargar ----
  // La zona grande es la entrada principal: recibe el ZIP tal como lo manda el INS
  // —uno por póliza—, la carpeta entera, o los PDF sueltos de siempre. Antes acá
  // no había NADA hasta agregar un asegurado a mano: la consola abría sin una sola
  // zona donde soltar los archivos.
  function zonaLote() {
    return `<div id="zona-lote" class="border-2 border-dashed border-sdi-azul rounded-2xl px-5 py-7 text-center bg-blue-50 cursor-pointer transition-colors mb-4">
      <div class="text-3xl leading-none mb-2">🗂️</div>
      <div class="text-sm font-bold text-slate-800">Arrastrá acá los ZIP tal como los manda el INS</div>
      <p class="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-md mx-auto">Uno por asegurado o los nueve juntos: se abren solos y se arma <b>una tarjeta por póliza</b>, con la oferta-constancia y la tarjeta de asistencia listas para adjuntar.</p>
      <div class="flex flex-wrap gap-2 justify-center mt-4">
        <button type="button" onclick="VApp.elegirArchivos()" class="text-white text-xs font-semibold rounded-lg px-3.5 py-2 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95" style="background:linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)">Elegir archivos o ZIP</button>
        <button type="button" onclick="VApp.elegirCarpeta()" class="text-xs font-semibold border rounded-lg px-3.5 py-2 bg-white hover:bg-slate-50">Elegir una carpeta</button>
      </div>
      <p class="text-[11px] text-slate-400 mt-2.5">También sirve para PDF sueltos. Las Condiciones Generales que vienen dentro del ZIP no se adjuntan otra vez: el correo ya las lleva.</p>
      <input id="fi-lote" type="file" class="hidden" multiple accept=".zip,application/zip,application/x-zip-compressed,application/pdf,.pdf,image/*">
      <input id="fi-carpeta" type="file" class="hidden" multiple webkitdirectory directory>
    </div>`;
  }

  // Lo que vino en el ZIP y NO se adjunta se dice, no se descarta en silencio: la
  // pérdida callada de un archivo ya costó un incidente el 3 ago 2026.
  function bloqueDescartes() {
    const d = state.descartes || [];
    if (!d.length) return '';
    const filas = d.map(x => `<li><b class="text-slate-600">${esc(x.nombre)}</b> — ${esc(x.motivo)}</li>`).join('');
    return `<details class="border rounded-xl bg-slate-50 px-4 py-2.5 mb-3">
      <summary class="text-[11px] text-slate-500 cursor-pointer select-none hover:text-slate-700">${d.length} archivo${d.length === 1 ? '' : 's'} del ZIP no se ${d.length === 1 ? 'adjunta' : 'adjuntan'} · ver cuáles</summary>
      <ul class="text-[11px] text-slate-500 mt-2 space-y-1 list-disc pl-4 leading-relaxed">${filas}</ul>
    </details>`;
  }

  function pantalla1() {
    const n = totalArchivos();
    const a = aseguradosReales();
    const sub = n
      ? `${a} asegurado${a === 1 ? '' : 's'} y ${n} archivo${n === 1 ? '' : 's'} listos. En el siguiente paso revisás los datos que salieron de las pólizas.`
      : 'Todavía no cargaste ningún archivo. Podés seguir igual y escribir los datos a mano.';
    return `<h3 class="text-base font-bold text-slate-800 mb-0.5">Cargá los documentos</h3>
      <p class="text-xs text-slate-500 mb-4">De cada póliza se leen solos el nombre, el número, el destino, la vigencia y el correo del cliente.</p>
      ${zonaLote()}
      <div id="carga"></div>
      ${bloqueDescartes()}
      ${state.viajeros.map(cardCarga).join('')}
      ${ghostAgregar()}
      ${botonSiguiente('Continuar a revisar los datos →', sub)}
      <div class="text-center mt-5 pt-4 border-t">
        <button onclick="VApp.sinPoliza()" class="text-xs text-slate-500 underline underline-offset-2 hover:text-sdi-azul">El cliente compró por su cuenta y solo le mando el link de la guía →</button>
      </div>`;
  }
  function cardCarga(v, idx) {
    const titulo = (v.cliente || '').trim() || `Asegurado ${idx + 1}`;
    const chipPol = v.poliza ? `<span class="font-mono text-[11px] bg-blue-50 text-sdi-azul rounded px-2 py-0.5">${esc(v.poliza)}</span>` : '';
    const tieneComprobante = v.files.some(f => kindOf(f) === 'comprobante');
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between gap-2 mb-3">
        <b class="text-sm truncate">👤 ${esc(titulo)}</b>
        <span class="flex items-center gap-2 flex-none">${chipPol}
        <button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button></span>
      </div>
      <div class="mt-3">${listaArchivos(v)}</div>
      <div class="dropzone border-2 border-dashed rounded-lg p-3 text-center text-xs text-slate-500 cursor-pointer hover:bg-blue-50 transition-colors" data-vid="${v.id}">
        ${tieneComprobante ? 'Agregar otro documento de este asegurado' : 'Falta el comprobante de pago u otro documento de este asegurado'}: <span class="text-sdi-azul font-medium underline">arrastralo acá o hacé clic</span>
        <input type="file" class="hidden" multiple accept=".zip,application/zip,application/x-zip-compressed,application/pdf,.pdf,image/*">
      </div></div>`;
  }

  // ---- Paso 2: revisar ----
  function pantalla2() {
    return `${botonAtras('Volver a cargar documentos')}
      <h3 class="text-base font-bold text-slate-800 mb-0.5">Revisá lo que salió del PDF</h3>
      <p class="text-xs text-slate-500 mb-4">Todo se puede corregir a mano. Lo que quede acá es lo que va a ver el cliente en su correo.</p>
      ${state.viajeros.map(viajeroCard).join('') || '<p class="text-slate-500 text-sm mb-3">No hay asegurados cargados.</p>'}
      ${ghostAgregar()}
      <div class="border rounded-xl p-4 bg-white mt-3">
        <b class="text-sm block mb-2">¿A quién le llega?</b>
        <label class="block mb-2"><span class="text-xs text-slate-400">Correo del cliente (varios, separados por coma)</span>
          <input id="dest" value="${state.destinatarios.join(', ')}" class="w-full text-sm border rounded px-2 py-1"/></label>
        <label class="block"><span class="text-xs text-slate-400">Saludo (así lo saluda el correo)</span>
          <input id="saludo" value="${state.saludo.replace(/"/g, '&quot;')}" class="w-full text-sm border rounded px-2 py-1"/></label>
      </div>
      ${botonSiguiente('Continuar a enviar →', subPaso2())}`;
  }
  // El aviso de abajo tiene que SEGUIR al campo mientras el agente escribe: si
  // solo se recalculara en el render(), diría "falta el correo" con el correo
  // ya escrito. Lo repinta wire() sin redibujar, para no perder el foco.
  function subPaso2() {
    return state.destinatarios.length
      ? 'En el siguiente paso elegís si va por correo o por WhatsApp.'
      : 'Sin el correo del cliente se puede mandar el WhatsApp, pero no el correo.';
  }

  // ---- Paso 3: enviar ----
  const CANALES = [
    { id: 'correo', ico: '📧', tit: 'Correo con los documentos', reco: true,
      desc: 'Le llegan la póliza, la tarjeta, el comprobante, las Condiciones Generales y el Manual, más el botón a su guía de emergencias.' },
    { id: 'emitida', ico: '💬', tit: 'WhatsApp · póliza que emití yo',
      desc: 'Mensaje de aviso con el número de póliza y el link de la guía. Los documentos van por correo, no por acá.' },
    { id: 'directa', ico: '💬', tit: 'WhatsApp · compró por su cuenta',
      desc: 'Mensaje para el cliente al que no le emití yo la póliza: solo el link de la guía.' }
  ];
  function canalPick(c) {
    const on = state.canal === c.id;
    return `<button onclick="VApp.setCanal('${c.id}')" class="w-full text-left flex gap-3 items-start rounded-xl p-3.5 mb-2 transition-colors ${on ? 'border-2 border-sdi-azul bg-blue-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}">
      <span class="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-none ${on ? 'bg-blue-100' : 'bg-slate-100'}">${c.ico}</span>
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-bold text-slate-800">${c.tit}${c.reco ? '<span class="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide bg-sdi-azul text-white rounded-full px-2 py-0.5">lo normal</span>' : ''}</span>
        <span class="block text-[11px] text-slate-500 leading-relaxed mt-0.5">${c.desc}</span>
      </span>
      ${on ? '<span class="text-sdi-azul font-bold flex-none">✓</span>' : ''}</button>`;
  }
  // Resumen del correo, con atajos para devolverse a corregir. Solo en correo:
  // en WhatsApp el bloque del teléfono ya dice con qué número se abre el chat.
  function resumenCorreo() {
    const celda = (k, v, accion) => `<div class="flex-1 min-w-[110px] px-3 border-r last:border-r-0">
      <div class="text-[9.5px] uppercase tracking-wide text-slate-400">${k}</div>
      <div class="text-[12.5px] font-semibold text-slate-800 mt-0.5 break-words">${v}</div>
      ${accion || ''}</div>`;
    const cambiar = `<button onclick="VApp.irA(2)" class="text-[10.5px] text-sdi-azul underline">cambiar</button>`;
    const nv = state.viajeros.length;
    const nombres = state.viajeros.map(v => (v.nombrePila || v.cliente || '').trim()).filter(Boolean);
    return `<div class="flex flex-wrap bg-slate-50 border rounded-xl py-3 px-1 my-4">
      ${celda('Le llega a', esc(state.destinatarios.join(', ')) || '<span class="text-red-500">falta el correo</span>', cambiar)}
      ${celda('Asegurados', nv + (nombres.length ? ' · ' + esc(unir(nombres)) : ''), cambiar)}
      ${celda('Adjuntos', totalAdjuntos() + ' archivos', `<button onclick="VApp.irA(1)" class="text-[10.5px] text-sdi-azul underline">ver cuáles</button>`)}
    </div>`;
  }
  function pantalla3() {
    const esWa = state.canal !== 'correo';
    const exito = state.sent && state.envio;
    // Con el correo ya enviado, el panel de éxito OCUPA el lugar del botón: es
    // lo que impide mandarle el mismo correo dos veces al cliente.
    if (exito && !esWa) {
      return `${botonAtras('Volver a revisar')}
        ${CANALES.map(canalPick).join('')}
        ${panelExito()}`;
    }
    const listo = !esWa || telOk();
    const texto = esc(textoBoton());
    return `${botonAtras('Volver a revisar')}
      <h3 class="text-base font-bold text-slate-800 mb-0.5">¿Cómo se lo mandás${state.saludo ? ' a ' + esc(state.saludo) : ''}?</h3>
      <p class="text-xs text-slate-500 mb-4">Elegí uno. Podés mandar el correo primero y el WhatsApp después.</p>
      ${CANALES.map(canalPick).join('')}
      <div id="canalbox" class="mt-3"></div>
      ${exito ? bannerExito() : ''}
      ${esWa ? '' : resumenCorreo()}
      <button onclick="VApp.enviar()" id="btn-enviar" ${listo ? '' : 'disabled'} class="w-full text-white text-sm font-semibold rounded-xl px-4 py-3.5 mt-3 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 active:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm" style="background:${(esWa && listo) ? 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)' : 'linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)'}">${texto}</button>
      ${esWa ? '' : '<div class="text-center"><button onclick="VApp.preview()" class="text-xs text-sdi-azul underline underline-offset-2 mt-2.5 hover:text-sdi-azulD">Ver primero cómo le va a llegar →</button></div>'}`;
  }
  // Atajo del paso 1 para el cliente que compró por su cuenta: no hay PDF que
  // cargar ni datos que revisar, así que salta directo al mensaje.
  function sinPoliza() { state.canal = 'directa'; irA(3); }
  function render() {
    const p = state.paso;
    el('console').innerHTML = `
      ${avisoPermiso()}
      ${agentePanel()}
      <div class="flex items-center justify-between gap-2 mb-4">
        <h2 class="text-lg font-bold">Envío de pólizas</h2>
        ${hayAlgoQueLimpiar() ? '<button onclick="VApp.pedirLimpiar()" class="text-sm font-medium border rounded-lg px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50 whitespace-nowrap flex-none">🧹 Limpiar</button>' : ''}
      </div>
      ${rail()}
      ${p === 1 ? pantalla1() : p === 2 ? pantalla2() : pantalla3()}
      <p id="status" class="text-sm mt-3"></p>`;
    wire();
    pintarCarga(); // sobrevive a un redibujado disparado en plena carga
    if (p === 3) renderCanal();
  }

  function readAgentForm() {
    const a = VAgent.get();
    el('console').querySelectorAll('input[data-ag]').forEach(inp => { a[inp.dataset.ag] = inp.value; });
    return a;
  }
  function agentToggle() { agentOpen = !agentOpen; render(); }
  function agentSave() { VAgent.save(readAgentForm()); render(); el('status') && (el('status').textContent = '✅ Tu información de agente fue guardada en este navegador.'); }
  function agentReset() { VAgent.reset(); render(); }
  function agentCopyLink() {
    const inp = el('ag-link'); if (!inp) return;
    const done = () => { const b = el('ag-link'); if (b) b.classList.add('ring-2','ring-green-400'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done).catch(() => { inp.select(); document.execCommand('copy'); done(); });
    else { inp.select(); document.execCommand('copy'); done(); }
  }
  function agentPreviewLink() { const inp = el('ag-link'); if (inp) window.open(inp.value, '_blank', 'noopener'); }

  function wire() {
    el('console').querySelectorAll('input[data-vid]').forEach(inp => inp.addEventListener('input', e => {
      const v = state.viajeros.find(x => x.id == e.target.dataset.vid); if (v) v[e.target.dataset.key] = e.target.value;
      // Corregir la póliza o el nombre en la tarjeta también refresca lo que sale
      // en el mensaje de WhatsApp. Se tocan solo los inputs, sin render(), para no
      // perder el foco mientras el agente escribe.
      // El encabezado de la tarjeta lleva el nombre: si no lo seguimos mientras
      // se escribe, con dos asegurados quedan dos tarjetas "Asegurado 1/2" hasta
      // el siguiente redibujado y no se sabe cuál es cuál.
      if (v && e.target.dataset.key === 'cliente') {
        const t = el('tit-v' + v.id);
        if (t) t.textContent = '👤 ' + ((v.cliente || '').trim() || ('Asegurado ' + (state.viajeros.indexOf(v) + 1)));
      }
      if (!asegManual && (e.target.dataset.key === 'poliza' || e.target.dataset.key === 'cliente')) {
        state.asegurados = aseguradosAuto();
        state.poliza = polizasAuto();
        state.asegurados.forEach((a, i) => {
          const p = el('aseg-p-' + i), nm = el('aseg-n-' + i);
          if (p) p.value = a.poliza;
          if (nm) nm.value = a.nombre;
        });
      }
    }));
    el('dest') && el('dest').addEventListener('input', e => {
      state.destinatarios = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      const s = el('paso-sub'); if (s) s.textContent = subPaso2();
    });
    el('saludo') && el('saludo').addEventListener('input', e => state.saludo = e.target.value);
    // Zona grande del paso 1: ZIP, carpeta o archivos sueltos.
    const zl = el('zona-lote');
    if (zl) {
      const fl = el('fi-lote'), fc = el('fi-carpeta');
      // El clic en los dos botones de adentro no debe disparar también el selector
      // de archivos de la zona, o se abren dos ventanas del sistema encimadas.
      zl.addEventListener('click', e => { if (e.target.closest('button') || e.target.tagName === 'INPUT') return; fl.click(); });
      const desdeInput = e => { const copia = Array.from(e.target.files || []); e.target.value = ''; procesarEntrada(copia); };
      fl.addEventListener('change', desdeInput);
      fc.addEventListener('change', desdeInput);
      // El resaltado va por estilo directo: con dos clases de fondo de Tailwind
      // (bg-blue-50 de base y bg-blue-100 al arrastrar) gana la que la hoja emita
      // de última, y eso no está bajo nuestro control.
      const prender = () => { zl.style.background = '#dbeafe'; zl.style.borderStyle = 'solid'; };
      const apagar = () => { zl.style.background = ''; zl.style.borderStyle = ''; };
      zl.addEventListener('dragover', e => { e.preventDefault(); prender(); });
      zl.addEventListener('dragleave', apagar);
      zl.addEventListener('drop', e => {
        e.preventDefault(); apagar();
        soltar(e.dataTransfer); // 🔴 copia sincrónica adentro, antes de cualquier await
      });
    }
    // Zona chica de cada tarjeta: sirve para el comprobante. Lo que traiga número
    // de póliza igual se va con SU póliza, no con la tarjeta donde se soltó.
    el('console').querySelectorAll('.dropzone').forEach(dz => {
      const fi = dz.querySelector('input[type=file]');
      dz.addEventListener('click', e => { if (e.target !== fi) fi.click(); });
      fi.addEventListener('change', e => { const copia = Array.from(e.target.files || []); e.target.value = ''; procesarEntrada(copia, +dz.dataset.vid); });
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('bg-blue-50'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('bg-blue-50'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('bg-blue-50'); soltar(e.dataTransfer, +dz.dataset.vid); });
    });
  }

  function setCanal(c) {
    state.canal = c;
    state.paso = 3; // "Seguir por WhatsApp" del panel de éxito entra por acá
    render();
    // Al entrar a WhatsApp el cursor cae solo en el teléfono: es lo único que
    // falta y el motivo por el que el agente entró acá.
    if (c !== 'correo') { const t = el('watel'); if (t) t.focus(); }
  }
  function renderCanal() {
    if (!el('canalbox')) return; // el panel de éxito reemplaza al canalbox
    // En correo no hay nada que configurar: la tarjeta del canal ya explica qué
    // se manda, y el resumen de abajo dice a quién. Repetirlo acá era ruido.
    if (state.canal === 'correo') { el('canalbox').innerHTML = ''; return; }
    const tipo = state.canal, txt = VWa.getTemplate(tipo);
    const n = state.asegurados.length;
    const filas = state.asegurados.map((a, i) => `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <label class="block"><span class="text-[11px] text-slate-400">N° de póliza${n > 1 ? ' · asegurado ' + (i + 1) : ''}</span>
          <input id="aseg-p-${i}" data-aseg="${i}" data-campo="poliza" value="${esc(a.poliza)}" placeholder="0201VIA000000000" class="w-full text-sm border rounded px-2 py-1 font-mono"/></label>
        <label class="block"><span class="text-[11px] text-slate-400">Nombre del asegurado</span>
          <input id="aseg-n-${i}" data-aseg="${i}" data-campo="nombre" value="${esc(a.nombre)}" placeholder="Como aparece en la póliza" class="w-full text-sm border rounded px-2 py-1"/></label>
      </div>`).join('');
    const hayDatos = state.asegurados.some(a => a.poliza || a.nombre);
    el('canalbox').innerHTML = `<div class="border rounded-xl p-3 bg-white">
      ${bloqueTel()}
      <div class="mt-3 mb-1 flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-600">Lo que va en el mensaje</span>
        ${(!asegManual && hayDatos) ? '<span class="text-[10px] font-bold bg-blue-100 text-sdi-azul rounded-full px-2 py-0.5">tomado del PDF</span>' : ''}
      </div>
      ${filas}
      <textarea id="watxt" rows="6" class="w-full text-sm border rounded px-2 py-1 mt-1">${txt.replace(/</g,'&lt;')}</textarea>
      <p class="text-[11px] text-slate-400 mt-1">Comodines: <code>{Nombre}</code> = nombre del cliente · <code>{Agente}</code> = tu nombre · <code>{Link}</code> = tu link personalizado de la app · <code>{Asegurados}</code> = las pólizas de arriba con su nombre debajo.</p>
      <p class="text-[11px] text-slate-400">Si no hay ninguna póliza ni nombre, esa parte no aparece en el mensaje.</p>
      <div class="flex gap-2 mt-2"><button onclick="VApp.waSave()" class="text-xs border rounded px-2 py-1">Guardar como predeterminado</button>
      <button onclick="VApp.waReset()" class="text-xs border rounded px-2 py-1">Restaurar</button></div></div>`;
    // Estos campos se cablean acá porque wire() corre ANTES de que exista el canalbox.
    const tel = el('watel');
    if (tel) tel.addEventListener('input', e => { state.tel = e.target.value; pintarTel(); });
    el('canalbox').querySelectorAll('input[data-aseg]').forEach(inp => inp.addEventListener('input', e => {
      const a = state.asegurados[+e.target.dataset.aseg]; if (!a) return;
      a[e.target.dataset.campo] = e.target.value;
      asegManual = true; // a partir de acá manda lo que escribió el agente
      state.poliza = polizasAuto();
    }));
  }

  // El teléfono es el ÚNICO dato que no viene en el PDF y el único que falta al
  // pasarse a WhatsApp: por eso va como bloque, no como una línea más. Ámbar
  // mientras falta, verde con el número confirmado cuando ya está.
  function bloqueTel() {
    const ok = telOk();
    return `<div id="tel-box" class="flex gap-3 items-start rounded-xl p-3.5 border-2 ${ok ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}">
      <div id="tel-ic" class="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-none ${ok ? 'bg-green-100' : 'bg-amber-100'}">${ok ? '✅' : '📱'}</div>
      <div class="flex-1 min-w-0">
        <div id="tel-tit" class="text-sm font-bold ${ok ? 'text-green-900' : 'text-amber-900'}">${ok ? 'Teléfono del cliente' : 'Falta el teléfono del cliente'}</div>
        <input id="watel" value="${esc(state.tel)}" placeholder="8888 8888" inputmode="tel" autocomplete="off"
          class="w-full mt-1.5 border-2 rounded-lg px-3 py-2 text-base tracking-wide ${ok ? 'border-green-300' : 'border-amber-300'}"/>
        <div id="tel-pie" class="text-[11px] mt-1.5 ${ok ? 'text-green-800' : 'text-amber-700'}">${ok ? 'Se va a abrir el chat con <b>+' + esc(telConCodigo()) + '</b>' : 'Es el único dato que no viene en la póliza. Sin él no se puede abrir el chat.'}</div>
      </div></div>`;
  }
  // Repinta el bloque y el botón sin render(), para no perder el foco mientras
  // el agente escribe el número.
  function pintarTel() {
    const box = el('tel-box'); if (!box) return;
    const ok = telOk();
    box.className = 'flex gap-3 items-start rounded-xl p-3.5 border-2 ' + (ok ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50');
    const ic = el('tel-ic');
    ic.textContent = ok ? '✅' : '📱';
    ic.className = 'w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-none ' + (ok ? 'bg-green-100' : 'bg-amber-100');
    const tit = el('tel-tit');
    tit.textContent = ok ? 'Teléfono del cliente' : 'Falta el teléfono del cliente';
    tit.className = 'text-sm font-bold ' + (ok ? 'text-green-900' : 'text-amber-900');
    const pie = el('tel-pie');
    pie.innerHTML = ok ? 'Se va a abrir el chat con <b>+' + esc(telConCodigo()) + '</b>'
      : 'Es el único dato que no viene en la póliza. Sin él no se puede abrir el chat.';
    pie.className = 'text-[11px] mt-1.5 ' + (ok ? 'text-green-800' : 'text-amber-700');
    const inp = el('watel');
    inp.classList.toggle('border-green-300', ok);
    inp.classList.toggle('border-amber-300', !ok);
    pintarBoton();
  }
  // Misma etiqueta que arma pantalla3(): si las dos se separan, el botón cambia
  // de texto solo por escribir el teléfono.
  function textoBoton() {
    const esWa = state.canal !== 'correo';
    if (esWa) return telOk() ? 'Abrir WhatsApp' : 'Escribí el teléfono del cliente';
    return 'Enviar el correo' + (state.destinatarios[0] ? ' a ' + state.destinatarios[0] : '');
  }
  function pintarBoton() {
    const b = el('btn-enviar'); if (!b) return;
    const esWa = state.canal !== 'correo';
    const ok = !esWa || telOk();
    b.disabled = !ok;
    b.textContent = textoBoton();
    b.style.background = (esWa && ok) ? 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)' : 'linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)';
  }
  function waSave() { VWa.saveTemplate(state.canal, el('watxt').value); el('status').textContent = 'Plantilla guardada.'; }
  function waReset() { el('watxt').value = VWa.resetTemplate(state.canal); }

  function preview() {
    if (state.canal === 'correo') {
      const w = window.open('', '_blank');
      // Si el navegador bloqueó la ventana emergente, w viene null y esto
      // reventaba con un error crudo en la consola, sin decirle nada al agente.
      if (!w) { const st = el('status'); if (st) st.textContent = 'El navegador bloqueó la ventana de la vista previa. Permitila para este sitio e intentá de nuevo.'; return; }
      w.document.write(VEmail.buildHtml(state));
    }
    else {
      window.open(VWa.buildLink(state.tel, el('watxt').value, state.saludo, VAgent.get().nombre, state.poliza, state.asegurados), '_blank');
    }
  }

  async function enviar() {
    const st = el('status'); st.textContent = '';
    if (state.canal !== 'correo') {
      // Con el teléfono vacío, el link abría WhatsApp sin destinatario y fallaba
      // en silencio. Ahora no se abre nada y se dice qué falta.
      if (!telOk()) {
        st.textContent = 'Escribí el teléfono del cliente para abrir el chat.';
        const t = el('watel'); if (t) t.focus();
        return;
      }
      return preview();
    }
    if (!state.viajeros.length) { st.textContent = 'Agregá al menos un viajero.'; return; }
    if (!state.destinatarios.length) { st.textContent = 'Indicá al menos un destinatario.'; return; }
    el('btn-enviar').disabled = true;
    try {
      // Primero el permiso: la pantalla de Google se abre acá, montada sobre el
      // clic del agente (si se pide después de preparar los adjuntos, el
      // navegador puede bloquear la ventana emergente).
      if (!VAuth.canSend()) {
        st.textContent = 'Falta el permiso de envío, pidiéndolo a Google…';
        await VAuth.grantSend();
        if (!VAuth.canSend()) { render(); el('status').textContent = '❌ ' + msgError('403 insufficient'); return; }
        render();
      }
      st.textContent = 'Preparando adjuntos…';
      const att = [];
      for (const v of state.viajeros) for (const f of v.files) att.push({ name: f.name, mime: f.type, b64: await VEmail.fileToB64(f) });
      for (const d of VCfg.STANDARD_DOCS) att.push({ name: d.name, mime: 'application/pdf', b64: await VEmail.pathToB64(d.path) });
      st.textContent = 'Enviando correo…';
      let token = await VAuth.ensureToken();
      try {
        await VEmail.buildAndSend(state, att, token);
      } catch (e) {
        if (esErrorDePermiso(e.message)) {
          // El token venía sin el permiso de envío: pedirlo y reintentar.
          st.textContent = 'Falta el permiso de envío, pidiéndolo a Google…';
          token = (await VAuth.grantSend()).token;
          if (!VAuth.canSend()) throw e;
          await VEmail.buildAndSend(state, att, token);
        } else if (/\b401\b|UNAUTHENTICATED|invalid|expired/i.test(e.message)) {
          st.textContent = 'Sesión vencida, reconectando…';
          token = (await VAuth.signIn()).token;
          await VEmail.buildAndSend(state, att, token);
        } else { throw e; }
      }
      state.sent = true;
      state.envio = {
        to: state.destinatarios.slice(),
        viajeros: state.viajeros.length,
        adjuntos: att.length,
        hora: new Date().toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' })
      };
      render(); // el panel de confirmación reemplaza a los botones
    } catch (e) { render(); el('status').textContent = '❌ ' + msgError(e); }
    finally { const b = el('btn-enviar'); if (b) b.disabled = false; }
  }

  function boot() { try { VAuth.init(); } catch (e) {} el('btn-login').addEventListener('click', login); }
  return { boot, login, addViajero, removeViajero, quitarArchivo, setCanal, waSave, waReset, preview, enviar,
    irA, sinPoliza, nuevoEnvio, pedirLimpiar, pedirPermiso, agentToggle, agentSave, agentReset, agentCopyLink, agentPreviewLink,
    elegirArchivos, elegirCarpeta, procesarEntrada, state };
})();
document.addEventListener('DOMContentLoaded', () => VApp.boot());
