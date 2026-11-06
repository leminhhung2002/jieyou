import { useEffect, useState } from 'react';

/**
 * Gọi API khi mount, có huỷ request khi unmount.
 * `fallback` được dùng làm dữ liệu ban đầu để giao diện hiển thị ngay (không nhảy layout)
 * và vẫn hiển thị khi API lỗi.
 */
export function useApi(fetcher, deps = [], fallback = null) {
  const [state, setState] = useState({ data: fallback, loading: true, error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher({ signal: ctrl.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
