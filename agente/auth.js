// agente/auth.js — login Google (GIS) + whitelist + token Gmail.
window.VAuth = (function () {
  const SEND = 'https://www.googleapis.com/auth/gmail.send';
  let tokenClient = null, accessToken = '', userEmail = '', tokenAt = 0, sendOk = false;

  function init() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: VCfg.GOOGLE_CLIENT_ID, scope: VCfg.GMAIL_SCOPE,
      callback: () => {}
    });
  }

  // ¿El agente marcó la casilla "Enviar correo electrónico en tu nombre"?
  // Google muestra los permisos sensibles como casillas que se pueden dejar
  // SIN marcar: el login sale bien igual, pero Gmail responde 403
  // (ACCESS_TOKEN_SCOPE_INSUFFICIENT) a la hora de enviar. Hay que verificarlo
  // en la respuesta del token, no asumirlo.
  function grantedSend(resp) {
    try {
      if (google.accounts.oauth2.hasGrantedAllScopes) return google.accounts.oauth2.hasGrantedAllScopes(resp, SEND);
    } catch (e) { /* cae al chequeo manual */ }
    return String(resp.scope || '').split(/\s+/).indexOf(SEND) !== -1;
  }

  function requestToken(prompt) {
    return new Promise((resolve, reject) => {
      if (!tokenClient) { try { init(); } catch (e) { return reject(new Error('Google aún no cargó, intentá de nuevo.')); } }
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        resolve(resp);
      };
      tokenClient.requestAccessToken({ prompt: prompt });
    });
  }

  // opts.consent = true fuerza la pantalla de permisos de Google (única forma de
  // recuperar el permiso de envío si el agente lo dejó sin marcar la primera vez).
  async function signIn(opts) {
    let resp = await requestToken(opts && opts.consent ? 'consent' : '');
    if (!grantedSend(resp)) {
      // Con prompt:'' Google reusa lo concedido y nunca vuelve a preguntar:
      // hay que pedirlo de nuevo mostrando la pantalla de permisos.
      try { resp = await requestToken('consent'); } catch (e) { /* el navegador pudo bloquear el popup; queda el aviso en pantalla */ }
    }
    accessToken = resp.access_token; tokenAt = Date.now(); sendOk = grantedSend(resp);

    let info;
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
      info = await r.json();
    } catch (e) { accessToken = ''; throw e; }
    userEmail = (info.email || '').toLowerCase();
    if (VCfg.WHITELIST.map(x => x.toLowerCase()).indexOf(userEmail) === -1) {
      accessToken = ''; sendOk = false;
      throw new Error('Cuenta no autorizada: ' + userEmail);
    }
    // Ojo: NO se bloquea el ingreso si falta el permiso de envío — la consola
    // igual sirve para los canales de WhatsApp. El aviso lo da la UI (canSend()).
    return { email: userEmail, token: accessToken, canSend: sendOk };
  }

  function ensureToken() {
    if (accessToken && (Date.now() - tokenAt) < 50 * 60 * 1000) return Promise.resolve(accessToken);
    return signIn().then(r => r.token);
  }

  // Botón "Conceder permiso de envío": va directo a la pantalla de permisos.
  function grantSend() { return signIn({ consent: true }); }

  return {
    init, signIn, ensureToken, grantSend,
    getToken: () => accessToken, getEmail: () => userEmail, canSend: () => sendOk
  };
})();
