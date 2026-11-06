import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../../account/accountApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset, formatVnd } from '../../utils/format.js';
import { BottomBar, ErrorText, PrimaryButton, Screen, TopBar, vnd } from '../ui.jsx';
import styles from './Topup.module.css';

const PRESETS = [500_000, 1_000_000, 5_000_000, 10_000_000, 20_000_000];
const DEFAULT_LIMITS = { min: 50_000, max: 50_000_000 };

// Figma: "Nạp tiền" (121:15832)
export default function TopupPage() {
  useDocumentTitle('Nạp tiền – JIEYOU');
  const navigate = useNavigate();
  const [amount, setAmount] = useState(5_000_000);
  const [balance, setBalance] = useState(null);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const opts = { signal: ctrl.signal };
    accountApi.summary(opts).then((s) => setBalance(s.stats.balance)).catch(() => {});
    accountApi.catalog(opts).then((c) => c.topupLimits && setLimits(c.topupLimits)).catch(() => {});
    return () => ctrl.abort();
  }, []);

  const onInput = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    setAmount(digits ? Number(digits) : 0);
    setError('');
  };

  const validate = () => {
    if (!amount || amount < limits.min) return `Số tiền nạp tối thiểu ${vnd(limits.min)}`;
    if (amount > limits.max) return `Số tiền nạp tối đa ${vnd(limits.max)}`;
    return '';
  };

  async function submit(e) {
    e.preventDefault();
    const msg = validate();
    if (msg) return setError(msg);
    setLoading(true);
    setError('');
    try {
      const res = await accountApi.topup(amount);
      navigate('/app/nap-tien/thanh-cong', {
        replace: true,
        state: { amount, txId: res.transaction?.id, balance: res.balance },
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
    return undefined;
  }

  const shown = amount ? formatVnd(amount) : '';

  return (
    <Screen className={styles.withBar}>
      <TopBar title="Nạp tiền" backTo="/app" />
      <form id="m-topup" className={styles.body} onSubmit={submit} noValidate>
        <div className={styles.amountCard}>
          <label htmlFor="m-amount" className={styles.caption}>
            Số tiền nạp
          </label>
          <div className={styles.amountRow}>
            <span className={styles.amountField}>
              <span className={styles.sizer} aria-hidden="true">
                {shown || '0'}
              </span>
              <input
                id="m-amount"
                className={styles.amountInput}
                size={1}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={shown}
                onChange={onInput}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-describedby={error ? "m-amount-err" : undefined}
                aria-invalid={Boolean(error)}
              />
            </span>
            <span className={`${styles.caret} ${focused ? styles.caretBlink : ''}`} aria-hidden="true" />
            <span className={styles.currency}>đ</span>
          </div>
          <div className={styles.presets} role="group" aria-label="Chọn nhanh số tiền">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.preset} ${amount === p ? styles.presetActive : ''}`}
                aria-pressed={amount === p}
                onClick={() => {
                  setAmount(p);
                  setError('');
                }}
              >
                {formatVnd(p)}
              </button>
            ))}
          </div>
          {error && <div id="m-amount-err"><ErrorText>{error}</ErrorText></div>}
        </div>

        <div className={styles.method} role="radiogroup" aria-label="Phương thức nạp">
          <span className={styles.methodIcon}>
            <img src={asset('mobile/nap-tien/bank.svg')} width="22" height="22" alt="" />
          </span>
          <span className={styles.methodText}>
            <span className={styles.methodName}>Cổng thanh toán Bảo Việt</span>
            <span className={styles.methodSub}>Thẻ nội địa, QR, thẻ quốc tế</span>
          </span>
          <span className={styles.radio} role="radio" aria-checked="true" aria-label="Cổng thanh toán Bảo Việt" tabIndex={0} />
        </div>

        <div className={styles.summary}>
          <div className={styles.sumRowPlain}>
            <span className={styles.sumLabel}>Số dư hiện tại</span>
            <span className={styles.sumValue}>{balance === null ? '—' : vnd(balance)}</span>
          </div>
          <SumRow icon="plus" label="Số tiền nạp" value={vnd(amount)} />
          <SumRow icon="plus" label="Phí nạp" value={vnd(0)} />
          <SumRow icon="equals" label="Số dư mới" value={balance === null ? '—' : vnd(balance + amount)} total />
        </div>
      </form>

      <BottomBar>
        <PrimaryButton type="submit" form="m-topup" loading={loading}>
          Nạp {vnd(amount)}
        </PrimaryButton>
      </BottomBar>
    </Screen>
  );
}

export function SumRow({ icon, label, value, total }) {
  return (
    <div className={total ? styles.sumRowTotal : styles.sumRow}>
      <span className={styles.sumIcon} aria-hidden="true">
        <img src={asset(`mobile/nap-tien/${icon}.svg`)} width="12" height="12" alt="" />
      </span>
      <span className={total ? styles.sumLabelTotal : styles.sumLabelFlex}>{label}</span>
      <span className={total ? styles.sumValueTotal : styles.sumValue}>{value}</span>
    </div>
  );
}
