import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import GridBuilder from "../builder/GridBuilder.jsx";
import WidgetModal from "../builder/WidgetModal.jsx";
import { Api } from "../lib/api.js";
import VideowallsModal from "../components/VideowallsModal.jsx";

const ui = {
  control:
    "h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm",
  btn: "h-10 px-3 rounded-md text-sm inline-flex items-center justify-center border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition",
  btnPrimary:
    "h-10 px-3 rounded-md text-sm inline-flex items-center justify-center bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border border-gray-900 dark:border-gray-100 hover:opacity-90",
  btnDanger:
    "h-10 px-3 rounded-md text-sm inline-flex items-center justify-center border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10",
};


function Field({ label, children, className = "" }) {
  return (
    <label className={`text-sm flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const normalizeWidgets = (ws) =>
  ws.map((w) => ({
    ...w,
    id: String(w.id || `w_${Math.random().toString(36).slice(2)}`),
    layout: {
      i: String(w.layout?.i || w.id),
      x: Math.max(0, parseInt(w.layout?.x ?? 0, 10)),
      y: Math.max(0, parseInt(w.layout?.y ?? 0, 10)),
      w: Math.min(12, Math.max(1, parseInt(w.layout?.w ?? 4, 10))),
      h: Math.min(12, Math.max(2, parseInt(w.layout?.h ?? 4, 10))),
    },
  }));

export default function Admin() {
  const [videowalls, setVideowalls] = useState([]);
  const [videowall, setVideowall] = useState("");
  const [scenesIdx, setScenesIdx] = useState([]);
  const [sceneId, setSceneId] = useState("");
  const [scene, setScene] = useState(null);
  const [widgets, setWidgets] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);
  const [onModalSave, setOnModalSave] = useState(() => () => {});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [vwModalOpen, setVwModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await Api.listVideowalls();
        setVideowalls(v);
        if (v.length) setVideowall(v[0].id);
      } catch {
        setErr(
          "API not available yet. Start PHP backend or set VITE_API_BASE_URL."
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!videowall) return;
    (async () => {
      try {
        setLoading(true);
        const idx = await Api.listScenes(videowall);
        const ordered = idx.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setScenesIdx(ordered);
        setSceneId(ordered[0]?.id || "");
      } catch {
        setErr("Cannot load scenes index.");
      } finally {
        setLoading(false);
      }
    })();
  }, [videowall]);

  useEffect(() => {
    if (!sceneId) {
      setScene(null);
      setWidgets([]);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const s = await Api.getScene(sceneId);
        setScene(s);
        setWidgets(Array.isArray(s.widgets) ? s.widgets : []);
      } catch {
        setErr("Cannot load scene.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sceneId]);

  const createScene = async () => {
    const payload = {
      name: "New Scene",
      duration: 15,
      order: (scenesIdx.length || 0) + 1,
      mode: "normal",
      videowall_id: videowall,
      widgets: [],
    };
    try {
      setLoading(true);
      const created = await Api.createScene(payload);
      const idx = await Api.listScenes(videowall);
      const ordered = idx.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setScenesIdx(ordered);
      setSceneId(created.id);
    } catch {
      setErr("Create failed.");
    } finally {
      setLoading(false);
    }
  };

  const saveScene = async () => {
    if (!scene) return;
    const payload = { ...scene, widgets: normalizeWidgets(widgets) };
    try {
      setLoading(true);
      await Api.updateScene(scene.id, payload);
      const idx = await Api.listScenes(videowall);
      setScenesIdx(idx.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      console.log("Saved.");
    } catch (e) {
      setErr("Save failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteScene = async () => {
    if (!scene) return;
    if (!confirm(`Delete scene "${scene.name}"?`)) return;
    try {
      setLoading(true);
      await Api.deleteScene(scene.id);
      const idx = await Api.listScenes(videowall);
      const ordered = idx.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setScenesIdx(ordered);
      setSceneId(ordered[0]?.id || "");
      setScene(null);
      setWidgets([]);
    } catch {
      setErr("Delete failed.");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setModalInitial(null);
    setOnModalSave(() => (payload) => {
      const id = "w_" + Math.random().toString(36).slice(2);
      const type = (payload.type || "iframe").toLowerCase();
      const defaultCfg =
        type === "iframe"
          ? { url: "" }
          : type === "html"
          ? { html: "" }
          : type === "php"
          ? { code: "" }
          : {};
      const config = { ...defaultCfg, ...(payload.config || {}) };
      setWidgets((prev) => [
        ...prev,
        {
          id,
          type,
          config,
          layout: { i: id, x: 0, y: Infinity, w: 4, h: 4 },
        },
      ]);
    });
    setModalOpen(true);
  };

  const openEditModal = (widget, onSave) => {
    const type = (widget?.type || "iframe").toLowerCase();
    const defaultCfg =
      type === "iframe"
        ? { url: "" }
        : type === "html"
        ? { html: "" }
        : type === "php"
        ? { code: "" }
        : {};
    setModalInitial(
      widget
        ? { type, config: { ...defaultCfg, ...(widget.config || {}) } }
        : null
    );
    setOnModalSave(() => (payload) => {
      const merged = { ...defaultCfg, ...(payload?.config || {}) };
      onSave({ type, config: merged });
    });
    setModalOpen(true);
  };

  return (
    <div className="grid gap-4">
      {err && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {err}
        </div>
      )}

      <Card title="Scene controls">
        
        <div className="flex flex-wrap items-end gap-3">
          <Field label="DevSecOps Videowall">
            <select
              className={`${ui.control} w-44`}
              value={videowall}
              onChange={(e) => setVideowall(e.target.value)}
            >
              {!videowalls.length && <option>(none)</option>}
              {videowalls.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>

          <button className={ui.btn} onClick={() => setVwModalOpen(true)}>
            Manage
          </button>

          <Field label="Scene">
            <select
              className={`${ui.control} min-w-[220px]`}
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
            >
              {scenesIdx.length === 0 && <option value="">(none)</option>}
              {scenesIdx.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <button
            className={ui.btn}
            onClick={createScene}
            disabled={!videowall || loading}
          >
            Add Scene
          </button>

          <button className={ui.btn} onClick={openAddModal} disabled={!scene}>
            Add Widget
          </button>

          <div className="ml-auto flex items-end gap-2">
            <button
              className={ui.btnPrimary}
              onClick={saveScene}
              disabled={!scene || loading}
            >
              Confirm Scene
            </button>
            <button
              className={ui.btnDanger}
              onClick={deleteScene}
              disabled={!scene || loading}
            >
              Delete Scene
            </button>
          </div>
        </div>

       
        {scene && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Name" className="min-w-[18rem]">
              <input
                className={ui.control}
                value={scene.name}
                onChange={(e) => setScene({ ...scene, name: e.target.value })}
              />
            </Field>

            <Field label="Mode">
              <select
                className={`${ui.control} w-32`}
                value={scene.mode || "normal"}
                onChange={(e) => setScene({ ...scene, mode: e.target.value })}
              >
                <option value="normal">normal</option>
                <option value="visitor">visitor</option>
                <option value="critical">critical</option>
              </select>
            </Field>

            <Field label="Duration (s)">
              <input
                type="number"
                className={`${ui.control} w-28`}
                value={scene.duration}
                onChange={(e) =>
                  setScene({ ...scene, duration: Number(e.target.value) || 0 })
                }
              />
            </Field>

            <Field label="Order">
              <input
                type="number"
                className={`${ui.control} w-24`}
                value={scene.order}
                onChange={(e) =>
                  setScene({ ...scene, order: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Grid builder">
        {scene ? (
          <GridBuilder
            widgets={widgets}
            setWidgets={setWidgets}
            onEditWidget={(widget, onSave) => openEditModal(widget, onSave)}
            onAddWidget={openAddModal}
          />
        ) : (
          <div className="text-sm opacity-70">Create or select a scene.</div>
        )}
      </Card>

      <WidgetModal
        open={modalOpen}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSave={onModalSave}
      />

      <VideowallsModal
        open={vwModalOpen}
        currentId={videowall}
        onClose={async (selectedId) => {
          setVwModalOpen(false);
          try {
            const list = await Api.listVideowalls();
            setVideowalls(list);
            if (selectedId) setVideowall(selectedId);
          } catch {}
        }}
      />
    </div>
  );
}
