// agente/app.js — UI de la consola: login, lista de viajeros, canales, envío.
window.VApp = (function () {
  const state = { viajeros: [], destinatarios: [], saludo: '', poliza: '', canal: 'correo', sent: false, envio: null };
  let nextId = 1;
  let agentOpen = false;

  function el(id) { return document.getElementById(id); }
  function showConsole() { el('gate').classList.add('hidden'); el('console').classList.remove('hidden'); render(); }

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
  function agentePanel() {
    const a = VAgent.get();
    const link = VAgent.publicLink(a);
    const body = agentOpen ? `
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
      </div>` : '';
    return `<div class="border rounded-xl p-4 bg-white mb-4">
      <button onclick="VApp.agentToggle()" class="w-full flex items-center justify-between text-left">
        <span class="text-sm font-semibold text-slate-700">⚙️ Mi información de agente</span>
        <span class="text-xs text-slate-400">${a.nombre} · ${agentOpen ? 'ocultar ▲' : 'editar ▼'}</span>
      </button>${body}</div>`;
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

  function addViajero() { state.sent = false; state.viajeros.push({ id: nextId++, cliente: '', nombrePila: '', poliza: '', cedula: '', destino: '', gastosMedicos: '', vigenciaDesde: '', vigenciaHasta: '', correo: '', files: [] }); syncEnvio(); render(); }
  function removeViajero(id) { state.viajeros = state.viajeros.filter(v => v.id !== id); syncEnvio(); render(); }

  // "A, B y C" — el número de póliza va dentro del mensaje de WhatsApp, así que
  // se une en español y no con separadores técnicos.
  function unir(arr) {
    if (arr.length < 2) return arr[0] || '';
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }
  function polizasAuto() { return unir(state.viajeros.map(v => v.poliza).filter(Boolean)); }

  function syncEnvio() {
    const first = state.viajeros[0];
    if (first && !state.saludo) state.saludo = first.nombrePila || '';
    const mails = state.viajeros.map(v => v.correo).filter(Boolean);
    if (mails.length && !state.destinatarios.length) state.destinatarios = [mails[0]];
    const pol = polizasAuto();
    if (pol && !state.poliza) state.poliza = pol;
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

  function viajeroCard(v, idx) {
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between mb-3"><b class="text-sm">Viajero ${idx + 1}</b>
        <button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button></div>
      <div class="dropzone border-2 border-dashed rounded-lg p-4 text-center text-sm text-slate-500 mb-3 cursor-pointer hover:bg-blue-50 transition-colors" data-vid="${v.id}">
        Arrastrá acá la póliza, la tarjeta y el comprobante <span class="text-blue-700 font-medium underline">o hacé clic para cargarlos</span>
        <input type="file" class="hidden" multiple accept="application/pdf,.pdf,image/*">
      </div>
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
        <button onclick="VApp.nuevoEnvio()" class="text-xs font-semibold border rounded-lg px-3.5 py-2 bg-white hover:bg-slate-50">Enviar a otro cliente</button>
      </div></div>`;
  }
  function bannerExito() {
    const e = state.envio || {};
    return `<div class="v-pop flex items-center gap-3 rounded-lg mt-3 px-4 py-3 bg-green-50 border-l-4 border-green-600">
      <div class="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-none">✓</div>
      <div><div class="text-sm font-bold" style="color:#14532d">Correo enviado a ${esc((e.to || []).join(', '))}</div>
        <div class="text-xs" style="color:#3f6b4d">${e.viajeros} ${e.viajeros === 1 ? 'viajero' : 'viajeros'} · ${e.adjuntos} ${e.adjuntos === 1 ? 'adjunto' : 'adjuntos'} · ${esc(e.hora)}</div></div></div>`;
  }
  function nuevoEnvio() {
    state.viajeros = []; state.destinatarios = []; state.saludo = ''; state.poliza = '';
    state.canal = 'correo'; state.sent = false; state.envio = null;
    addViajero();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stepper() {
    const hasData = state.viajeros.some(v => v.poliza || v.files.length);
    const ready = hasData && state.destinatarios.length;
    const st = [hasData ? 'done' : 'active', state.sent ? 'done' : (hasData ? 'active' : 'pending'), state.sent ? 'done' : (ready ? 'active' : 'pending')];
    const labels = ['Cargar el PDF', 'Revisión', 'Enviar'];
    const dot = i => {
      const s = st[i];
      const cls = s === 'done' ? 'bg-green-600 text-white' : s === 'active' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-400';
      const txt = s === 'pending' ? 'text-slate-400' : 'text-slate-700 font-medium';
      return `<div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${cls}">${s === 'done' ? '✓' : (i + 1)}</div><span class="text-sm ${txt}">${labels[i]}</span></div>`;
    };
    return `<div class="flex items-center justify-center gap-3 sm:gap-4 mb-6 flex-wrap">${dot(0)}<div class="w-6 sm:w-10 h-px bg-slate-300"></div>${dot(1)}<div class="w-6 sm:w-10 h-px bg-slate-300"></div>${dot(2)}</div>`;
  }
  function render() {
    const exito = state.sent && state.envio;
    const botones = `<div class="flex gap-2 mt-3">
        <button onclick="VApp.preview()" class="border rounded-lg px-4 py-2 text-sm">Vista previa</button>
        <button onclick="VApp.enviar()" id="btn-enviar" class="flex-1 text-white text-sm font-medium rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 active:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm" style="background:linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)">Enviar</button>
      </div>`;
    const bloqueAccion = (exito && state.canal === 'correo') ? panelExito() : ((exito ? bannerExito() : '') + botones);
    el('console').innerHTML = `
      ${avisoPermiso()}
      ${agentePanel()}
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Envío de pólizas</h2>
        <button onclick="VApp.addViajero()" class="text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 active:shadow-sm" style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%)"><span style="font-weight:700;font-size:15px">+</span> Agregar viajero</button>
      </div>
      ${stepper()}
      ${state.viajeros.map(viajeroCard).join('') || '<p class="text-slate-500 text-sm mb-3">Agregá un viajero para empezar.</p>'}
      <div class="border rounded-xl p-4 bg-white mb-3">
        <label class="block mb-2"><span class="text-xs text-slate-400">Destinatarios (separados por coma)</span>
          <input id="dest" value="${state.destinatarios.join(', ')}" class="w-full text-sm border rounded px-2 py-1"/></label>
        <label class="block"><span class="text-xs text-slate-400">Saludo</span>
          <input id="saludo" value="${state.saludo.replace(/"/g,'&quot;')}" class="w-full text-sm border rounded px-2 py-1"/></label>
      </div>
      <div class="flex gap-2 mb-3">
        ${['correo','emitida','directa'].map(c => {
          const isWA = c !== 'correo';
          const active = state.canal === c;
          const base = isWA ? 'border-green-500 text-green-700' : 'border-slate-300 text-slate-700';
          const act = active ? (isWA ? 'border-green-600 border-2 bg-green-50' : 'border-blue-600 border-2 text-blue-700') : '';
          const label = c === 'correo' ? 'Correo' : c === 'emitida' ? 'WhatsApp emitida' : 'WhatsApp directa';
          return `<button onclick="VApp.setCanal('${c}')" class="flex-1 border rounded-lg py-2 text-sm ${base} ${act}">${label}</button>`;
        }).join('')}
      </div>
      <div id="canalbox"></div>
      ${bloqueAccion}
      <p id="status" class="text-sm mt-3"></p>`;
    wire(); renderCanal();
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
    }));
    el('dest') && el('dest').addEventListener('input', e => state.destinatarios = e.target.value.split(',').map(s => s.trim()).filter(Boolean));
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

  function setCanal(c) { state.canal = c; render(); }
  function renderCanal() {
    if (state.canal === 'correo') { el('canalbox').innerHTML = `<p class="text-xs text-slate-500">Se enviará el correo con los adjuntos de cada viajero + Condiciones y Manual.</p>`; return; }
    const tipo = state.canal, txt = VWa.getTemplate(tipo);
    const auto = polizasAuto();
    const delPdf = auto && state.poliza === auto;
    el('canalbox').innerHTML = `<div class="border rounded-xl p-3 bg-white">
      <label class="block mb-2"><span class="text-xs text-slate-400">Teléfono del cliente</span><input id="watel" placeholder="506 8888 8888" class="w-full text-sm border rounded px-2 py-1"/></label>
      <label class="block mb-2"><span class="text-xs text-slate-400">N° de póliza (aparece en el mensaje)</span>
        <span class="relative block">
          <input id="wapoliza" value="${esc(state.poliza)}" placeholder="Escribilo a mano si no cargaste el PDF" class="w-full text-sm border rounded px-2 py-1 font-mono ${delPdf ? 'bg-blue-50 border-blue-200 text-blue-800 pr-24' : ''}"/>
          ${delPdf ? '<span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">tomado del PDF</span>' : ''}
        </span></label>
      <textarea id="watxt" rows="6" class="w-full text-sm border rounded px-2 py-1">${txt.replace(/</g,'&lt;')}</textarea>
      <p class="text-[11px] text-slate-400 mt-1">Comodines: <code>{Nombre}</code> = nombre del cliente · <code>{Agente}</code> = tu nombre · <code>{Link}</code> = tu link personalizado de la app · <code>{Poliza}</code> = el número de arriba.</p>
      <p class="text-[11px] text-slate-400">Si dejás el número vacío, esa línea no aparece en el mensaje.</p>
      <div class="flex gap-2 mt-2"><button onclick="VApp.waSave()" class="text-xs border rounded px-2 py-1">Guardar como predeterminado</button>
      <button onclick="VApp.waReset()" class="text-xs border rounded px-2 py-1">Restaurar</button></div></div>`;
    // El campo se cablea acá porque wire() corre ANTES de que exista el canalbox.
    const ip = el('wapoliza');
    if (ip) ip.addEventListener('input', e => { state.poliza = e.target.value; });
  }
  function waSave() { VWa.saveTemplate(state.canal, el('watxt').value); el('status').textContent = 'Plantilla guardada.'; }
  function waReset() { el('watxt').value = VWa.resetTemplate(state.canal); }

  function preview() {
    if (state.canal === 'correo') { const w = window.open('', '_blank'); w.document.write(VEmail.buildHtml(state)); }
    else {
      const ip = el('wapoliza');
      window.open(VWa.buildLink(el('watel').value, el('watxt').value, state.saludo, VAgent.get().nombre, ip ? ip.value : state.poliza), '_blank');
    }
  }

  async function enviar() {
    const st = el('status'); st.textContent = '';
    if (state.canal !== 'correo') { return preview(); }
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
    nuevoEnvio, pedirPermiso, agentToggle, agentSave, agentReset, agentCopyLink, agentPreviewLink };
})();
document.addEventListener('DOMContentLoaded', () => VApp.boot());
