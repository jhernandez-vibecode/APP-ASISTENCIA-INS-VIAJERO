// agente/app.js — UI de la consola: login, lista de viajeros, canales, envío.
window.VApp = (function () {
  const state = { viajeros: [], destinatarios: [], saludo: '', canal: 'correo', sent: false };
  let nextId = 1;

  function el(id) { return document.getElementById(id); }
  function showConsole() { el('gate').classList.add('hidden'); el('console').classList.remove('hidden'); render(); }

  async function login() {
    el('gate-err').classList.add('hidden');
    try { const { email } = await VAuth.signIn(); el('who').textContent = email; showConsole(); }
    catch (e) { el('gate-err').textContent = e.message; el('gate-err').classList.remove('hidden'); }
  }

  function addViajero() { state.sent = false; state.viajeros.push({ id: nextId++, cliente: '', nombrePila: '', poliza: '', cedula: '', destino: '', gastosMedicos: '', vigenciaDesde: '', vigenciaHasta: '', correo: '', files: [] }); syncEnvio(); render(); }
  function removeViajero(id) { state.viajeros = state.viajeros.filter(v => v.id !== id); syncEnvio(); render(); }

  function syncEnvio() {
    const first = state.viajeros[0];
    if (first && !state.saludo) state.saludo = first.nombrePila || '';
    const mails = state.viajeros.map(v => v.correo).filter(Boolean);
    if (mails.length && !state.destinatarios.length) state.destinatarios = [mails[0]];
  }

  async function onFiles(viajeroId, fileList) {
    const v = state.viajeros.find(x => x.id === viajeroId); if (!v) return;
    state.sent = false;
    for (const f of fileList) {
      v.files.push(f);
      const text = await VParse.readPdfText(f).catch(() => '');
      const kind = VParse.classifyFile(f.name, text);
      if (kind === 'poliza') { Object.assign(v, VParse.extractAll(text)); }
    }
    syncEnvio(); render();
  }

  function field(v, key, label, mono) {
    return `<label style="display:block"><span style="font-size:11px;color:#94a3b8">${label}</span>
      <input data-vid="${v.id}" data-key="${key}" value="${(v[key]||'').replace(/"/g,'&quot;')}" class="w-full text-sm border rounded px-2 py-1 ${mono?'font-mono':''}"/></label>`;
  }

  function viajeroCard(v, idx) {
    return `<div class="border rounded-xl p-4 mb-3 bg-white">
      <div class="flex items-center justify-between mb-3"><b class="text-sm">Viajero ${idx + 1}</b>
        <button onclick="VApp.removeViajero(${v.id})" class="text-red-500 text-xs">Quitar</button></div>
      <div class="dropzone border-2 border-dashed rounded-lg p-4 text-center text-sm text-slate-500 mb-3 cursor-pointer hover:bg-blue-50 transition-colors" data-vid="${v.id}">
        Arrastrá los PDF aquí <span class="text-blue-700 font-medium underline">o hacé clic para cargarlos</span>
        <input type="file" class="hidden" multiple accept="application/pdf,.pdf">
      </div>
      <div class="text-xs text-slate-400 mb-2">${v.files.map(f => VParse.classifyFile(f.name, '') + ': ' + f.name).join(' · ') || 'sin archivos'}</div>
      <div class="grid grid-cols-2 gap-2">
        ${field(v, 'cliente', 'Cliente')}${field(v, 'nombrePila', 'Saludo (nombre)')}
        ${field(v, 'poliza', 'N° Póliza', true)}${field(v, 'correo', 'Correo')}
        ${field(v, 'destino', 'Destino')}${field(v, 'gastosMedicos', 'Gastos médicos contratados')}
        ${field(v, 'vigenciaDesde', 'Desde')}${field(v, 'vigenciaHasta', 'Hasta')}
      </div></div>`;
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
    el('console').innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Envío de pólizas</h2>
        <button onclick="VApp.addViajero()" class="bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg">➕ Agregar viajero</button>
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
      <div class="flex gap-2 mt-3">
        <button onclick="VApp.preview()" class="border rounded-lg px-4 py-2 text-sm">Vista previa</button>
        <button onclick="VApp.enviar()" id="btn-enviar" class="flex-1 text-white text-sm font-medium rounded-lg px-4 py-2.5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 active:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm" style="background:linear-gradient(135deg,#1c6fb8 0%,#13477e 100%)">Enviar</button>
      </div>
      <p id="status" class="text-sm mt-3"></p>`;
    wire(); renderCanal();
  }

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
    el('canalbox').innerHTML = `<div class="border rounded-xl p-3 bg-white">
      <label class="block mb-2"><span class="text-xs text-slate-400">Teléfono del cliente</span><input id="watel" placeholder="506 8888 8888" class="w-full text-sm border rounded px-2 py-1"/></label>
      <textarea id="watxt" rows="6" class="w-full text-sm border rounded px-2 py-1">${txt.replace(/</g,'&lt;')}</textarea>
      <div class="flex gap-2 mt-2"><button onclick="VApp.waSave()" class="text-xs border rounded px-2 py-1">Guardar como predeterminado</button>
      <button onclick="VApp.waReset()" class="text-xs border rounded px-2 py-1">Restaurar</button></div></div>`;
  }
  function waSave() { VWa.saveTemplate(state.canal, el('watxt').value); el('status').textContent = 'Plantilla guardada.'; }
  function waReset() { el('watxt').value = VWa.resetTemplate(state.canal); }

  function preview() {
    if (state.canal === 'correo') { const w = window.open('', '_blank'); w.document.write(VEmail.buildHtml(state)); }
    else { window.open(VWa.buildLink(el('watel').value, el('watxt').value, state.saludo), '_blank'); }
  }

  async function enviar() {
    const st = el('status'); st.textContent = '';
    if (state.canal !== 'correo') { return preview(); }
    if (!state.viajeros.length) { st.textContent = 'Agregá al menos un viajero.'; return; }
    if (!state.destinatarios.length) { st.textContent = 'Indicá al menos un destinatario.'; return; }
    el('btn-enviar').disabled = true; st.textContent = 'Preparando adjuntos…';
    try {
      const att = [];
      for (const v of state.viajeros) for (const f of v.files) att.push({ name: f.name, b64: await VEmail.fileToB64(f) });
      for (const d of VCfg.STANDARD_DOCS) att.push({ name: d.name, b64: await VEmail.pathToB64(d.path) });
      st.textContent = 'Enviando correo…';
      let token = await VAuth.ensureToken();
      try {
        await VEmail.buildAndSend(state, att, token);
      } catch (e) {
        if (/\b401\b|UNAUTHENTICATED|invalid|expired/i.test(e.message)) {
          st.textContent = 'Sesión vencida, reconectando…';
          token = (await VAuth.signIn()).token;
          await VEmail.buildAndSend(state, att, token);
        } else { throw e; }
      }
      state.sent = true; render();
      el('status').textContent = '✅ Correo enviado a ' + state.destinatarios.join(', ');
    } catch (e) { st.textContent = '❌ ' + e.message; }
    finally { const b = el('btn-enviar'); if (b) b.disabled = false; }
  }

  function boot() { try { VAuth.init(); } catch (e) {} el('btn-login').addEventListener('click', login); }
  return { boot, login, addViajero, removeViajero, setCanal, waSave, waReset, preview, enviar };
})();
document.addEventListener('DOMContentLoaded', () => VApp.boot());
