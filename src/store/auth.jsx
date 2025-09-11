import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Api } from "../lib/api.js";

const AUTH_KEY = "vw_auth";

const USE_MOCK =
  String(import.meta.env.VITE_USE_MOCK_API ?? "true").toLowerCase() !== "false";

const MOCK_USERS = {
  admin: { password: "admin123", role: "admin" },
  viewer: { password: "viewer123", role: "viewer" },
};

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      else localStorage.removeItem(AUTH_KEY);
    } catch {}
  }, [user]);

  const login = async ({ username, password }) => {
    const u = String(username || "").trim().toLowerCase();

    if (USE_MOCK) {
      const rec = MOCK_USERS[u];
      if (!rec || rec.password !== String(password || "")) {
        throw new Error("Invalid credentials");
      }
      setUser({ username: u, role: rec.role, token: "mock" });
      return;
    }

    
    const res = await Api.login(username, password); 
    setUser({
      username: res.username ?? username,
      role: res.role,
      token: res.token,
    });
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      login,
      logout,
      isAuthenticated: !!user,
      role: user?.role ?? "viewer",
      username: user?.username ?? "",
      token: user?.token ?? "",
      useMock: USE_MOCK,
    }),
    [user]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
