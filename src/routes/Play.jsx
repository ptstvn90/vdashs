import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth.jsx";
import Card from "../components/Card.jsx";
import ScenePlayer from "../player/ScenePlayer.jsx";
import { Api } from "../lib/api.js";

const ui = {
  control:
    "h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-sm",
};

export default function Play() {
  const [params] = useSearchParams();
  const isKiosk = params.get("kiosk") === "1";
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const nav = useNavigate();

  const [walls, setWalls] = useState([]);
  const [videowall, setVideowall] = useState("");
  const [err, setErr] = useState("");
  const { isAuthenticated, loading } = useAuth();

  const location = useLocation();
  if (loading)
    return <div className="p-4 text-sm opacity-70">Checking session…</div>;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const v = await Api.listVideowalls();
        setWalls(v);
        if (v.length) setVideowall(v[0].id);
      } catch {
        setErr("Cannot load videowalls from API.");
      }
    })();
  }, []);

  
  const enterFull = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  };
  const exitFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  };

  return (
    <div className="relative">
      {!isKiosk && (
        <Card title="Player">
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
              
              <select
                className={ui.control}
                value={videowall}
                onChange={(e) => setVideowall(e.target.value)}
              >
                {walls.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-sm opacity-70">
              Use ← → to test manual navigation.
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="text-sm opacity-70 hidden md:block">
                Tip: add <code>?kiosk=1</code> to URL
              </div>

              {isAdmin && (
                <>
                  <button
                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600"
                    onClick={() => nav("/play?kiosk=1")}
                    title="Enter kiosk mode in this tab"
                  >
                    Enter Kiosk
                  </button>
                  <button
                    className="h-10 px-3 rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    onClick={() =>
                      window.open(
                        "/play?kiosk=1",
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    title="Open kiosk in a new tab"
                  >
                    Open Kiosk
                  </button>
                </>
              )}
            </div>
          </div>

          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
          {walls.length === 0 && (
            <div className="mt-2 text-sm opacity-70">
              No videowalls yet.{" "}
              {isAdmin ? (
                <button className="underline" onClick={() => nav("/admin")}>
                  Create one in Admin
                </button>
              ) : (
                "Ask an admin to create one."
              )}
            </div>
          )}
        </Card>
      )}

      {videowall && <ScenePlayer videowallId={videowall} kiosk={isKiosk} />}
    </div>
  );
}
