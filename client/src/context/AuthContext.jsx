import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStorage } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!tokenStorage.get());

  // Khôi phục phiên từ token đã lưu
  useEffect(() => {
    if (!tokenStorage.get()) return undefined;
    const ctrl = new AbortController();
    api
      .me({ signal: ctrl.signal })
      .then(setUser)
      .catch((err) => {
        if (err.name !== 'AbortError') tokenStorage.clear();
      })
      .finally(() => {
        // StrictMode (dev) huỷ lần gọi đầu – chỉ đánh dấu sẵn sàng khi request thực sự kết thúc
        if (!ctrl.signal.aborted) setReady(true);
      });
    return () => ctrl.abort();
  }, []);

  const signIn = useCallback(({ token, user: u }) => {
    tokenStorage.set(token);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
