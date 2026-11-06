import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Cuộn tới #anchor sau khi điều hướng (React Router không tự làm), hoặc lên đầu trang khi đổi route. */
export function useScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // chờ trang render xong
      const id = decodeURIComponent(hash.slice(1));
      const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);
}
