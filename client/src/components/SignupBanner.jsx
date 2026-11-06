import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { asset } from '../utils/format.js';
import { cleanPhone, isValidVnPhone } from '../utils/validation.js';
import styles from './SignupBanner.module.css';

// Figma: Banner (112:11124) – "Tạo tài khoản miễn phí trong 1 phút"
export default function SignupBanner() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  function onSubmit(e) {
    e.preventDefault();
    if (!isValidVnPhone(phone)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    setError('');
    // Điền sẵn số điện thoại vào form đăng ký; OTP được gửi sau khi nhập đủ thông tin doanh nghiệp
    navigate('/dang-ky', { state: { phone: cleanPhone(phone) } });
  }

  return (
    <section className={styles.section} aria-labelledby="signup-banner-title">
      <div className={styles.card}>
        <div className={styles.image} aria-hidden="true">
          <img src={asset('banner/image.png')} alt="" />
        </div>
        <span className={styles.vector} aria-hidden="true">
          <img src={asset('banner/vector.svg')} alt="" />
        </span>

        <div className={styles.content}>
          <h2 id="signup-banner-title" className={styles.title}>
            Tạo tài khoản miễn phí trong 1 phút
          </h2>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <label className={styles.field}>
              <span className="sr-only">Số điện thoại</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'signup-banner-error' : undefined}
                maxLength={15}
              />
            </label>
            <button type="submit" className={styles.submit}>
              Nhận OTP
            </button>
          </form>
          <p id="signup-banner-error" className={styles.error} role="alert">
            {error}
          </p>
        </div>

        <span className={styles.v174} aria-hidden="true">
          <span>
            <img src={asset('banner/vector174.svg')} alt="" />
          </span>
        </span>
        <span className={styles.v175} aria-hidden="true">
          <span>
            <img src={asset('banner/vector175.svg')} alt="" />
          </span>
        </span>
      </div>
      <span className={styles.notch} aria-hidden="true">
        <img src={asset('banner/notch.svg')} alt="" />
      </span>
    </section>
  );
}
