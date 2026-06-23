// agente/config.js — sin secretos: el Client ID OAuth es público por diseño.
// Mismo Client ID que los cotizadores (Autos / Vital 360 / INS Medical).
// Pre-requisito producción: en Google Cloud Console agregar el origen Netlify
// (https://appasistenciainsviajero.netlify.app) a "Authorized JavaScript origins".
window.VCfg = {
  GOOGLE_CLIENT_ID: '255791314248-apgnrs0tiii72ogau5dpsjm2eie6d2hu.apps.googleusercontent.com',
  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.send openid email profile',
  WHITELIST: ['jhernandez@segurosdelins.com'],
  APP_LINK: 'https://appasistenciainsviajero.netlify.app/',
  COTIZA_LINK: 'https://cotiza.ins-cr.com/frmDatosIncluir.aspx?P=99&A=1101130',
  STANDARD_DOCS: [
    { name: 'Condiciones Generales - Seguro INS Viajero.pdf', path: 'assets/condiciones.pdf' },
    { name: 'Manual de Indemnizacion - Viajero paso a paso.pdf', path: 'assets/manual.pdf' }
  ],
  EMERGENCIA: { usa: '1 844 865 0804', espana: '900 995 484', mundo: '+34 (91) 189-5152', email: 'insinternacional@grupoins.com' },
  FIRMA: {
    nombre: 'Juan Carlos Hernández Vargas', rol: 'Agente de Seguros Exclusivo · INS',
    licencia: 'Licencia Sugese 08-1318 · Código 110113', tel: '506 8822-1348',
    correo: 'jhernandez@segurosdelins.com', web: 'www.segurosdelins.com'
  }
};
