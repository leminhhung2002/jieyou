import { Navigate, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { BottomBar, PrimaryButton, Screen, vnd } from '../ui.jsx';
import { SumRow } from './TopupPage.jsx';
import styles from './Topup.module.css';

// Figma: "Nạp tiền thành công" (121:15912)
export default function TopupSuccessPage() {
  useDocumentTitle('Nạp tiền thành công – JIEYOU');
  const { state } = useLocation();
  if (!state?.amount) return <Navigate to="/app" replace />;

  return (
    <Screen>
      <main className={styles.success}>
        <div className={styles.successHead}>
          <div className={styles.successRing} aria-hidden="true">
            <div className={styles.successIcon}>
              <div className={styles.successMark}>
                <img src={asset('mobile/ho-so/step-check.svg')} width="16" height="16" alt="" />
              </div>
            </div>
          </div>
          <div className={styles.successText}>
            <h1 className={styles.successTitle}>Nạp tiền thành công</h1>
            <p className={styles.successSub} role="status">
              {vnd(state.amount)} đã vào tài khoản trả trước.
            </p>
          </div>
        </div>

        <div className={styles.receipt}>
          {state.txId && (
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Mã giao dịch</span>
              <span className={styles.receiptValue}>{state.txId}</span>
            </div>
          )}
          {state.balance !== undefined && <SumRow icon="equals" label="Số dư mới" value={vnd(state.balance)} total />}
        </div>
      </main>

      <BottomBar>
        <PrimaryButton to="/app" replace>
          Về Trang chủ
        </PrimaryButton>
      </BottomBar>
    </Screen>
  );
}
