import { useEffect, useRef, useState } from 'react';
import { vnd } from '../admin/format.js';
import { useTopupStatus } from './useTopupStatus.js';
import styles from './TopupPayment.module.css';

/**
 * Màn chờ thanh toán lệnh nạp UniPay (dùng chung Web + App):
 * QR chuyển khoản / trạng thái thẻ, tự hỏi server đến khi giao dịch thành công hoặc thất bại.
 * `onDone(payment)` gọi một lần khi status = success.
 */
export default function TopupPayment({ id, initial, onDone, onCancel }) {
  const { payment, error } = useTopupStatus(id, initial);
  const [copied, setCopied] = useState('');
  const doneRef = useRef(false);
  const p = payment || initial;

  useEffect(() => {
    if (p?.status === 'success' && !doneRef.current) {
      doneRef.current = true;
      onDone?.(p);
    }
  }, [p, onDone]);

  const copy = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* trình duyệt chặn clipboard: bỏ qua */
    }
  };

  if (!p) {
    return (
      <div className={styles.card} role="status">
        <p className={styles.waiting}>{error || 'Đang tải thông tin thanh toán…'}</p>
        {error && onCancel && (
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Tạo lệnh nạp khác
          </button>
        )}
      </div>
    );
  }

  if (p.status === 'failed') {
    return (
      <div className={styles.card} role="alert">
        <h2 className={styles.title}>Lệnh nạp không thành công</h2>
        <p className={styles.muted}>Mã giao dịch {p.id}. Bạn chưa bị trừ tiền, vui lòng tạo lệnh nạp mới.</p>
        {onCancel && (
          <button type="button" className={styles.primary} onClick={onCancel}>
            Tạo lệnh nạp mới
          </button>
        )}
      </div>
    );
  }

  if (p.status === 'success') {
    return (
      <div className={styles.card} role="status">
        <h2 className={styles.title}>Đã nhận {vnd(p.amount)}</h2>
        <p className={styles.muted}>Tiền đã vào tài khoản trả trước. Số dư mới: {vnd(p.balance ?? 0)}.</p>
      </div>
    );
  }

  const isQr = p.method === 'qr';
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>{isQr ? 'Quét mã QR để thanh toán' : 'Đang chờ thanh toán thẻ'}</h2>
        <p className={styles.muted}>
          {isQr
            ? 'Mở ứng dụng ngân hàng bất kỳ, quét mã và xác nhận. Số tiền và nội dung đã điền sẵn – vui lòng không sửa.'
            : 'Hoàn tất thanh toán ở trang UniPay. Trang này tự cập nhật khi có kết quả.'}
        </p>
      </div>

      {isQr && p.qrImage && (
        <div className={styles.qrWrap}>
          <img className={styles.qr} src={`data:image/png;base64,${p.qrImage}`} width="240" height="240" alt={`Mã QR chuyển khoản ${vnd(p.amount)}`} />
        </div>
      )}

      <dl className={styles.rows}>
        <div>
          <dt>Số tiền</dt>
          <dd className={styles.amount}>{vnd(p.amount)}</dd>
        </div>
        {isQr && p.bank && (
          <>
            <div>
              <dt>Ngân hàng</dt>
              <dd>{p.bank.name}</dd>
            </div>
            <div>
              <dt>Số tài khoản</dt>
              <dd>
                <button type="button" className={styles.copy} onClick={() => copy('acc', p.bank.accountNo)}>
                  {p.bank.accountNo} <span>{copied === 'acc' ? 'Đã chép' : 'Chép'}</span>
                </button>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Mã đơn</dt>
          <dd>
            <button type="button" className={styles.copy} onClick={() => copy('order', p.orderId)}>
              {p.orderId} <span>{copied === 'order' ? 'Đã chép' : 'Chép'}</span>
            </button>
          </dd>
        </div>
      </dl>

      <p className={styles.waiting} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" /> Đang chờ xác nhận thanh toán…
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        {isQr && p.checkoutUrl && (
          <a className={styles.primary} href={p.checkoutUrl} target="_blank" rel="noopener noreferrer">
            Mở trang thanh toán UniPay
          </a>
        )}
        {!isQr && p.paymentUrl && (
          <a className={styles.primary} href={p.paymentUrl}>
            Tiếp tục thanh toán thẻ
          </a>
        )}
        {onCancel && (
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Tạo lệnh nạp khác
          </button>
        )}
      </div>
      <p className={styles.note}>
        Tiền vào tài khoản tự động trong vài giây sau khi ngân hàng xác nhận. Bạn có thể rời trang này – lệnh nạp vẫn
        được ghi nhận khi thanh toán xong.
      </p>
    </div>
  );
}
