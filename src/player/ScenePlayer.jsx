import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../store/auth.jsx";
import SceneRenderer from "./SceneRenderer.jsx";
import { playAlert, stopAlert } from "../lib/sound.js";
import { Api } from "../lib/api.js";

const MODES = { NORMAL: "NORMAL", VISITOR: "VISITOR", CRITICAL: "CRITICAL" };

export default function ScenePlayer({ videowallId, kiosk = false }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [allScenes, setAllScenes] = useState([]); // full scenes
  const [summary, setSummary] = useState({
    open: 0,
    closed_without_reason: 0,
    closed_with_reason: 0,
    critical: 0,
  });

  const [mode, setMode] = useState(MODES.NORMAL);
  const [visitorPresent, setVisitorPresent] = useState(false);
  const [hasCritical, setHasCritical] = useState(false);

  
  const [testCritical, setTestCritical] = useState(
    () => sessionStorage.getItem("vw_testCritical") === "1"
  );
  useEffect(() => {
    if (testCritical) sessionStorage.setItem("vw_testCritical", "1");
    else sessionStorage.removeItem("vw_testCritical");
  }, [testCritical]);

  
  const [overrideMode, setOverrideMode] = useState(null);
  useEffect(() => {
    const v = sessionStorage.getItem("vw_overrideMode");
    if (v === "normal" || v === "visitor") setOverrideMode(v);
  }, []);
  useEffect(() => {
    if (overrideMode) sessionStorage.setItem("vw_overrideMode", overrideMode);
    else sessionStorage.removeItem("vw_overrideMode");
  }, [overrideMode]);

  const [index, setIndex] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenSceneId, setFrozenSceneId] = useState(null);

  const [fade, setFade] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [err, setErr] = useState("");
  const timerRef = useRef(null);

  // - Load playlist - //

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        // try full playlist endpoint
        const full = await Api.listScenesFull(videowallId);
        if (full && mounted) {
          setAllScenes(full);
          setIndex(0);
          return;
        }
        // fallback: summaries -> details
        const idx = await Api.listScenes(videowallId);
        const ordered = idx.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const scenes = await Promise.all(
          ordered.map((s) => Api.getScene(s.id))
        );
        if (mounted) {
          setAllScenes(scenes);
          setIndex(0);
        }
      } catch {
        if (mounted) setErr("Cannot load playlist from API.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [videowallId]);

  // - Presence / critical / summary polling - //

  useEffect(() => {
    let mounted = true;

    const loadPresence = async () => {
      try {
        const r = await Api.visitorPresence(videowallId); // {present}
        if (mounted) setVisitorPresent(!!r.present);
      } catch {
        /* ignore */
      }
    };
    const loadCritical = async () => {
      try {
        const r = await Api.criticalState(); // {hasCritical}
        if (mounted) setHasCritical(!!r.hasCritical);
      } catch {
        /* ignore */
      }
    };
    const loadSummary = async () => {
      try {
        const r = await Api.alertSummary();
        if (mounted) setSummary(r);
      } catch {
        /* ignore */
      }
    };

    loadPresence();
    loadCritical();
    loadSummary();
    const tp = setInterval(loadPresence, 5000);
    const tc = setInterval(loadCritical, 3000);
    const ts = setInterval(loadSummary, 30000);
    return () => {
      mounted = false;
      clearInterval(tp);
      clearInterval(tc);
      clearInterval(ts);
    };
  }, [videowallId]);

  // - Effective flags - //

  const effectiveVisitor = overrideMode
    ? overrideMode === "visitor"
    : visitorPresent;
  
  const criticalActive =
    hasCritical || Number(summary.critical) > 0 || testCritical;

  // - Decide playlist (Critical > Visitor/Override > Normal) - //

  const playlist = useMemo(() => {
    if (criticalActive) {
      const crit = allScenes.filter((s) => (s.mode || "normal") === "critical");
      return crit.length
        ? crit
        : allScenes.filter((s) => (s.mode || "normal") === "normal");
    }
    if (effectiveVisitor) {
      const vis = allScenes.filter((s) => (s.mode || "normal") === "visitor");
      return vis.length
        ? vis
        : allScenes.filter((s) => (s.mode || "normal") === "normal");
    }
    return allScenes.filter((s) => (s.mode || "normal") === "normal");
  }, [allScenes, criticalActive, effectiveVisitor]);

  const current = useMemo(() => {
    if (!playlist.length) return null;
    if (criticalActive) return playlist[0];
    if (isFrozen && frozenSceneId) {
      return playlist.find((s) => s.id === frozenSceneId) || playlist[0];
    }
    return playlist[index % playlist.length];
  }, [playlist, index, isFrozen, frozenSceneId, criticalActive]);

  // - Mode label - //

  useEffect(() => {
    if (criticalActive) setMode(MODES.CRITICAL);
    else if (effectiveVisitor) setMode(MODES.VISITOR);
    else setMode(MODES.NORMAL);
  }, [criticalActive, effectiveVisitor]);

  // - Rotation - //

  useEffect(() => {
    if (!current) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setFade(false);
    const start = setTimeout(() => setFade(true), 30);

    const rotate = !isFrozen && !criticalActive;
    if (rotate) {
      const ms = Math.max(1, Number(current.duration) || 15) * 1000;
      timerRef.current = setTimeout(
        () =>
          setIndex((i) => (playlist.length ? (i + 1) % playlist.length : 0)),
        ms
      );
    }
    return () => {
      clearTimeout(start);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, playlist.length, isFrozen, criticalActive]);

  // - Critical sound - //

  useEffect(() => {
    (async () => {
      if (criticalActive && soundEnabled) await playAlert();
      else stopAlert();
    })();
  }, [criticalActive, soundEnabled]);

  // - Freeze (persist via API if available) - //

  const toggleFreeze = () => {
    (async () => {
      try {
        if (isFrozen) {
          await Api.unfreeze(videowallId);
          setIsFrozen(false);
          setFrozenSceneId(null);
        } else if (current) {
          await Api.freeze(videowallId, current.id);
          setIsFrozen(true);
          setFrozenSceneId(current.id);
        }
      } catch (e) {
        console.error("Freeze API error:", e);
        // Fallback: toggle locally to keep testing smooth
        if (isFrozen) {
          setIsFrozen(false);
          setFrozenSceneId(null);
        } else if (current) {
          setIsFrozen(true);
          setFrozenSceneId(current.id);
        }
      }
    })();
  };

  
  useEffect(() => {
    let mounted = true;
    const loadFreeze = async () => {
      try {
        const r = await Api.getFreeze(videowallId); // { frozen, sceneId }
        if (!mounted) return;
        setIsFrozen(!!r.frozen);
        setFrozenSceneId(r.sceneId || null);
      } catch {
        
      }
    };
    loadFreeze();
    const t = setInterval(loadFreeze, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [videowallId]);

  return (
    <div className="relative pt-4">
      {err && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300 mb-3">
          {err}
        </div>
      )}

      <div className="grid grid-cols-[18rem_1fr] gap-4">
        <aside
          className={`${
            kiosk ? "h-[calc(100vh-1rem)] top-2" : "h-[calc(100vh-6rem)] top-4"
          } sticky p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
        >
          <div className="text-lg font-semibold mb-1">Alerts</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Open</span>
              <b>{summary.open || 0}</b>
            </li>
            <li className="flex items-center justify-between">
              <span>Closed (no reason)</span>
              <b>{summary.closed_without_reason || 0}</b>
            </li>
            <li className="flex items-center justify-between">
              <span>Closed (with reason)</span>
              <b>{summary.closed_with_reason || 0}</b>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-red-600">Critical</span>
              <b
                className={`px-2 rounded ${
                  summary.critical
                    ? "bg-red-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                {summary.critical || 0}
              </b>
            </li>
          </ul>

          <div className="mt-6 space-y-1 text-xs opacity-80">
            <div>
              Mode: <b>{mode}</b>
              {isFrozen && (
                <>
                  {" "}
                  • <b>FROZEN</b>
                </>
              )}
            </div>
            {overrideMode && (
              <div className="text-[11px] uppercase tracking-wide">
                Override: <b>{overrideMode}</b>
              </div>
            )}
            <div>
              Scene{" "}
              {current ? playlist.findIndex((s) => s.id === current.id) + 1 : 0}{" "}
              / {playlist.length || 0}
            </div>
            <div className="truncate">
              Now: <b title={current?.name}>{current?.name || "—"}</b>
            </div>
            <div>Duration: {current?.duration || 15}s</div>

            {isAdmin && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="px-2 py-1 rounded border"
                  onClick={toggleFreeze}
                >
                  {isFrozen ? "Unfreeze" : "Freeze current"}
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() => setSoundEnabled((v) => !v)}
                >
                  {soundEnabled ? "Sound: ON" : "Sound: OFF"}
                </button>

                {/* Admin overrides */}

                <button
                  className="px-2 py-1 rounded border"
                  onClick={() => setOverrideMode("normal")}
                  title="Force normal playlist (ignore visitor presence)"
                >
                  Force Normal
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() => setOverrideMode("visitor")}
                  title="Force visitor playlist"
                >
                  Force Visitor
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() => setOverrideMode(null)}
                  title="Return to automatic behavior"
                >
                  Clear Override
                </button>

                {/* Admin: Critical test */}

                <button
                  className={`px-2 py-1 rounded border ${
                    testCritical ? "bg-red-600 text-white border-red-600" : ""
                  }`}
                  onClick={() => setTestCritical(true)}
                  title="Simulate a critical alert (forces critical mode)"
                >
                  Trigger Critical
                </button>
                {testCritical && (
                  <button
                    className="px-2 py-1 rounded border"
                    onClick={() => setTestCritical(false)}
                    title="Clear simulated critical"
                  >
                    Clear Critical
                  </button>
                )}

                {/* Reload / stepper */}

                <button
                  className="px-2 py-1 rounded border"
                  title="Reload playlist from API"
                  onClick={() => {
                    setIndex(0);
                    (async () => {
                      try {
                        const full = await Api.listScenesFull(videowallId);
                        if (full) {
                          setAllScenes(full);
                          return;
                        }
                        const idx = await Api.listScenes(videowallId);
                        const ordered = idx.sort(
                          (a, b) => (a.order ?? 0) - (b.order ?? 0)
                        );
                        const scenes = await Promise.all(
                          ordered.map((s) => Api.getScene(s.id))
                        );
                        setAllScenes(scenes);
                      } catch (e) {
                        console.error("Reload failed", e);
                      }
                    })();
                  }}
                >
                  Reload
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() =>
                    setIndex((i) =>
                      playlist.length
                        ? (i - 1 + playlist.length) % playlist.length
                        : 0
                    )
                  }
                >
                  ◀ Prev
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() =>
                    setIndex((i) =>
                      playlist.length ? (i + 1) % playlist.length : 0
                    )
                  }
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </aside>

        <div
          className={`transition-opacity duration-700 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          <SceneRenderer scene={current} />
        </div>
      </div>

      {/* Override badge (admin-set) */}

      {overrideMode && (
        <div
          className={`pointer-events-none fixed left-2 ${
            kiosk ? "top-2" : "top-[4.5rem]"
          } z-30`}
          aria-label={`Override active: ${overrideMode}`}
        >
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold shadow">
            ⚙️ OVERRIDE ACTIVE — {overrideMode.toUpperCase()}
          </span>
        </div>
      )}

      {/* Critical overlay — top offset adapts for kiosk */}
      
      {criticalActive && (
        <div
          className={`pointer-events-none fixed inset-x-0 ${
            kiosk ? "top-2" : "top-[4.5rem]"
          } z-40`}
        >
          <div className="mx-4 rounded-xl bg-red-600 text-white px-4 py-2 shadow-lg flex items-center gap-3">
            <span>🔔</span>
            <span className="font-semibold">CRITICAL ALERT</span>
            {!soundEnabled && (
              <button
                className="pointer-events-auto ml-auto px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                onClick={() => setSoundEnabled(true)}
              >
                Enable sound
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
