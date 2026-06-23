// agente/auth.js — login Google (GIS) + whitelist + token Gmail.
window.VAuth = (function () {
  let tokenClient = null, accessToken = '', userEmail = '', tokenAt = 0;
  function init() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: VCfg.GOOGLE_CLIENT_ID, scope: VCfg.GMAIL_SCOPE,
      callback: () => {}
    });
  }
  function signIn() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) { try { init(); } catch (e) { return reject(new Error('Google aún no cargó, intentá de nuevo.')); } }
      tokenClient.callback = async (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token; tokenAt = Date.now();
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
          const info = await r.json();
          userEmail = (info.email || '').toLowerCase();
        } catch (e) { return reject(e); }
        if (!VCfg.WHITELIST.map(x => x.toLowerCase()).includes(userEmail)) {
          accessToken = ''; return reject(new Error('Cuenta no autorizada: ' + userEmail));
        }
        resolve({ email: userEmail, token: accessToken });
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }
  function ensureToken() {
    if (accessToken && (Date.now() - tokenAt) < 50 * 60 * 1000) return Promise.resolve(accessToken);
    return signIn().then(r => r.token);
  }
  return { init, signIn, ensureToken, getToken: () => accessToken, getEmail: () => userEmail };
})();
