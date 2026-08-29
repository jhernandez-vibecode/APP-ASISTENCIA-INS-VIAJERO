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
  // Los dos logos del correo. 🔴 Van con URL ABSOLUTA y hosteados en el propio
  // sitio: en un correo no sirve ni la ruta relativa, ni el SVG, ni el base64
  // (Gmail los bloquea). El del INS abre el encabezado — el correo es cara al
  // cliente — y el de SDI firma el pie, con las cuatro barras a color. Es el
  // MISMO archivo que usan los tres correos del cotizador de autos: si alguna
  // vez se regenera, se regenera en los dos repos.
  LOGO_INS_URL: 'https://appasistenciainsviajero.netlify.app/img/ins-logo.png',
  LOGO_SDI_URL: 'https://appasistenciainsviajero.netlify.app/img/sdi-logo-email.png',
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

  // Beneficio Sala VIP del Aeropuerto Juan Santamaría (Circular INS 0388-2026).
  // Es PROMOCIÓN temporal del INS, no cobertura: por eso vive acá y no en los
  // textos. El beneficio tiene TRES llaves y las tres deben estar abiertas:
  //   1. `activo` (este interruptor maestro): false = ni una palabra en ningún lado.
  //   2. La fecha: fuera de desde/hasta el bloque se apaga SOLO — el 1 nov 2026
  //      nadie tiene que acordarse de nada. Si el INS extiende, se cambia `hasta`
  //      y todos los textos visibles se reescriben solos (ninguna fecha va a mano).
  //   3. El toggle del envío en el paso 3 de la consola (por correo).
  // `primaMinima` en 0 = califican todos y desaparece la mención del monto.
  SALA_VIP: {
    activo: true,
    desde: '2026-08-24',
    hasta: '2026-10-31',
    primaMinima: 80          // USD por persona (cada viajero tiene su póliza)
  },

  // Aviso "Qué hay de nuevo" de la consola (patrón pedido por JC el 28 ago 2026,
  // como en su sistema principal): al abrir la consola después de una
  // actualización aparece UNA tarjeta con los cambios; "Entendido" la marca
  // vista (localStorage viajero_novedades_visto = version) y no vuelve a salir
  // hasta la próxima. En cada release: subir `version` (la fecha del deploy),
  // reescribir `items` en lenguaje de usuario (voseo, sin tecnicismos) y anotar
  // la MISMA novedad en el registro de cambios del pie de agente/index.html.
  // Solo la consola la muestra: la página del cliente no lleva novedades
  // (decisión de JC del 24 ago 2026).
  NOVEDADES: {
    version: '2026-08-29',
    fecha: '29 ago 2026',
    items: [
      '<b>La página de tus clientes estrena look claro</b>, con el mismo lenguaje visual de la app Asistencia Autos: fondo blanco, encabezado azul del INS y tarjetas con sombra suave. Se siente como app de teléfono: los botones responden al instante del toque y la barra de abajo es translúcida con un indicador que se desliza solo.',
      '<b>Nada del contenido cambió</b>: contactos, trámites, coberturas, tu link personalizado y la instalación como app siguen exactamente igual. La consola y el correo tampoco se tocaron.',
      '<b>Sigue pendiente tu prueba del beneficio Sala VIP</b> (del 28 ago): el aviso de novedades, el interruptor dorado y un envío real con prima ≥ US$80.'
    ]
  },

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
