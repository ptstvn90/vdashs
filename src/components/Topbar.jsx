import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth.jsx";
import { USE_MOCK } from "../lib/api.js";

export default function Topbar({ onToggleTheme }) {
  const { user, role, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const active = (path) =>
    loc.pathname === path || loc.pathname.startsWith(path + "/");

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="h-14 px-4 flex items-center gap-3">
        <div
          className="text-lg font-semibold cursor-pointer select-none"
          onClick={() => nav("/play")}
          title="Go to Player"
        >
          🖥️ Traffic Monitoring Wall
        </div>

        

        <nav className="ml-4 flex items-center gap-1 rounded-md bg-gray-100/70 dark:bg-gray-700/50 p-1">
          <Link
            to="/play"
            className={`px-3 h-8 inline-flex items-center rounded transition
              ${
                active("/play")
                  ? "bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
          >
            Player
          </Link>

          {role === "admin" && (
            <Link
              to="/admin"
              className={`px-3 h-8 inline-flex items-center rounded transition
                ${
                  active("/admin")
                    ? "bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            API: {USE_MOCK ? "Mock (localStorage)" : "PHP"}
          </span>

          <div className="text-sm opacity-80">
            {user?.name} {role ? `(${role})` : ""}
          </div>

          {onToggleTheme && (
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={onToggleTheme}
              className="h-8 w-8 grid place-items-center rounded-md border border-gray-300 dark:border-gray-600"
              title="Toggle dark mode"
            >
              🌗
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              await logout();
              nav("/login", { replace: true });
            }}
            className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-600"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
