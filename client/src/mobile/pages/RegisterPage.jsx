import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { prettyPhone, useCountdown } from '../../components/auth/fields.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { cleanPhone, isEmail, isValidVnPhone } from '../../utils/validation.js';
import { BackButton, BottomBar, ErrorText, PrimaryButton } from '../ui.jsx';
import { OtpField } from './LoginPage.jsx';
import styles from './Auth.module.css';

const EMPTY = { businessName: '', taxCode: '', phone: '', email: '', password: '', agreeTerms: false };

// Cùng quy tắc với trang Đăng ký trên Web (pages/RegisterPage.jsx)
function validate(v) {
  const e = {};
  // Tên doanh nghiệp và mã số thuế không bắt buộc
  if (v.taxCode.trim() && !/^\d{10}(-?\d{3})?$/.test(v.taxCode.trim())) e.taxCode = 'Mã số thuế gồm 10 hoặc 13 chữ số';
  if (!isValidVnPhone(v.phone)) e.phone = 'Số điện thoại không hợp lệ';
  if (!isEmail(v.email)) e.email = 'Email không hợp lệ';
  if (v.password.length < 8) e.password = 'Mật khẩu tối thiểu 8 ký tự';
  if (!v.agreeTerms) e.agreeTerms = 'Bạn cần đồng ý với điều khoản';
  return e;
}

const FIELDS = [
  { key: 'businessName', label: 'Tên doanh nghiệp (không bắt buộc)', placeholder: 'Công ty TNHH An Phát', autoComplete: 'organization' },
  { key: 'taxCode', label: 'Mã số thuế (không bắt buộc)', placeholder: '0123456789', inputMode: 'numeric', maxLength: 14 },
  { key: 'phone', label: 'Số điện thoại', placeholder: '0912 345 678', type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 15 },
  { key: 'email', label: 'Email', placeholder: 'ten@congty.vn', type: 'email', inputMode: 'email', autoComplete: 'email' },
  { key: 'password', label: 'Mật khẩu', placeholder: 'Tối thiểu 8 ký tự', type: 'password', autoComplete: 'new-password' },
];

// Figma: "Sign Up" (121:15747) + bước xác thực OTP (dùng lại giao diện ô nhập của Đăng nhập)
export default function RegisterPage() {
  useDocumentTitle('Tạo tài khoản – JIEYOU');
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [values, setValues] = useState({ ...EMPTY, phone: location.state?.phone || '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMeta, setOtpMeta] = useState(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useCountdown(0);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  async function submitForm(e) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const otp = await api.register({ ...values, phone: cleanPhone(values.phone), taxCode: values.taxCode.trim() });
      setOtpMeta(otp);
      setSecondsLeft(otp.resendIn);
      setCode('');
    } catch (err) {
      if (err.details?.field) setErrors({ [err.details.field]: err.message });
      else setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (code.length !== 6) return setFormError('Vui lòng nhập đủ 6 chữ số');
    setFormError('');
    setLoading(true);
    try {
      signIn(await api.verifyRegistration(otpMeta.phone, code));
      navigate(location.state?.from || '/app', { replace: true });
    } catch (err) {
      setFormError(err.message);
      setCode('');
    } finally {
      setLoading(false);
    }
    return undefined;
  }

  async function resend() {
    setFormError('');
    try {
      const otp = await api.requestOtp(otpMeta.phone, 'register');
      setOtpMeta(otp);
      setSecondsLeft(otp.resendIn);
    } catch (err) {
      setFormError(err.message);
    }
  }

  const onOtp = Boolean(otpMeta);

  return (
    <div className={styles.signupPage}>
      <header className={styles.signupHeader}>
        <div className={styles.signupNav}>
          {onOtp ? (
            <button type="button" className={styles.iconBtn} onClick={() => setOtpMeta(null)} aria-label="Quay lại chỉnh sửa">
              <img src={asset('mobile/ui/arrow-left.svg')} width="20" height="20" alt="" />
            </button>
          ) : (
            <BackButton to="/app/dang-nhap" />
          )}
        </div>
        <div className={styles.signupHeading}>
          <h1 className={styles.signupTitle}>{onOtp ? 'Xác thực email' : 'Tạo tài khoản'}</h1>
          <p className={styles.signupSub}>
            {onOtp ? `Mã OTP đã gửi đến email ${otpMeta.sentTo || prettyPhone(otpMeta.phone)}` : 'Đăng ký bằng thông tin doanh nghiệp.'}
          </p>
        </div>
      </header>

      {onOtp ? (
        <form id="m-register" className={styles.signupBody} onSubmit={submitOtp} noValidate>
          <OtpField code={code} setCode={setCode} devCode={otpMeta.devCode} secondsLeft={secondsLeft} onResend={resend} loading={loading} />
          <ErrorText>{formError}</ErrorText>
        </form>
      ) : (
        <form id="m-register" className={styles.signupBody} onSubmit={submitForm} noValidate>
          {FIELDS.map(({ key, label, ...input }) => (
            <div key={key} className={styles.sField}>
              <label htmlFor={`m-reg-${key}`} className={styles.sLabel}>
                {label}
              </label>
              <input
                id={`m-reg-${key}`}
                className={`${styles.sInput} ${errors[key] ? styles.sInputError : ''}`}
                value={values[key]}
                onChange={set(key)}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `m-reg-${key}-err` : undefined}
                {...input}
              />
              {errors[key] && (
                <span id={`m-reg-${key}-err`} className={styles.fieldError}>
                  {errors[key]}
                </span>
              )}
            </div>
          ))}

          <label className={styles.agree}>
            <input type="checkbox" className={styles.agreeInput} checked={values.agreeTerms} onChange={set('agreeTerms')} />
            <span className={`${styles.checkbox} ${errors.agreeTerms ? styles.checkboxError : ''}`} aria-hidden="true">
              <img src={asset('auth/ic-check.svg')} width="14" height="14" alt="" />
            </span>
            <span className={styles.agreeText}>
              Tôi đồng ý với{' '}
              <Link to="/chinh-sach/dieu-khoan-su-dung" className={styles.agreeLink} target="_blank">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link to="/chinh-sach/bao-ve-dlcn" className={styles.agreeLink} target="_blank">
                Chính sách bảo mật
              </Link>
              .
            </span>
          </label>
          {errors.agreeTerms && <span className={styles.fieldError}>{errors.agreeTerms}</span>}
          <ErrorText>{formError}</ErrorText>
        </form>
      )}

      <BottomBar panel>
        <PrimaryButton type="submit" form="m-register" loading={loading}>
          {onOtp ? 'Xác nhận' : 'Tạo tài khoản'}
        </PrimaryButton>
        <p className={styles.foot}>
          Đã có tài khoản?{' '}
          <Link to="/app/dang-nhap" state={location.state} className={styles.footLink}>
            Đăng nhập
          </Link>
        </p>
      </BottomBar>
    </div>
  );
}
