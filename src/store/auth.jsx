import { createContext, useContext, useEffect, useState } from "react";
import { Api, USE_MOCK } from "../lib/api.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // {name, role}
  const [loading, setLoading] = useState(true); // true until /me resolves

  
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await Api.me();
        if (!alive) return;
        if (me && me.authenticated) setUser({ name: me.name, role: me.role });
        else setUser(null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = async ({ username, password }) => {
    const res = await Api.login({ username, password });
    setUser({ name: res.name, role: res.role });
    return res;
  };

  const logout = async () => {
    try { await Api.logout(); } catch {}
    setUser(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        useMock: USE_MOCK,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
