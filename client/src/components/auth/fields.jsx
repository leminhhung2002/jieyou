import { useEffect, useId, useRef, useState } from 'react';
import { asset } from '../../utils/format.js';
import styles from './Auth.module.css';

export function AuthHeader({ title, subtitle }) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}

/** Ô nhập có nhãn, icon, thông báo lỗi; type="password" có nút hiện/ẩn. */
export function TextField({ label, icon, error, type = 'text', className = '', inputRef, ...props }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.inputBox} ${error ? styles.inputError : ''}`}>
        {icon && <img src={asset(`auth/${icon}.svg`)} width="20" height="20" alt="" />}
        <input
          id={id}
          ref={inputRef}
          type={isPassword && reveal ? 'text' : type}
          className={isPassword && !reveal ? styles.passwordInput : ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.eye}
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={reveal}
          >
            <img src={asset('auth/ic-eye.svg')} width="20" height="20" alt="" />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

export function PrimaryButton({ loading, children, ...props }) {
  return (
    <button className={styles.primary} disabled={loading || props.disabled} {...props}>
      {loading ? 'Đang xử lý…' : children}
    </button>
  );
}

export function FormAlert({ children, tone = 'error' }) {
  if (!children) return null;
  return (
    <p className={`${styles.alert} ${tone === 'info' ? styles.alertInfo : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

/** 6 ô nhập OTP: tự chuyển ô, xoá lùi, dán cả mã, chỉ nhận chữ số. */
export function OtpInput({ value, onChange, length = 6, autoFocus = true, error }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i, d) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  const onInput = (i, e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (!v) return setAt(i, '');
    if (v.length > 1) {
      // nhiều chữ số (autofill SMS / dán) -> điền từ ô hiện tại
      const next = digits.slice();
      v.split('').forEach((d, k) => {
        if (i + k < length) next[i + k] = d;
      });
      onChange(next.join(''));
      refs.current[Math.min(i + v.length, length - 1)]?.focus();
      return undefined;
    }
    setAt(i, v);
    if (i < length - 1) refs.current[i + 1]?.focus();
    return undefined;
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      setAt(i - 1, '');
      refs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!v) return;
    e.preventDefault();
    onChange(v);
    refs.current[Math.min(v.length, length - 1)]?.focus();
  };

  return (
    <div className={styles.otp} role="group" aria-label="Mã OTP 6 số">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`${styles.otpBox} ${error ? styles.inputError : ''}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="\d*"
          maxLength={length}
          value={d}
          aria-label={`Chữ số ${i + 1}`}
          onChange={(e) => onInput(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

/** Đếm ngược tới khi được gửi lại mã. */
export function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** "0912345678" -> "0912 345 678" */
export const prettyPhone = (p) => String(p || '').replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

export function ResendLine({ secondsLeft, onResend, sending }) {
  return (
    <p className={styles.resend}>
      {secondsLeft > 0 ? <span>Gửi lại mã sau {mmss(secondsLeft)}&nbsp;&nbsp;</span> : <span>Chưa nhận được mã?&nbsp;&nbsp;</span>}
      <button type="button" className={styles.resendBtn} onClick={onResend} disabled={secondsLeft > 0 || sending}>
        {sending ? 'Đang gửi…' : 'Gửi lại'}
      </button>
    </p>
  );
}

/** Hiển thị mã OTP ở môi trường dev (server trả devCode khi không phải production). */
export function DevCodeHint({ code }) {
  if (!code || import.meta.env.PROD) return null;
  return <p className={styles.devHint}>[DEV] Mã OTP: {code}</p>;
}
