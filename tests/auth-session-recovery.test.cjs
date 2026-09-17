const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const main = fs.readFileSync("js/main.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8");

function storage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    has(key) { return map.has(key); }
  };
}

function bootWith(options = {}) {
  const authKey = "sb-tkdokwisgeqmflixvmff-auth-token";
  const localStorage = storage({ [authKey]: options.storedSession || '{"access_token":"stale"}' });
  const signOutCalls = [];
  let rendered = null;
  let fatal = null;

  const auth = {
    onAuthStateChange() {},
    async getSession() {
      return options.getSessionResult || {
        data: { session: null },
        error: { message: "Invalid Refresh Token: Refresh Token Not Found", code: "refresh_token_not_found" }
      };
    },
    async signOut(arg) {
      signOutCalls.push(arg);
      return { error: null };
    }
  };

  const S = {
    cfg: {
      productionUrl: "https://system-seller.vercel.app",
      supabaseUrl: "https://tkdokwisgeqmflixvmff.supabase.co"
    },
    sb: { auth },
    state: { session: null, recovery: false, authMarker: null },
    app: {
      set innerHTML(value) { fatal = value; },
      get innerHTML() { return fatal; }
    },
    toast() {},
    errText(err) { return err && err.message || String(err); },
    empty(title, text) { return title + ": " + text; },
    renderAuth(mode) { rendered = mode; },
    renderRecovery() {},
    clearAuthMarker() {},
    async loadContext() {},
  };

  const context = {
    window: {
      SS: S,
      localStorage,
      location: {
        hostname: "system-seller.vercel.app",
        pathname: "/",
        search: "",
        hash: "",
        replace() {}
      }
    },
    URL,
    setTimeout,
    clearTimeout,
    console
  };
  context.window.window = context.window;
  vm.runInNewContext(main, context, { filename: "js/main.js" });
  return { authKey, auth, S, localStorage, signOutCalls, rendered: () => rendered, fatal: () => fatal };
}

test("invalid persisted refresh token self-recovers to login without clearing all site data", async () => {
  const app = bootWith();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(app.localStorage.has(app.authKey), false);
  assert.equal(app.rendered(), "login");
  assert.equal(app.fatal(), null);
});

test("malformed persisted Supabase auth JSON is removed before startup", async () => {
  const app = bootWith({
    storedSession: "{broken-json",
    getSessionResult: { data: { session: null }, error: null }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(app.localStorage.has(app.authKey), false);
  assert.equal(app.rendered(), "login");
  assert.equal(app.fatal(), null);
});

test("normal logout defaults to the current browser instead of global logout", async () => {
  const app = bootWith({ getSessionResult: { data: { session: null }, error: null } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await app.auth.signOut();
  assert.equal(app.signOutCalls[0] && app.signOutCalls[0].scope, "local");
});

test("auth recovery release busts browser and service-worker caches", () => {
  assert.match(index, /js\/main\.js\?v=20260917-12/);
  assert.match(sw, /system-seller-v20260917-12/);
});
