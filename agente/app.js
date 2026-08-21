// agente/app.js — UI de la consola: login, lista de viajeros, canales, envío.
window.VApp = (function () {
  // asegurados = [{poliza, nombre}] — lo que sale en el mensaje de WhatsApp.
  // tel = teléfono del cliente; se guarda en el estado porque antes vivía solo en
  // el input y cualquier render() lo borraba en silencio.
  // paso = la pantalla que se ve: 1 cargar · 2 revisar · 3 enviar. Desde el
  // 21 ago la consola muestra UNA sola por vez (opción A del rediseño): antes
  // todo vivía en el mismo scroll y los tres botones de canal se confundían
  // con los dos de envío.
  const state = { paso: 1, viajeros: [], destinatarios: [], saludo: '', poliza: '', asegurados: [], tel: '', canal: 'correo', sent: false, envio: null };
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

  function pushViajero() {
    state.sent = false;
    state.viajeros.push({ id: nextId++, cliente: '', nombrePila: '', poliza: '', cedula: '', destino: '', gastosMedicos: '', vigenciaDesde: '', vigenciaHasta: '', correo: '', files: [] });
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

  // 🔴 La FileList que entrega el navegador es VIVA, no una copia: el handler del
  // input la vacía (`fi.value = ''`) apenas este for cede el control en el primer
  // `await`, y el DataTransfer del arrastre se neutraliza al terminar el evento.
  // Sin la copia sincrónica de abajo, el ciclo moría después del PRIMER archivo:
  // se guardaba solo la póliza y la tarjeta/comprobante se perdían en silencio.
  async function onFiles(viajeroId, fileList) {
    const v = state.viajeros.find(x => x.id === viajeroId); if (!v) return;
    const entrantes = Array.from(fileList || []);
    if (!entrantes.length) return;
    state.sent = false;
    for (const f of entrantes) {
      v.files.push(f);
      const esPdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
      const text = esPdf ? await VParse.readPdfText(f).catch(() => '') : '';
      const kind = VParse.classifyFile(f.name, text);
      f.vKind = kind; // se recuerda la clasificación (acá sí tenemos el texto del PDF)
      if (kind === 'poliza') { Object.assign(v, VParse.extractAll(text)); }
    }
    syncEnvio(); render();
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
    const chips = v.files.map((f, i) => {
      const k = kindOf(f);
      const color = k === 'otro' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800';
      return `<span class="inline-flex items-center gap-1 ${color} rounded px-2 py-0.5 mr-1 mb-1 text-[11px]">
        <b>${KIND_LABEL[k]}</b> ${esc(f.name)}
        <button onclick="VApp.quitarArchivo(${v.id},${i})" class="text-slate-400 hover:text-red-600 font-bold" title="Quitar este archivo">&times;</button></span>`;
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
    state.paso = 1; // el siguiente cliente arranca por donde se arranca siempre
    pushViajero(); // sin preguntar: el agente acaba de pedir empezar de cero
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
  function ghostAgregar() {
    return `<button onclick="VApp.addViajero()" class="w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm font-semibold text-sdi-azul hover:bg-blue-50 transition-colors">+ Agregar otro asegurado al mismo correo</button>`;
  }

  // ---- Paso 1: cargar ----
  function pantalla1() {
    const n = totalArchivos();
    const sub = n
      ? `${n} archivo${n === 1 ? '' : 's'} cargado${n === 1 ? '' : 's'}. En el siguiente paso revisás los datos que salieron del PDF.`
      : 'Todavía no cargaste ningún archivo. Podés seguir igual y escribir los datos a mano.';
    return `<h3 class="text-base font-bold text-slate-800 mb-0.5">Cargá los documentos del asegurado</h3>
      <p class="text-xs text-slate-500 mb-4">Arrastrá la póliza, la tarjeta de asistencia y el comprobante de pago. De la póliza se leen solos el nombre, el número, el destino y la vigencia.</p>
      ${state.viajeros.map(cardCarga).join('')}
      ${ghostAgregar()}
      ${botonSiguiente('Continuar a revisar los datos →', sub)}
      <div class="text-center mt-5 pt-4 border-t">
        <button onclick="VApp.sinPoliza()" class="text-xs text-slate-500 underline underline-offset-2 hover:text-sdi-azul">El cliente compró por su cuenta y solo le mando el link de la guía →</button>
      </div>`;
  }
  function cardCarga(v, idx) {
    const titulo = (v.cliente || '').trim() || `Asegurado ${idx + 1}`;
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between mb-3">
        <b class="text-sm">👤 ${esc(titulo)}</b>
        ${state.viajeros.length > 1 ? `<button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button>` : ''}
      </div>
      <div class="dropzone border-2 border-dashed rounded-lg p-5 text-center text-sm text-slate-500 cursor-pointer hover:bg-blue-50 transition-colors" data-vid="${v.id}">
        Arrastrá acá la póliza, la tarjeta y el comprobante <span class="text-sdi-azul font-medium underline">o hacé clic para cargarlos</span>
        <input type="file" class="hidden" multiple accept="application/pdf,.pdf,image/*">
      </div>
      <div class="mt-3">${listaArchivos(v)}</div></div>`;
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
    el('console').querySelectorAll('.dropzone').forEach(dz => {
      const fi = dz.querySelector('input[type=file]');
      dz.addEventListener('click', e => { if (e.target !== fi) fi.click(); });
      fi.addEventListener('change', e => { if (e.target.files.length) onFiles(+dz.dataset.vid, e.target.files); fi.value = ''; });
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('bg-blue-50'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('bg-blue-50'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('bg-blue-50'); onFiles(+dz.dataset.vid, e.dataTransfer.files); });
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
    irA, sinPoliza, nuevoEnvio, pedirLimpiar, pedirPermiso, agentToggle, agentSave, agentReset, agentCopyLink, agentPreviewLink };
})();
document.addEventListener('DOMContentLoaded', () => VApp.boot());
