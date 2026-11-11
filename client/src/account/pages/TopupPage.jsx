import { useCallback, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset, formatVnd } from '../../utils/format.js';
import { vnd } from '../../admin/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import TopupPayment from '../TopupPayment.jsx';
import { Card, CostCard, FormError, FormLayout, PageHeader, PrimaryButton } from '../ui.jsx';
import styles from './TopupPage.module.css';

const PRESETS = [500000, 1000000, 5000000, 10000000, 20000000];
const DEFAULT_LIMITS = { min: 50000, max: 50000000 };
const METHODS = [
  { key: 'qr', title: 'Chuyển khoản QR', sub: 'Quét mã bằng app ngân hàng bất kỳ – vào tiền tự động' },
  { key: 'card', title: 'Thẻ ATM / Visa / Master / JCB', sub: 'Thanh toán thẻ qua cổng UniPay' },
];

/** Kiểm tra hạn mức nạp, trả về câu báo lỗi tiếng Việt hoặc null. */
function validate(amount, { min, max }) {
  if (!amount) return 'Vui lòng nhập số tiền cần nạp.';
  if (amount < min) return `Số tiền nạp tối thiểu là ${vnd(min)}.`;
  if (amount > max) return `Số tiền nạp tối đa mỗi lần là ${vnd(max)}.`;
  return null;
}

// Figma: Web người dùng: Nạp tiền (74:2396)
export default function TopupPage() {
  useDocumentTitle('Nạp tiền – JIEYOU');
  const { summary, catalog, refresh, toast } = useAccount();
  const navigate = useNavigate();
  const inputId = useId();
  const errId = `${inputId}-err`;
  const [amount, setAmount] = useState(5000000);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [method, setMethod] = useState('qr');
  const [params, setParams] = useSearchParams();
  // Lệnh nạp đang chờ thanh toán: vừa tạo, hoặc quay lại từ trang thẻ UniPay (?tx=...)
  const [pending, setPending] = useState(null);
  const pendingId = pending?.id || params.get('tx');

  const limits = catalog?.topupLimits || DEFAULT_LIMITS;
  const balance = summary?.stats.balance ?? 0;
  const error = validate(amount, limits);
  const showError = touched && error;
  const display = amount ? formatVnd(amount) : '';

  const onInput = (e) => {
    // Chỉ giữ chữ số, giới hạn 10 chữ số để tránh tràn
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setAmount(digits ? Number(digits) : 0);
    setSubmitError('');
  };

  const pick = (v) => {
    setAmount(v);
    setTouched(true);
    setSubmitError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (error || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await accountApi.topup(amount, method);
      const payment = res.payment;
      if (payment?.status === 'pending') {
        if (payment.method === 'card' && payment.paymentUrl) {
          window.location.assign(payment.paymentUrl);
          return;
        }
        setPending(payment);
        setParams({ tx: payment.id }, { replace: true });
        setSubmitting(false);
        return;
      }
      // Môi trường chưa cấu hình cổng thanh toán: tiền vào ngay
      await refresh();
      toast(`Đã nạp ${vnd(amount)} vào tài khoản trả trước.`);
      navigate('/tai-khoan/tra-truoc');
    } catch (err) {
      setSubmitError(err.message || 'Nạp tiền không thành công, vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  const onPaid = useCallback(
    async (p) => {
      await refresh();
      toast(`Đã nạp ${vnd(p.amount)} vào tài khoản trả trước.`);
      navigate('/tai-khoan/tra-truoc');
    },
    [refresh, toast, navigate],
  );
  const onCancel = () => {
    setPending(null);
    setParams({}, { replace: true });
  };

  return (
    <div className={styles.page}>
      <PageHeader
        className={styles.header}
        sticker="account/sticker/topup.png"
        eyebrow="Tài khoản trả trước"
        title="Nạp tiền"
        subtitle="Tiền vào tài khoản ngay khi UniPay xác nhận thanh toán. Phí nạp do nền tảng chịu."
      />

      <FormLayout
        main={
          pendingId ? (
            <TopupPayment key={pendingId} id={pendingId} initial={pending} onDone={onPaid} onCancel={onCancel} />
          ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.amountCard}>
              <label htmlFor={inputId} className={styles.amountLabel}>
                Số tiền nạp
              </label>
              <div className={styles.amountRow}>
                {/* Ô nhập tự giãn theo độ dài số: span ẩn quyết định độ rộng */}
                <span className={styles.amountSizer}>
                  <span aria-hidden="true">{display || '0'}</span>
                  <input
                    id={inputId}
                    className={styles.amountInput}
                    size={1}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={display}
                    onChange={onInput}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      setFocused(false);
                      setTouched(true);
                    }}
                    aria-invalid={showError ? true : undefined}
                    aria-describedby={showError ? errId : undefined}
                  />
                </span>
                {!focused && <span className={styles.caret} aria-hidden="true" />}
                <span className={styles.currency}>đ</span>
              </div>
              <div className={styles.presets} role="group" aria-label="Chọn nhanh số tiền">
                {PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.preset} ${amount === v ? styles.presetOn : ''}`}
                    aria-pressed={amount === v}
                    onClick={() => pick(v)}
                  >
                    {formatVnd(v)}
                  </button>
                ))}
              </div>
              {showError && (
                <p id={errId} className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </div>

            <Card title="Phương thức thanh toán" className={styles.methodCard}>
              <div role="radiogroup" aria-label="Phương thức thanh toán" className={styles.methods}>
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={method === m.key}
                    className={`${styles.method} ${method === m.key ? styles.methodOn : ''}`}
                    onClick={() => setMethod(m.key)}
                  >
                    <span className={styles.methodIcon}>
                      <img src={asset('account/topup/bank.svg')} width="26" height="26" alt="" />
                    </span>
                    <span className={styles.methodText}>
                      <span className={styles.methodTitle}>{m.title}</span>
                      <span className={styles.methodSub}>{m.sub}</span>
                    </span>
                    <span className={method === m.key ? styles.radio : styles.radioOff} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </Card>

            <div className={styles.submit}>
              <PrimaryButton type="submit" block disabled={submitting}>
                {submitting ? 'Đang xử lý…' : `Nạp ${amount ? vnd(amount) : ''}`.trim()}
              </PrimaryButton>
              <FormError>{submitError}</FormError>
            </div>
          </form>
          )
        }
        aside={
          <>
            <CostCard
              title="Hạn mức nạp"
              className={styles.limits}
              rows={[
                { label: 'Tối thiểu mỗi lần', value: vnd(limits.min) },
                { label: 'Tối đa mỗi lần', value: vnd(limits.max) },
                { label: 'Phí nạp', value: 'Nền tảng chịu' },
              ]}
            />
            <CostCard
              title="Chi tiết"
              className={styles.detail}
              rows={[
                { label: 'Số dư hiện tại', value: summary ? vnd(balance) : '—' },
                { label: 'Số tiền nạp', value: vnd(amount), sign: 'plus' },
                { label: 'Phí nạp', value: vnd(0), sign: 'plus' },
                { label: 'Số dư mới', value: summary ? vnd(balance + amount) : '—', sign: 'equals', total: true },
              ]}
              note={
                <>
                  <img src={asset('account/topup/info.svg')} width="18" height="18" alt="" />
                  <span>
                    Nếu đã thanh toán mà số dư chưa tăng sau vài phút, mở Lịch sử giao dịch hoặc liên hệ hỗ trợ kèm mã giao
                    dịch.
                  </span>
                </>
              }
            />
          </>
        }
      />
    </div>
  );
}
