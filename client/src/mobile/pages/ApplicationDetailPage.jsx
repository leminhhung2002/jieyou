import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { accountApi } from '../../account/accountApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import {
  AppTypeIcon, BottomBar, ErrorText, Muted, PrimaryButton, SERVICE_PAGES, Screen, TopBar, fmtDateTime, fmtDayMonth, vnd,
} from '../ui.jsx';
import styles from './Detail.module.css';

// Figma: "Chi tiết hồ sơ bị từ chối" (121:16043) – dùng chung cho mọi trạng thái
export default function ApplicationDetailPage() {
  const { code } = useParams();
  useDocumentTitle(`${code} – JIEYOU`);
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    setApp(null);
    setError('');
    accountApi
      .application(code, { signal: ctrl.signal })
      .then(setApp)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, [code]);

  const rejected = app?.status === 'rejected';
  const pay = app?.payment;

  return (
    <Screen className={styles.withBar}>
      <TopBar title={code} backTo="/app/ho-so" />
      <main className={styles.body}>
        <ErrorText>{error}</ErrorText>
        {!app && !error && <Muted>Đang tải…</Muted>}
        {app && (
          <>
            <div className={styles.head}>
              <div className={styles.headText}>
                <h2 className={styles.service}>{app.service}</h2>
                <p className={styles.sentAt}>Gửi lúc {fmtDateTime(app.submittedAt)}</p>
              </div>
              <AppTypeIcon type={app.type} status={app.status} />
            </div>

            {rejected && app.rejectReason && (
              <div className={styles.reason} role="note">
                <p className={styles.reasonTitle}>Lý do từ chối</p>
                <p className={styles.reasonText}>{app.rejectReason}</p>
              </div>
            )}

            {app.timeline?.length > 0 && (
              <ol className={styles.timeline} aria-label="Tiến trình hồ sơ">
                {app.timeline.map((s, i) => {
                  const next = app.timeline[i + 1];
                  const state = s.rejected ? 'rejected' : s.done ? 'done' : s.current ? 'current' : 'todo';
                  return (
                    <Fragment key={s.key}>
                      <li className={styles.step} aria-current={s.current ? 'step' : undefined}>
                        <span className={`${styles.stepDot} ${styles[`dot_${state}`]}`}>
                          {(state === 'done' || state === 'rejected') && (
                            <img
                              src={asset(`mobile/ho-so/${state === 'rejected' ? 'step-x' : 'step-check'}.svg`)}
                              width="16"
                              height="16"
                              alt=""
                            />
                          )}
                        </span>
                        <span className={styles.stepText}>
                          <span className={styles.stepLabel}>{s.label}</span>
                          <span className={styles.stepDate}>{s.at ? fmtDayMonth(s.at) : '—'}</span>
                        </span>
                      </li>
                      {next && (
                        <li className={styles.connector} aria-hidden="true">
                          <span className={next.done || next.rejected ? styles.lineDone : styles.lineTodo} />
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ol>
            )}

            {pay && (
              <div className={styles.money}>
                <div className={styles.moneyRow}>
                  <span className={styles.moneyLabel}>{pay.kind === 'held' ? 'Tạm giữ' : 'Đã trừ'}</span>
                  <span className={styles.moneyValue}>{vnd(pay.charged)}</span>
                </div>
                {pay.refund && (
                  <div className={styles.moneyRow}>
                    <span className={styles.moneyLabel}>Hoàn tiền</span>
                    <span className={styles.moneyValue}>
                      {pay.refund.done ? `Đã hoàn ${vnd(pay.refund.amount)}` : 'Chờ kế toán duyệt'}
                    </span>
                  </div>
                )}
                {app.invoiceNo && (
                  <div className={styles.moneyRow}>
                    <span className={styles.moneyLabel}>Hóa đơn</span>
                    <span className={styles.moneyValue}>{app.invoiceNo}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {app && (
        <BottomBar>
          {rejected ? (
            <PrimaryButton to={SERVICE_PAGES[app.type] || '/tai-khoan'}>Sửa và gửi lại</PrimaryButton>
          ) : (
            <PrimaryButton to="/app/ho-so">Về danh sách</PrimaryButton>
          )}
        </BottomBar>
      )}
    </Screen>
  );
}
