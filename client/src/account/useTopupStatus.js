import { useEffect, useRef, useState } from 'react';
import { accountApi } from './accountApi.js';

/**
 * Theo dõi lệnh nạp UniPay đang chờ: hỏi server mỗi `intervalMs` (server tự tra cứu UniPay nếu IPN chưa tới).
 * Dừng khi giao dịch hết "pending". Trả về { payment, error }.
 */
export function useTopupStatus(id, initial = null, intervalMs = 4000) {
  const [payment, setPayment] = useState(initial);
  const [error, setError] = useState('');
  const initialRef = useRef(initial);

  useEffect(() => {
    if (!id) return undefined;
    let stopped = false;
    let timer;
    const ctrl = new AbortController();
    if (initialRef.current?.id !== id) setPayment(null);

    const tick = async () => {
      try {
        const p = await accountApi.topupStatus(id, { signal: ctrl.signal });
        if (stopped) return;
        setPayment(p);
        setError('');
        if (p.status !== 'pending') return;
      } catch (err) {
        if (stopped || err.name === 'AbortError') return;
        setError(err.message || 'Không kiểm tra được trạng thái');
        if (err.status === 404) return;
      }
      // Trang ẩn (đổi tab) thì hỏi thưa hơn
      timer = setTimeout(tick, document.hidden ? intervalMs * 3 : intervalMs);
    };
    tick();
    return () => {
      stopped = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [id, intervalMs]);

  return { payment, error };
}
