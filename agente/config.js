// agente/config.js — sin secretos: el Client ID OAuth es público por diseño.
// Mismo Client ID que los cotizadores (Autos / Vital 360 / INS Medical).
// Pre-requisito producción: en Google Cloud Console agregar el origen Netlify
// (https://appasistenciainsviajero.netlify.app) a "Authorized JavaScript origins".
window.VCfg = {
  GOOGLE_CLIENT_ID: '255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com',
  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.send openid email profile',
  WHITELIST: [
    'jhernandez@segurosdelins.com',
    'tramites@segurosdelins.com',
    'chernandez@seguros-ins.com'
  ],
  APP_LINK: 'https://appasistenciainsviajero.netlify.app/',
  COTIZA_LINK: 'https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130',
  // Documentos que van adjuntos en TODO correo, una sola vez (no por viajero).
  // 🔴 assets/condiciones.pdf es el "DERSA+CG Seguro INS Viajero con Asistencia
  // Autoexpedible V5" que el propio INS mete dentro de cada ZIP de póliza.
  // Sincronizado el 24 ago 2026 con la versión que el INS entrega desde el 8 jul
  // 2026 (24 páginas, 344 KB); la anterior era la de antes de esa fecha (23 páginas)
  // y se siguió mandando seis semanas de más. Mismo registro SUGESE
  // P19-57-A01-972 V5: cambió la repaginación y el pie de firma, no las coberturas.
  // Al detectar un DERSA nuevo dentro de un ZIP, comparar y volver a sincronizar.
  STANDARD_DOCS: [
    { name: 'Condiciones Generales - Seguro INS Viajero.pdf', path: 'assets/condiciones.pdf' },
    { name: 'Manual de Indemnizacion - Viajero paso a paso.pdf', path: 'assets/manual.pdf' }
  ],
  EMERGENCIA: { usa: '1 844 865 0804', espana: '900 995 484', mundo: '+34 (91) 189-5152', email: 'insinternacional@grupoins.com' },

  // Perfil del agente POR DEFECTO (Juan Carlos). Cada agente puede sobrescribir
  // su propia información desde la consola ("⚙️ Mi información de agente"), que se
  // guarda en localStorage y NO toca este archivo. Para precargar otro agente fijo
  // basta con agregarlo a AGENTES (abajo) usando un id corto como llave.
  AGENT_DEFAULT: {
    id: 'jc',
    nombre: 'Juan Carlos Hernández Vargas',
    rol: 'Agente de Seguros Exclusivo · INS',
    licencia: '08-1318',
    codigo: '110113',
    tel: '8822-1348',
    whatsapp: '50688221348',
    correo: 'jhernandez@segurosdelins.com',
    web: 'www.segurosdelins.com',
    cotizaLink: 'https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130'
  },
  // Agentes precargados (link público ?a=<id>). Por ahora solo JC; agregar más
  // aquí cuando se quiera un link fijo y limpio para otro agente.
  AGENTES: {
    jc: {
      id: 'jc',
      nombre: 'Juan Carlos Hernández Vargas',
      rol: 'Agente de Seguros Exclusivo · INS',
      licencia: '08-1318',
      codigo: '110113',
      tel: '8822-1348',
      whatsapp: '50688221348',
      correo: 'jhernandez@segurosdelins.com',
      web: 'www.segurosdelins.com',
      cotizaLink: 'https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130'
    }
  }
};
