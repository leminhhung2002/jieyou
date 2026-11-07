import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { asset } from '../utils/format.js';
import { cleanPhone, isEmail, isValidVnPhone } from '../utils/validation.js';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import {
  AuthHeader, DevCodeHint, FormAlert, OtpInput, PrimaryButton, ResendLine, TextField, prettyPhone, useCountdown,
} from '../components/auth/fields.jsx';
import styles from '../components/auth/Auth.module.css';

const EMPTY = { businessName: '', taxCode: '', phone: '', email: '', password: '', agreeTerms: false };

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

// Figma: Đăng ký (112:12952) + bước xác thực OTP (112:13090)
export default function RegisterPage() {
  useDocumentTitle('Tạo tài khoản – JIEYOU');
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [values, setValues] = useState({ ...EMPTY, phone: location.state?.phone || '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState('form');
  const [otpMeta, setOtpMeta] = useState(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useCountdown(0);
  const [resending, setResending] = useState(false);

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
      setStep('otp');
    } catch (err) {
      if (err.details?.field) setErrors({ [err.details.field]: err.message });
      else setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (code.length !== 6) {
      setFormError('Vui lòng nhập đủ 6 chữ số');
      return;
    }
    setFormError('');
    setLoading(true);
    try {
      const sessionData = await api.verifyRegistration(otpMeta.phone, code);
      signIn(sessionData);
      navigate('/tai-khoan', { replace: true, state: { welcome: true } });
    } catch (err) {
      setFormError(err.message);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setFormError('');
    try {
      const otp = await api.requestOtp(otpMeta.phone, 'register');
      setOtpMeta(otp);
      setSecondsLeft(otp.resendIn);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setResending(false);
    }
  }

  if (step === 'otp') {
    return (
      <AuthLayout wide>
        <AuthHeader title="Xác thực số điện thoại" subtitle={`Mã OTP đã gửi đến ${prettyPhone(otpMeta.phone)}`} />
        <form className={styles.form} onSubmit={submitOtp} noValidate>
          <div className={styles.otpGroup}>
            <span className={styles.label}>Nhập mã 6 số</span>
            <OtpInput value={code} onChange={setCode} error={Boolean(formError)} />
            <ResendLine secondsLeft={secondsLeft} onResend={resend} sending={resending} />
            <DevCodeHint code={otpMeta.devCode} />
          </div>
          <FormAlert>{formError}</FormAlert>
          <PrimaryButton type="submit" loading={loading}>
            Xác nhận
          </PrimaryButton>
          <p className={styles.foot}>
            Sai thông tin?&nbsp;
            <button type="button" className={styles.textBtn} onClick={() => setStep('form')}>
              Quay lại chỉnh sửa
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide>
      <AuthHeader title="Tạo tài khoản" subtitle="Đăng ký bằng thông tin doanh nghiệp." />
      <form className={styles.form} onSubmit={submitForm} noValidate>
        <div className={styles.fields}>
          <TextField
            label="Tên doanh nghiệp (không bắt buộc)"
            icon="ic-building"
            placeholder="Công ty TNHH An Phát"
            autoComplete="organization"
            value={values.businessName}
            onChange={set('businessName')}
            error={errors.businessName}
          />
          <div className={styles.row}>
            <TextField
              label="Mã số thuế (không bắt buộc)"
              placeholder="0123456789"
              inputMode="numeric"
              value={values.taxCode}
              onChange={set('taxCode')}
              error={errors.taxCode}
              maxLength={14}
            />
            <TextField
              label="Số điện thoại"
              type="tel"
              placeholder="0912 345 678"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              error={errors.phone}
              maxLength={15}
            />
          </div>
          <TextField
            label="Email"
            icon="ic-mail"
            type="email"
            placeholder="ten@congty.vn"
            autoComplete="email"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
          />
          <TextField
            label="Mật khẩu"
            icon="ic-lock"
            type="password"
            placeholder="Tối thiểu 8 ký tự"
            autoComplete="new-password"
            value={values.password}
            onChange={set('password')}
            error={errors.password}
          />
        </div>

        <label className={styles.agree}>
          <input type="checkbox" checked={values.agreeTerms} onChange={set('agreeTerms')} />
          <span className={styles.checkbox} style={errors.agreeTerms ? { borderColor: '#ff8a8a' } : undefined}>
            <img src={asset('auth/ic-check.svg')} width="14" height="14" alt="" />
          </span>
          <span>
            Tôi đồng ý với{' '}
            <Link to="/chinh-sach/dieu-khoan-su-dung" className={styles.link} target="_blank">
              Điều khoản sử dụng
            </Link>{' '}
            và{' '}
            <Link to="/chinh-sach/bao-ve-dlcn" className={styles.link} target="_blank">
              Chính sách bảo mật
            </Link>
            .
          </span>
        </label>

        <FormAlert>{formError}</FormAlert>
        <PrimaryButton type="submit" loading={loading}>
          Tạo tài khoản
        </PrimaryButton>
        <p className={styles.foot}>
          Đã có tài khoản?&nbsp;
          <Link to="/dang-nhap" className={styles.link}>
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
