import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { mmss, prettyPhone, useCountdown } from '../../components/auth/fields.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { cleanPhone, isValidVnPhone } from '../../utils/validation.js';
import { BottomBar, DevCode, ErrorText, PrimaryButton } from '../ui.jsx';
import styles from './Auth.module.css';

// Figma: "Đăng nhập" (121:15778) – tab Mật khẩu / Mã OTP
export default function LoginPage() {
  useDocumentTitle('Đăng nhập – JIEYOU');
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const redirectTo = location.state?.from || '/app';

  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [identifier, setIdentifier] = useState(location.state?.phone || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [otpMeta, setOtpMeta] = useState(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useCountdown(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setOtpMeta(null);
    setCode('');
  };

  async function run(fn) {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const done = (session) => {
    signIn(session);
    navigate(redirectTo, { replace: true });
  };

  const sendOtp = () => {
    if (!isValidVnPhone(phone)) return setError('Số điện thoại không hợp lệ');
    return run(async () => {
      const otp = await api.requestOtp(cleanPhone(phone), 'login');
      setOtpMeta(otp);
      setSecondsLeft(otp.resendIn);
      setCode('');
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (mode === 'password') {
      if (!identifier.trim() || !password) return setError('Vui lòng nhập đầy đủ thông tin');
      return run(async () => done(await api.login(identifier.trim(), password)));
    }
    if (!otpMeta) return sendOtp();
    if (code.length !== 6) return setError('Vui lòng nhập đủ 6 chữ số');
    return run(async () => {
      try {
        done(await api.verifyOtp(otpMeta.phone, code, 'login'));
      } catch (err) {
        setCode('');
        throw err;
      }
    });
  };

  const cta = mode === 'otp' && !otpMeta ? 'Gửi mã OTP' : 'Đăng nhập';

  return (
    <div className={styles.page}>
      <header className={styles.logoBar}>
        <Link to="/" className={styles.logo} aria-label="JIEYOU – Trang chủ">
          <img src={asset('mobile/auth/logo-mark.svg')} width="34" height="34" alt="" className={styles.logoMark} />
          <span className={styles.logoText}>JIEYOU</span>
        </Link>
      </header>

      <form id="m-login" className={styles.loginBody} onSubmit={onSubmit} noValidate>
        <div className={styles.loginHeading}>
          <h1 className={styles.loginTitle}>Đăng nhập</h1>
          <p className={styles.loginSub}>
            {otpMeta ? `Mã OTP đã gửi đến email ${otpMeta.sentTo || prettyPhone(otpMeta.phone)}` : 'Chào mừng bạn quay lại.'}
          </p>
        </div>

        <div className={styles.group}>
          <div className={styles.tabs} role="tablist" aria-label="Cách đăng nhập">
            {[
              ['password', 'Mật khẩu'],
              ['otp', 'Mã OTP'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                className={`${styles.tab} ${mode === key ? styles.tabActive : ''}`}
                onClick={() => switchMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <>
              <Field id="m-identifier" label="Số điện thoại hoặc email" icon="user">
                <input
                  id="m-identifier"
                  className={styles.input}
                  inputMode="email"
                  autoComplete="username"
                  placeholder="0912 345 678"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </Field>
              <Field id="m-password" label="Mật khẩu" icon="lock" alt>
                <input
                  id="m-password"
                  className={`${styles.input} ${!showPw && password ? styles.inputPw : ''}`}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eye}
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPw}
                >
                  <img src={asset('mobile/auth/eye.svg')} width="20" height="20" alt="" />
                </button>
              </Field>
            </>
          ) : (
            <>
              <Field id="m-phone" label="Số điện thoại" icon="user">
                <input
                  id="m-phone"
                  className={styles.input}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0912 345 678"
                  value={phone}
                  readOnly={Boolean(otpMeta)}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              {otpMeta && (
                <OtpField
                  code={code}
                  setCode={setCode}
                  devCode={otpMeta.devCode}
                  secondsLeft={secondsLeft}
                  onResend={sendOtp}
                  onChangePhone={() => {
                    setOtpMeta(null);
                    setCode('');
                  }}
                  loading={loading}
                />
              )}
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </div>

        {mode === 'password' && (
          <div className={styles.forgotRow}>
            <Link to="/dang-nhap" className={styles.link}>
              Quên mật khẩu?
            </Link>
          </div>
        )}
      </form>

      <BottomBar panel>
        <PrimaryButton type="submit" form="m-login" loading={loading}>
          {cta}
        </PrimaryButton>
        <p className={styles.foot}>
          Chưa có tài khoản?{' '}
          <Link to="/app/dang-ky" state={location.state} className={styles.footLink}>
            Đăng ký
          </Link>
        </p>
      </BottomBar>
    </div>
  );
}

/** Ô nhập kiểu Figma 121:15807: icon 20px + chữ 16px, nền #f9f9fb. */
export function Field({ id, label, icon, alt, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.box} ${alt ? styles.boxAlt : ''}`}>
        {icon && <img src={asset(`mobile/auth/${icon}.svg`)} width="20" height="20" alt="" />}
        {children}
      </div>
    </div>
  );
}

/** Nhập mã OTP 6 số (một ô, hỗ trợ tự điền SMS) + gửi lại + mã DEV. */
export function OtpField({ code, setCode, devCode, secondsLeft, onResend, onChangePhone, loading }) {
  return (
    <div className={styles.field}>
      <label htmlFor="m-otp" className={styles.label}>
        Mã OTP
      </label>
      <div className={styles.box}>
        <input
          id="m-otp"
          className={`${styles.input} ${styles.otpInput}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          maxLength={6}
          placeholder="6 chữ số"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      <div className={styles.otpMeta}>
        <span>
          {secondsLeft > 0 ? `Gửi lại mã sau ${mmss(secondsLeft)}` : 'Chưa nhận được mã?'}{' '}
          <button type="button" className={styles.textBtn} onClick={onResend} disabled={secondsLeft > 0 || loading}>
            Gửi lại
          </button>
        </span>
        {onChangePhone && (
          <button type="button" className={styles.textBtn} onClick={onChangePhone}>
            Đổi số
          </button>
        )}
      </div>
      <DevCode code={devCode} />
    </div>
  );
}
