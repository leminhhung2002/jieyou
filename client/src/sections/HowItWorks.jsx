import { useEffect, useRef, useState } from 'react';
import { asset } from '../utils/format.js';
import styles from './HowItWorks.module.css';

const STEPS = [
  { n: 1, title: 'Đăng ký tài khoản OTP', desc: 'Tạo tài khoản doanh nghiệp miễn phí, xác thực bằng mã OTP gửi về email.', titleImg: 'title-1', width: 362.5 },
  { n: 2, title: 'Nạp tiền vào số dư', desc: 'Nạp qua cổng thanh toán Bảo Việt. Số dư cập nhật ngay khi giao dịch được xác nhận.', titleImg: 'title-23', width: 322.5 },
  { n: 3, title: 'Chọn dịch vụ - Trừ số dư', desc: 'Phí trừ thẳng vào số dư, hoặc tạm giữ đến khi hồ sơ được duyệt, tùy dịch vụ.', titleImg: 'title-23', width: 322.5 },
  { n: 4, title: 'Nhận kết quả qua Email - HĐ VAT', desc: 'Kết quả gửi về email kèm hóa đơn VAT điện tử. Trạng thái luôn xem được trong tài khoản.', titleImg: 'title-4', width: 370 },
];

const MIN_GLOW = 204; // chiều dài vệt sáng ban đầu theo thiết kế

function Step({ step, side, active, stepRef }) {
  const textStyle = { width: step.width };
  const number = (
    <p className={styles.number} style={{ backgroundImage: `url(${asset(`steps/number-${step.n}.png`)})` }}>
      {step.n}
    </p>
  );
  return (
    <div
      ref={stepRef}
      className={`${styles.step} ${side === 'left' ? styles.stepLeft : styles.stepRight} ${active ? styles.active : ''}`}
    >
      {side === 'right' && number}
      <div className={styles.stepText} style={textStyle}>
        <h3 className={styles.stepTitle} style={{ backgroundImage: `url(${asset(`steps/${step.titleImg}.png`)})` }}>
          {step.title}
        </h3>
        <p className={styles.stepDesc}>{step.desc}</p>
      </div>
      {side === 'left' && number}
    </div>
  );
}

/** Khối giữ chỗ vô hình – trong Figma dùng để tạo nhịp so le giữa hai cột. */
function Spacer() {
  return (
    <div className={styles.spacer} aria-hidden="true">
      <div className={styles.spacerLogo} />
      <div className={styles.spacerCard}>
        <p className={styles.spacerTitle}>Nạp tiền qua cổng Bảo Việt</p>
        <p className={styles.spacerDesc}>We collaborate closely with the client to define their needs and objectives. </p>
      </div>
    </div>
  );
}

// Figma: S8 - Pricing (112:10776) – "Cách hoạt động"
export default function HowItWorks() {
  const lineRef = useRef(null);
  const stepRefs = useRef([]);
  const [glow, setGlow] = useState(MIN_GLOW);
  const [activeSteps, setActiveSteps] = useState([true, false, false, false]);

  // Cuộn xuống: vệt sáng chạy dọc trục; bước nào bị đầu vệt sáng "chạm" thì sáng lên.
  // Cuộn ngược lên: các bước tắt dần lại.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = lineRef.current;
      if (!line) return;
      const rect = line.getBoundingClientRect();
      // Màn hình nhỏ: trục bị ẩn -> hiện tất cả các bước
      if (rect.height === 0) {
        setActiveSteps((prev) => (prev.every(Boolean) ? prev : [true, true, true, true]));
        return;
      }
      const progress = (window.innerHeight * 0.6 - rect.top) / rect.height;
      const clamped = Math.min(Math.max(progress, 0), 1);
      const tip = Math.max(MIN_GLOW, clamped * rect.height);
      setGlow(tip);
      // vị trí giữa mỗi bước so với đỉnh trục
      const next = stepRefs.current.map((el, i) => {
        if (!el) return i === 0;
        const r = el.getBoundingClientRect();
        return i === 0 || tip >= r.top + r.height / 2 - rect.top;
      });
      setActiveSteps((prev) => (prev.every((v, i) => v === next[i]) ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stepProps = (i, side) => ({
    step: STEPS[i],
    side,
    active: activeSteps[i],
    stepRef: (el) => (stepRefs.current[i] = el),
  });

  return (
    <section className={styles.section} aria-labelledby="how-title">
      <h2 id="how-title" className={styles.title}>
        Cách hoạt động
      </h2>
      <div className={styles.wrap}>
        <ol className={styles.steps}>
          <li className={`${styles.col} ${styles.colLeft}`}>
            <Step {...stepProps(0, 'left')} />
            <Spacer />
            <Step {...stepProps(2, 'left')} />
          </li>
          <li className={styles.line} ref={lineRef} aria-hidden="true">
            <div className={styles.glow} style={{ height: glow }}>
              <span className={styles.marker}>
                <img src={asset('steps/marker-1.svg')} alt="" className={styles.m1} />
                <img src={asset('steps/marker-2.svg')} alt="" className={styles.m2} />
                <img src={asset('steps/marker-3.svg')} alt="" className={styles.m3} />
                <img src={asset('steps/marker-4.svg')} alt="" className={styles.m4} />
              </span>
            </div>
          </li>
          <li className={`${styles.col} ${styles.colRight}`}>
            <Spacer />
            <Step {...stepProps(1, 'right')} />
            <Spacer />
            <Step {...stepProps(3, 'right')} />
          </li>
        </ol>
      </div>
    </section>
  );
}
