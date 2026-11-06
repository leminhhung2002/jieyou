import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { cleanPhone, isValidVnPhone } from '../utils/validation.js';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import {
  AuthHeader, DevCodeHint, FormAlert, OtpInput, PrimaryButton, ResendLine, TextField, prettyPhone, useCountdown,
} from '../components/auth/fields.jsx';
import styles from '../components/auth/Auth.module.css';

/**
 * Figma: Đăng nhập – tab Mật khẩu (112:13027) và tab Mã OTP (112:13090).
 * Thêm luồng "Quên mật khẩu" dùng lại giao diện OTP.
 */
export default function LoginPage() {
  useDocumentTitle('Đăng nhập – JIEYOU');
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const redirectTo = location.state?.from || '/tai-khoan';

  const [mode, setMode] = useState('password'); // 'password' | 'otp' | 'reset'
  const [identifier, setIdentifier] = useState(location.state?.phone || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [otpMeta, setOtpMeta] = useState(null); // != null => đã gửi mã
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [secondsLeft, setSecondsLeft] = useCountdown(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.notice || '');
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
    setOtpMeta(null);
    setCode('');
    setResetToken(null);
  };

  const done = (sessionData) => {
    signIn(sessionData);
    navigate(redirectTo, { replace: true });
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

  const loginWithPassword = (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return setError('Vui lòng nhập đầy đủ thông tin');
    return run(async () => done(await api.login(identifier.trim(), password)));
  };

  const purpose = mode === 'reset' ? 'reset' : 'login';

  const sendOtp = (e) => {
    e?.preventDefault();
    if (!isValidVnPhone(phone)) return setError('Số điện thoại không hợp lệ');
    return run(async () => {
      const otp = await api.requestOtp(cleanPhone(phone), purpose);
      setOtpMeta(otp);
      setSecondsLeft(otp.resendIn);
      setCode('');
    });
  };

  const verifyOtp = (e) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Vui lòng nhập đủ 6 chữ số');
    return run(async () => {
      try {
        const res = await api.verifyOtp(otpMeta.phone, code, purpose);
        if (purpose === 'login') done(res);
        else setResetToken(res.verificationToken);
      } catch (err) {
        setCode('');
        throw err;
      }
    });
  };

  const submitNewPassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return setError('Mật khẩu tối thiểu 8 ký tự');
    return run(async () => {
      await api.resetPassword(resetToken, newPassword);
      switchMode('password');
      setIdentifier(otpMeta.phone);
      setInfo('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.');
    });
  };

  const subtitle =
    mode === 'reset'
      ? resetToken
        ? 'Tạo mật khẩu mới cho tài khoản.'
        : otpMeta
          ? `Mã OTP đã gửi đến ${prettyPhone(otpMeta.phone)}`
          : 'Nhận mã OTP qua số điện thoại đã đăng ký.'
      : otpMeta
        ? `Mã OTP đã gửi đến ${prettyPhone(otpMeta.phone)}`
        : 'Chào mừng bạn quay lại.';

  const otpStep = (
    <form className={styles.form} onSubmit={otpMeta ? verifyOtp : sendOtp} noValidate>
      <div className={styles.loginBody}>
        {mode !== 'reset' && <Tabs mode={mode} onChange={switchMode} />}
        {otpMeta ? (
          <div className={styles.otpGroup}>
            <span className={styles.label}>Nhập mã 6 số</span>
            <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
            <ResendLine secondsLeft={secondsLeft} onResend={sendOtp} sending={loading} />
            <DevCodeHint code={otpMeta.devCode} />
          </div>
        ) : (
          <TextField
            label="Số điện thoại"
            icon="ic-user"
            type="tel"
            placeholder="0912 345 678"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={15}
            autoFocus
          />
        )}
      </div>
      <FormAlert tone="info">{info}</FormAlert>
      <FormAlert>{error}</FormAlert>
      {mode === 'otp' && (
        <p className={styles.foot}>
          Không nhận được mã?&nbsp;
          <button type="button" className={styles.textBtn} onClick={() => switchMode('password')}>
            Nhập bằng mật khẩu
          </button>
        </p>
      )}
      <PrimaryButton type="submit" loading={loading}>
        {otpMeta ? 'Xác nhận' : 'Gửi mã OTP'}
      </PrimaryButton>
      {mode === 'reset' ? (
        <p className={styles.foot}>
          <button type="button" className={styles.textBtn} onClick={() => switchMode('password')}>
            Quay lại đăng nhập
          </button>
        </p>
      ) : (
        <SignupHint />
      )}
    </form>
  );

  let body;
  if (mode === 'password') {
    body = (
      <form className={`${styles.form} ${styles.loginForm}`} onSubmit={loginWithPassword} noValidate>
        <div className={styles.loginBody}>
          <Tabs mode={mode} onChange={switchMode} />
          <div className={styles.stack}>
            <TextField
              label="Số điện thoại hoặc email"
              icon="ic-user"
              placeholder="0912 345 678"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <TextField
              label="Mật khẩu"
              icon="ic-lock"
              type="password"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className={styles.forgot} onClick={() => switchMode('reset')}>
              Quên mật khẩu?
            </button>
          </div>
        </div>
        <FormAlert tone="info">{info}</FormAlert>
        <FormAlert>{error}</FormAlert>
        <PrimaryButton type="submit" loading={loading}>
          Đăng nhập
        </PrimaryButton>
        <SignupHint />
      </form>
    );
  } else if (mode === 'reset' && resetToken) {
    body = (
      <form className={styles.form} onSubmit={submitNewPassword} noValidate>
        <TextField
          label="Mật khẩu mới"
          icon="ic-lock"
          type="password"
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoFocus
        />
        <FormAlert>{error}</FormAlert>
        <PrimaryButton type="submit" loading={loading}>
          Lưu mật khẩu
        </PrimaryButton>
      </form>
    );
  } else {
    body = otpStep;
  }

  return (
    <AuthLayout>
      <AuthHeader title={mode === 'reset' ? 'Quên mật khẩu' : 'Đăng nhập'} subtitle={subtitle} />
      {body}
    </AuthLayout>
  );
}

function Tabs({ mode, onChange }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Phương thức đăng nhập">
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
          onClick={() => mode !== key && onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SignupHint() {
  return (
    <p className={styles.foot}>
      Chưa có tài khoản?&nbsp;
      <Link to="/dang-ky" className={styles.link}>
        Đăng ký
      </Link>
    </p>
  );
}
