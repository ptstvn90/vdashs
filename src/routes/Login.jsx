import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth.jsx";
import loginBg from "../assets/login-bg.png";

export default function Login() {
  const { login, useMock, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "/play";

  useEffect(() => {
    const saved = localStorage.getItem("remember_username");
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) nav(returnTo, { replace: true });
  }, [isAuthenticated, nav, returnTo]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      await login({ username, password });
      if (remember) localStorage.setItem("remember_username", username);
      else localStorage.removeItem("remember_username");
      nav(returnTo, { replace: true });
    } catch {
      setErr("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed -z-10"
        style={{ backgroundImage: `url(${loginBg})` }}
        aria-hidden="true"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55 -z-10" aria-hidden="true" />

      {/* Centered content */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
        <a href="/" className="mb-6 text-2xl font-semibold text-white">
          DevSecOps Wall
        </a>

        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/85 dark:bg-gray-900/80 backdrop-blur-md shadow-2xl">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl dark:text-white">
              Sign in to your account
            </h1>

            {useMock && (
              <div className="text-xs text-white/90">
                Mock mode: use <b>admin / admin123</b> or <b>viewer / viewer123</b>.
              </div>
            )}

            {err && (
              <div id="login-error" className="text-sm text-red-600 dark:text-red-400">
                {err}
              </div>
            )}

            <form className="space-y-4 md:space-y-6" onSubmit={submit} noValidate>
              <div>
                <label
                  htmlFor="username"
                  className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="your.username"
                  required
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  aria-invalid={Boolean(err)}
                  aria-describedby={err ? "login-error" : undefined}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(err)}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    id="remember"
                    type="checkbox"
                    className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-blue-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>

                <a href="#" className="text-sm font-medium text-blue-200 hover:underline">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
