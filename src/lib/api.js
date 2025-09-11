const BASE = import.meta.env.VITE_API_BASE_URL || "/api";
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK_API || "false") === "true";

/* - REAL API (PHP) - */

async function req(path, { method="GET", body, headers } = {}) {
  const r = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(headers||{}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

const Real = {
  
  me: () => req("/me"),
  login: (creds) => req("/login", { method: "POST", body: creds }),
  logout: () => req("/logout", { method: "POST" }),

  // Videowalls

  listVideowalls: () => req("/videowalls"),
  createVideowall: (payload) => req("/videowalls", { method: "POST", body: payload }),
  updateVideowall: (id, payload) => req(`/videowalls/${encodeURIComponent(id)}`, { method: "PUT", body: payload }),
  deleteVideowall: (id) => req(`/videowalls/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Scenes

  listScenes: (vwId, params={}) => req(`/videowalls/${encodeURIComponent(vwId)}/scenes${q(params)}`),
  listScenesFull: (vwId, params={}) => req(`/videowalls/${encodeURIComponent(vwId)}/playlist${q(params)}`),
  getScene: (id) => req(`/scenes/${encodeURIComponent(id)}`),
  createScene: (payload) => req(`/scenes`, { method:"POST", body: payload }),
  updateScene: (id, payload) => req(`/scenes/${encodeURIComponent(id)}`, { method:"PUT", body: payload }),
  deleteScene: (id) => req(`/scenes/${encodeURIComponent(id)}`, { method:"DELETE" }),

  // Alerts + presence

  alertSummary: () => req(`/alerts/summary`),
  criticalState: () => req(`/alerts/critical`),
  visitorPresence: (videowall) => req(`/visitor/presence?videowall=${encodeURIComponent(videowall)}`),

  // Player controls (freeze)

  getFreeze: (vwId) => req(`/player/${encodeURIComponent(vwId)}/freeze`),
  freeze: (vwId, sceneId) => req(`/player/${encodeURIComponent(vwId)}/freeze`, { method:"POST", body:{ sceneId } }),
  unfreeze: (vwId) => req(`/player/${encodeURIComponent(vwId)}/freeze`, { method:"DELETE" }),
};

/* - MOCK API (localStorage) - */

const LS = {
  vwListKey: "vw_list",
  idxKey: (vw) => `vw_index_${vw}`,
  sceneKey: (vw,id) => `vw_scene_${vw}_${id}`,
  freezeKey: (vw) => `vw_freeze_${vw}`,
  read(key, fallback=null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

function seedIfEmpty() {
  const list = LS.read(LS.vwListKey, null);
  if (!list) {
    LS.write(LS.vwListKey, [
      { id: "vw1", name: "Main TV" },
      { id: "vw2", name: "Ops Room" },
    ]);
  }
}
seedIfEmpty();

function inferVWForScene(sceneId) {
  const vws = LS.read(LS.vwListKey, []);
  for (const vw of vws) {
    const idx = LS.read(LS.idxKey(vw.id), []);
    if (idx.find(s => s.id === sceneId)) return vw.id;
  }
  throw new Error("videowall not found for scene");
}

const Mock = {
 
  me: async () => {
  const u = JSON.parse(localStorage.getItem("mock_user") || "null");
  if (!u) return { authenticated: false };
  return { authenticated: true, name: u.name, role: u.role };
},
login: async ({ username, password }) => {
  const ok =
    (username === "admin" && password === "admin123") ||
    (username === "viewer" && password === "viewer123");
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }
  const role = username === "admin" ? "admin" : "viewer";
  const user = { id: 1, name: username, role, authenticated: true };
  localStorage.setItem("mock_user", JSON.stringify(user));
  return user;
},
logout: async () => {
  localStorage.removeItem("mock_user");
  return { ok: true };
},

  // Videowalls //

  listVideowalls: async () => LS.read(LS.vwListKey, []),
  createVideowall: async ({ id, name }) => {
    const list = LS.read(LS.vwListKey, []);
    const newId = id || ("vw_" + Math.random().toString(36).slice(2));
    LS.write(LS.vwListKey, [...list, { id: newId, name: name || "New Wall" }]);
    LS.write(LS.idxKey(newId), []);
    return { id: newId };
  },
  updateVideowall: async (id, { name }) => {
    const list = LS.read(LS.vwListKey, []);
    LS.write(LS.vwListKey, list.map(v => v.id === id ? { ...v, name: name ?? v.name } : v));
    return { ok: true };
  },

  deleteVideowall: async (id) => {
    const list = LS.read(LS.vwListKey, []);
    LS.write(LS.vwListKey, list.filter(v => v.id !== id));
    const idx = LS.read(LS.idxKey(id), []);
    for (const s of idx) localStorage.removeItem(LS.sceneKey(id, s.id));
    localStorage.removeItem(LS.idxKey(id));
    localStorage.removeItem(LS.freezeKey(id));
    return { ok: true };
  },

  // Scenes //

  listScenes: async (vwId) => {
    const idx = LS.read(LS.idxKey(vwId), []);
    return idx.sort((a,b) => (a.order??0)-(b.order??0));
  },
  listScenesFull: async (vwId) => {
    const idx = await Mock.listScenes(vwId);
    return Promise.all(idx.map(s => Mock.getScene(s.id)));
  },
  getScene: async (id) => {
    const vws = LS.read(LS.vwListKey, []);
    for (const vw of vws) {
      const idx = LS.read(LS.idxKey(vw.id), []);
      if (idx.find(s => s.id === id)) {
        const full = LS.read(LS.sceneKey(vw.id, id), null);
        if (full) return full;
      }
    }
    throw new Error("Scene not found");
  },
  createScene: async (payload) => {
    const id = payload.id || ("s_" + Math.random().toString(36).slice(2));
    const vw = payload.videowall_id;
    const idx = LS.read(LS.idxKey(vw), []);
    const order = payload.order ?? (idx.length + 1);
    const summary = { id, name: payload.name || "New Scene", order, mode: payload.mode || "normal", duration: payload.duration ?? 15 };
    LS.write(LS.idxKey(vw), [...idx, summary]);
    const full = { id, videowall_id: vw, name: summary.name, order, mode: summary.mode, duration: summary.duration, widgets: payload.widgets || [] };
    LS.write(LS.sceneKey(vw, id), full);
    return { id };
  },
  updateScene: async (id, payload) => {
    const vw = payload.videowall_id || inferVWForScene(id);
    const idx = LS.read(LS.idxKey(vw), []);
    const updatedSummary = { id, name: payload.name, order: payload.order ?? 1, mode: payload.mode || "normal", duration: payload.duration ?? 15 };
    LS.write(LS.idxKey(vw), idx.map(s => (s.id === id ? updatedSummary : s)));
    const full = { id, videowall_id: vw, name: payload.name, order: payload.order ?? 1, mode: payload.mode || "normal", duration: payload.duration ?? 15, widgets: payload.widgets || [] };
    LS.write(LS.sceneKey(vw, id), full);
    return { ok: true };
  },
  deleteScene: async (id) => {
    const vw = inferVWForScene(id);
    const idx = LS.read(LS.idxKey(vw), []);
    LS.write(LS.idxKey(vw), idx.filter(s => s.id !== id));
    localStorage.removeItem(LS.sceneKey(vw, id));
    return { ok: true };
  },

  // Alerts + presence (demo) //

  alertSummary: async () => {
    const t = (Date.now()/10000)|0; const mod = (n)=>t%n;
    return { open: 8+mod(4), closed_without_reason: mod(3), closed_with_reason: 5+mod(3), critical: 0 };
  },
  criticalState: async () => ({ hasCritical: false }),
  visitorPresence: async () => ({ present: false }),

  // Player freeze (persist locally) //

  getFreeze: async (vwId) => LS.read(LS.freezeKey(vwId), { frozen:false, sceneId:null }),
  freeze: async (vwId, sceneId) => { LS.write(LS.freezeKey(vwId), { frozen:true, sceneId }); return { ok:true }; },
  unfreeze: async (vwId) => { LS.write(LS.freezeKey(vwId), { frozen:false, sceneId:null }); return { ok:true }; },
};

function q(obj) {
  const s = new URLSearchParams(Object.entries(obj||{}).filter(([,v]) => v!=null && v!==""));
  return s.toString() ? `?${s}` : "";
}



export const Api = USE_MOCK ? Mock : Real;
