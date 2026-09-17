(function () {
  "use strict";
  var S = window.SS;

  var official = new URL(S.cfg.productionUrl);
  if (window.location.hostname.endsWith(".vercel.app") && window.location.hostname !== official.hostname) {
    window.location.replace(official.origin + window.location.pathname + window.location.search + window.location.hash);
    return;
  }

  // Normal logout must only end this browser's session. Supabase defaults to a
  // global sign-out, which can invalidate refresh tokens persisted elsewhere.
  var supabaseSignOut = S.sb.auth.signOut.bind(S.sb.auth);
  S.sb.auth.signOut = function (options) {
    return supabaseSignOut(options || { scope: "local" });
  };

  function authStorageKey() {
    try {
      return "sb-" + new URL(S.cfg.supabaseUrl).hostname.split(".")[0] + "-auth-token";
    } catch (err) {
      return "";
    }
  }

  function clearPersistedAuthSession() {
    var base = authStorageKey();
    if (!base) return;
    try {
      var keys = [];
      for (var i = 0; i < window.localStorage.length; i += 1) {
        var key = window.localStorage.key(i);
        if (key && (key === base || key.indexOf(base + "-") === 0 || key.indexOf(base + ".") === 0)) {
          keys.push(key);
        }
      }
      keys.forEach(function (key) { window.localStorage.removeItem(key); });
    } catch (err) {
      // Storage can be unavailable in hardened/private browser modes.
    }
  }

  function cleanMalformedStoredSession() {
    var key = authStorageKey();
    if (!key) return false;
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        clearPersistedAuthSession();
        return true;
      }
      return false;
    } catch (err) {
      clearPersistedAuthSession();
      return true;
    }
  }

  function brokenStoredSession(err) {
    if (!err) return false;
    var text = [
      err.message || "",
      err.code || "",
      err.error_description || "",
      err.details || ""
    ].join(" ").toLowerCase();

    return text.indexOf("invalid refresh token") !== -1 ||
      text.indexOf("refresh token not found") !== -1 ||
      text.indexOf("refresh_token_not_found") !== -1 ||
      text.indexOf("invalid grant") !== -1 ||
      text.indexOf("jwt expired") !== -1 ||
      text.indexOf("invalid jwt") !== -1 ||
      text.indexOf("jwt malformed") !== -1 ||
      text.indexOf("session not found") !== -1;
  }

  function recoverToLogin() {
    clearPersistedAuthSession();
    S.state.session = null;
    S.state.recovery = false;
    S.renderAuth("login");
    S.toast("Sua sessão salva expirou ou ficou inválida. Entre novamente.", "error");
  }

  async function startupSession() {
    var cleaned = cleanMalformedStoredSession();
    try {
      var res = await S.sb.auth.getSession();
      if (res.error) {
        if (!cleaned && !brokenStoredSession(res.error)) throw res.error;
        clearPersistedAuthSession();
        return { session: null, recovered: true };
      }
      return { session: res.data.session, recovered: cleaned };
    } catch (err) {
      if (!cleaned && !brokenStoredSession(err)) throw err;
      clearPersistedAuthSession();
      return { session: null, recovered: true };
    }
  }

  async function loadContextOrRecover() {
    try {
      await S.loadContext();
      return true;
    } catch (err) {
      if (!brokenStoredSession(err)) throw err;
      recoverToLogin();
      return false;
    }
  }

  function announceAuthResult() {
    if (S.state.authMarker === "confirmed") {
      S.toast("E-mail confirmado com sucesso. Sua conta está pronta para uso.");
      S.clearAuthMarker();
    } else if (S.state.authMarker === "recovery") {
      S.clearAuthMarker();
    }
  }

  async function init() {
    try {
      S.sb.auth.onAuthStateChange(function (event, session) {
        S.state.session = session;
        if (event === "PASSWORD_RECOVERY") {
          S.state.recovery = true;
          setTimeout(S.renderRecovery, 0);
        } else if (event === "SIGNED_IN" && session) {
          if (S.state.authMarker === "recovery") {
            S.state.recovery = true;
            setTimeout(S.renderRecovery, 0);
            return;
          }
          setTimeout(function () {
            loadContextOrRecover().then(function (loaded) {
              if (loaded) announceAuthResult();
            }).catch(function (err) {
              S.toast(S.errText(err), "error");
            });
          }, 0);
        } else if (event === "SIGNED_OUT") {
          setTimeout(function () { S.renderAuth("login"); }, 0);
        }
      });

      var boot = await startupSession();
      S.state.session = boot.session;
      if (S.state.session) {
        if (S.state.authMarker === "recovery") {
          S.state.recovery = true;
          S.renderRecovery();
          return;
        }
        if (!await loadContextOrRecover()) return;
        announceAuthResult();
      } else {
        S.renderAuth("login");
        if (boot.recovered) {
          S.toast("Sua sessão salva expirou ou ficou inválida. Entre novamente.", "error");
        }
        if (S.state.authMarker === "confirmed") {
          S.toast("E-mail confirmado. Entre com sua senha para continuar.");
          S.clearAuthMarker();
        }
      }
    } catch (err) {
      S.app.innerHTML = S.empty("Falha ao iniciar o sistema", S.errText(err));
      S.toast(S.errText(err), "error");
    }
  }

  init();
})();
