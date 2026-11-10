import { Link } from 'react-router-dom';
import { asset } from '../utils/format.js';
import styles from './Footer.module.css';

const SERVICE_LINKS = [
  ['Quảng cáo trên sàn', '/dich-vu/quang-cao-tren-san'],
  ['Tài khoản UniPay', '/dich-vu/tai-khoan-unipay'],
  ['Hồ sơ Bộ Công Thương', '/dich-vu/ho-so-bo-cong-thuong'],
  ['Máy bán hàng + MISA', '/dich-vu/may-ban-hang-misa'],
  ['Làm app/web theo yêu cầu', '/dich-vu/lam-app-web-theo-yeu-cau'],
  ['Key phần mềm bản quyền', '/dich-vu/key-ban-quyen'],
];
const POLICY_LINKS = [
  ['Quy chế hoạt động sàn', '/chinh-sach/quy-che-hoat-dong'],
  ['Điều khoản sử dụng', '/chinh-sach/dieu-khoan-su-dung'],
  ['Bảo vệ DLCN', '/chinh-sach/bao-ve-dlcn'],
  ['Thanh toán', '/chinh-sach/thanh-toan'],
  ['Chính sách hoàn tiền', '/chinh-sach/hoan-tien'],
];
const SOCIALS = [
  ['facebook', 'Facebook', 'https://facebook.com/'],
  ['twitter', 'Twitter', 'https://twitter.com/'],
  ['instagram', 'Instagram', 'https://instagram.com/'],
];

// Lớp phát sáng dưới chữ JIEYOU (Scene 112:15303): [file|null, inset, imgPad, extraClass]
// Mask "Overlay" của Figma là một hình chữ nhật phủ kín Scene => tương đương overflow:hidden trên .scene
const GLOWS = [
  [null, '34.35% 22.17% -0.18% 20.86%', null, 'glowArea'],
  [null, '34.35% 32.06% -1.98% 28.37%', null, 'glowCore'],
  ['ellipse2411', '99.64% 2.98% -1.98% 3.1%', '-153.85% -2.54%'],
  ['ellipse2413', '94.6% 15.14% -14.57% 15.26%', '-72.07% -13.7%'],
  ['star7', '24.28% 11.32% -2.7% 11.44%', '-16.06% -10.8%'],
  ['star8', '21.76% 15.49% -0.18% 13.71%', '-27.52% -20.2%'],
  ['ellipse2412', '97.84% 20.14% -2.7% 20.26%', '-74.07% -4%'],
  ['polygon1', '91.01% 33.85% -0.18% 34.09%', '-196.08% -37.17%'],
];
// [file, inset, maskPosition, maskSize] – mask gradient làm panel mờ dần lên trên
const PANELS = [
  ['panel1', '23.56% 11.86% 0 11.74%', '-2.484px 0px', '647.2px 425px'],
  ['panel2', '23.56% 26.5% 0 26.29%', '-1.536px 0px', '400px 425px'],
  ['panel3', '23.56% 35.42% 0 35.39%', '-0.949px 0px', '247.219px 425px'],
];

function Scene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      {GLOWS.map(([file, inset, pad, cls], i) => (
        <div key={i} className={`${styles.glow} ${cls ? styles[cls] : ''}`} style={{ inset }}>
          {file && (
            <div style={{ position: 'absolute', inset: pad }}>
              <img src={asset(`footer/${file}.svg`)} alt="" />
            </div>
          )}
        </div>
      ))}
      {PANELS.map(([file, inset, pos, size]) => {
        const mask = `url(${asset(`footer/${file}.svg`)})`;
        return (
          <div key={file} className={styles.panelWrap} style={{ inset }}>
            <div
              className={styles.panel}
              style={{ maskImage: mask, WebkitMaskImage: mask, maskPosition: pos, WebkitMaskPosition: pos, maskSize: size, WebkitMaskSize: size }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Figma: Footer (112:9572)
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Scene />

      <div className={styles.info}>
        <div className={styles.company}>
          <Link to="/" className={styles.logo} aria-label="JIEYOU – Trang chủ">
            <img src={asset('footer/logo.svg')} width="35.789" height="35.789" alt="" />
            <span>JIEYOU</span>
          </Link>
          <div className={styles.details}>
            <div className={styles.address}>
              <p className={styles.name}>CÔNG TY TNHH TMDV JIEYOU VIỆT NAM</p>
              <address>
                78 Bạch Đằng, Phường Tân Sơn Hoà, <br />
                TP Hồ Chí Minh, Việt Nam
              </address>
            </div>
            <div className={styles.contact}>
              <a href="tel:0843666670">
                <img src={asset('footer/phone.svg')} width="20" height="20" alt="" />
                0843.6666.70
              </a>
              <a href="mailto:agency.jieyou@gmail.com">
                <img src={asset('footer/mail.svg')} width="20" height="20" alt="" />
                agency.jieyou@gmail.com
              </a>
            </div>
          </div>
        </div>

        <nav className={styles.columns} aria-label="Liên kết chân trang">
          <div className={styles.col}>
            <p className={styles.colTitle}>Dịch vụ</p>
            <ul>
              {SERVICE_LINKS.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className={styles.serviceLink}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.col}>
            <p className={styles.colTitle}>Chính sách</p>
            <ul>
              {POLICY_LINKS.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className={styles.policyLink}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <a
          className={styles.bct}
          href="http://online.gov.vn/"
          target="_blank"
          rel="noreferrer"
          aria-label="Đã đăng ký Bộ Công Thương"
        >
          <img src={asset('footer/bct.png')} alt="Đã đăng ký Bộ Công Thương" />
        </a>
      </div>

      <img className={styles.wordmark} src={asset('footer/jieyou-big.svg')} alt="" aria-hidden="true" />

      <div className={styles.bottom}>
        <img className={styles.divider} src={asset('footer/divider.svg')} alt="" aria-hidden="true" />
        <div className={styles.bottomRow}>
          <div className={styles.legal}>
            <span>© JIEYOU Agency 2026</span>
            <Link to="/chinh-sach/dieu-khoan-su-dung">Term &amp; Conditions</Link>
            <Link to="/chinh-sach/bao-ve-dlcn">Privacy Policy</Link>
            <Link to="/chinh-sach/cookies">Cookies Policy</Link>
          </div>
          <ul className={styles.socials}>
            {SOCIALS.map(([file, label, href]) => (
              <li key={file}>
                <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
                  <img src={asset(`footer/${file}.svg`)} alt="" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
