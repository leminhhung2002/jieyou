import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi, adminToken, ADMIN_UNAUTHORIZED } from './adminApi.js';

const Ctx = createContext(null);

/** Phiên đăng nhập quản trị (tách biệt với phiên khách hàng). */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(!adminToken.get());

  useEffect(() => {
    if (!adminToken.get()) return undefined;
    const ctrl = new AbortController();
    adminApi
      .me({ signal: ctrl.signal })
      .then(setAdmin)
      .catch((e) => e.name !== 'AbortError' && adminToken.clear())
      .finally(() => {
        // StrictMode (dev) huỷ lần gọi đầu – chỉ đánh dấu sẵn sàng khi request thực sự kết thúc
        if (!ctrl.signal.aborted) setReady(true);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      adminToken.clear();
      setAdmin(null);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED, onUnauthorized);
  }, []);

  const signIn = useCallback(({ token, admin: a }) => {
    adminToken.set(token);
    setAdmin(a);
  }, []);
  const signOut = useCallback(() => {
    adminToken.clear();
    setAdmin(null);
  }, []);
  const can = useCallback((perm) => Boolean(admin?.permissions?.includes(perm)), [admin]);

  const value = useMemo(() => ({ admin, ready, signIn, signOut, can }), [admin, ready, signIn, signOut, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
