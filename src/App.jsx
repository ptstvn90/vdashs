import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import Topbar from "./components/Topbar.jsx";
import Admin from "./routes/Admin.jsx";
import Play from "./routes/Play.jsx";
import Login from "./routes/Login.jsx";
import { useAuth } from "./store/auth.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const getInitialTheme = () => {
  const saved = localStorage.getItem("theme");
  if (saved) return saved === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="h-screen grid place-items-center text-sm opacity-70">
        Checking session…
      </div>
    );
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="h-screen grid place-items-center text-sm opacity-70">
        Checking session…
      </div>
    );
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (role !== "admin") return <Navigate to="/play" replace />;
  return children;
}

function Shell({ darkMode, setDarkMode }) {
  const location = useLocation();
  const isPlayerRoute = location.pathname.startsWith("/play");
  const search = new URLSearchParams(location.search);
  const isKiosk = isPlayerRoute && search.get("kiosk") === "1";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  
  useEffect(() => {
    document.body.classList.toggle("cursor-none", isKiosk);
    return () => document.body.classList.remove("cursor-none");
  }, [isKiosk]);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* no sidebar; topbar hidden in kiosk */}
      {!isKiosk && <Topbar onToggleTheme={() => setDarkMode((d) => !d)} />}

      <div className={isKiosk ? "" : "p-4"}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(getInitialTheme);
  return (
    <Routes>
      <Route element={<Shell darkMode={darkMode} setDarkMode={setDarkMode} />}>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route
          path="/play"
          element={
            <RequireAuth>
              <Play />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
