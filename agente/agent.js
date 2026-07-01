// agente/agent.js — perfil del agente activo (personalizable por agente).
// Se guarda en localStorage (clave viajero_agente); por defecto es JC (VCfg.AGENT_DEFAULT).
// Lo usan el correo (firma), las plantillas de WhatsApp ({Agente}) y el generador
// del link público que el agente comparte a sus clientes (?a=... o parámetros).
window.VAgent = (function () {
  const KEY = 'viajero_agente';
  const FIELDS = ['id', 'nombre', 'rol', 'licencia', 'codigo', 'tel', 'whatsapp', 'correo', 'web', 'cotizaLink'];

  function def() { return Object.assign({}, VCfg.AGENT_DEFAULT); }

  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.nombre) return Object.assign(def(), s);
    } catch (e) {}
    return def();
  }

  function save(p) {
    const clean = {};
    FIELDS.forEach(k => { clean[k] = (p && p[k] != null) ? String(p[k]).trim() : ''; });
    if (!clean.id) clean.id = (clean.nombre || 'agente').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'agente';
    localStorage.setItem(KEY, JSON.stringify(clean));
    return clean;
  }

  function reset() { localStorage.removeItem(KEY); return def(); }

  // Construye el link público personalizado que el agente envía a sus clientes.
  // Si el id está precargado en VCfg.AGENTES usa el link corto (?a=<id>);
  // si no, codifica la identidad en la URL para que funcione sin tocar código.
  function publicLink(p) {
    p = p || get();
    const base = String(VCfg.APP_LINK || '').replace(/[?#].*$/, '');
    const q = new URLSearchParams();
    if (p.id) q.set('a', p.id);
    const known = VCfg.AGENTES && VCfg.AGENTES[(p.id || '').toLowerCase()];
    if (!known) {
      // Agente no precargado: viaja su info en el link (autoservicio).
      if (p.nombre) q.set('an', p.nombre);
      if (p.rol) q.set('ar', p.rol);
      if (p.licencia) q.set('al', p.licencia);
      if (p.web) q.set('aw', p.web);
    }
    return base + '?' + q.toString();
  }

  return { get, save, reset, publicLink, FIELDS, def };
})();
