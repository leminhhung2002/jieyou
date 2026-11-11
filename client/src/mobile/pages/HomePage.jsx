import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountApi } from '../../account/accountApi.js';
import { ACCOUNT_SERVICES } from '../../account/constants.js';
import ServiceIcon from '../../components/ServiceIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { AppTypeIcon, ErrorText, Muted, vnd } from '../ui.jsx';
import styles from './HomePage.module.css';

/** Icon 44px của 6 dịch vụ (bộ "JIEYOU-Dich-vu-*-line2.5", trùng ServiceIcon của website, scale 44/64). */
const SERVICE_ICON = { ads: 'megaphone', unipay: 'wallet', bct: 'dossier', misa: 'terminal', pos: 'card', social: 'social', webapp: 'code', license: 'key' };
/** Nhãn ô dịch vụ – ngắt dòng như Figma (121:17321 … 121:17517). */
const SERVICE_LABEL = {
  ads: 'Quảng cáo\ntrên sàn',
  unipay: 'Tài khoản\nUniPay',
  bct: 'Hồ sơ\nBộ Công Thương',
  misa: 'Máy bán hàng +\nHóa đơn 1INVOICE',
  pos: 'Hồ sơ cổng\nthanh toán POS',
  webapp: 'Làm app/web\ntheo yêu cầu',
  license: 'Key phần mềm\nbản quyền',
  social: 'Tăng tương\ntác MXH',
};

const HIDE_KEY = 'jieyou.app.hideBalance';

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
  if (h < 11) return 'Chào buổi sáng,';
  if (h < 13) return 'Chào buổi trưa,';
  if (h < 18) return 'Chào buổi chiều,';
  return 'Chào buổi tối,';
};
/** "Công ty TNHH An Phát" → "An Phát" */
const shortName = (name = '') =>
  name.replace(/^(công ty|cty)\s+((tnhh|cổ phần|cp)\s+)?((mtv|một thành viên)\s+)?/i, '').trim() || name;
const initials = (name) =>
  shortName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

// Figma: "VibeDesign · App: Trang chủ" (121:17256)
export default function HomePage() {
  useDocumentTitle('JIEYOU');
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === '1');

  useEffect(() => {
    const ctrl = new AbortController();
    accountApi
      .summary({ signal: ctrl.signal })
      .then(setData)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  const toggleHidden = () => {
    setHidden((h) => {
      localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      return !h;
    });
  };

  const name = data?.user?.businessName || user?.businessName || '';
  const unread = data?.unreadNotifications || 0;
  const recent = (data?.recentApplications || []).slice(0, 3);

  return (
    <div className={styles.page}>
      <HeroScene />

      <div className={styles.top}>
        <header className={styles.header}>
          <div className={styles.who}>
            <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>
            <div className={styles.hello}>
              <p className={styles.helloSmall}>{greeting()}</p>
              <p className={styles.helloName}>{shortName(name)}</p>
            </div>
          </div>
          <Link
            to="/app/thong-bao"
            className={styles.bell}
            aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
          >
            <img src={asset('mobile/ui/bell.svg')} width="20" height="20" alt="" />
            {unread > 0 && <span className={styles.bellDot} />}
          </Link>
        </header>

        <Wallet balance={data?.stats?.balance} hidden={hidden} onToggle={toggleHidden} />
      </div>

      <main className={styles.sheet}>
        <nav className={styles.services} aria-label="Dịch vụ">
          {ACCOUNT_SERVICES.map((s) => (
            <Link key={s.key} to={s.to} className={styles.service}>
              <ServiceIcon name={SERVICE_ICON[s.type]} size={44} />
              <span className={styles.serviceLabel}>{SERVICE_LABEL[s.type] || s.cardLabel}</span>
            </Link>
          ))}
        </nav>

        <section className={styles.recent} aria-labelledby="home-apps">
          <div className={styles.recentHead}>
            <h2 id="home-apps" className={styles.recentTitle}>
              Hồ sơ của tôi
            </h2>
            <Link to="/app/ho-so" className={styles.seeAll}>
              Xem tất cả
            </Link>
          </div>
          <div className={styles.recentCard}>
            {error && <ErrorText>{error}</ErrorText>}
            {data && recent.length === 0 && <Muted>Chưa có hồ sơ nào</Muted>}
            {recent.map((a) => (
              <Link key={a.code} to={`/app/ho-so/${encodeURIComponent(a.code)}`} className={styles.appRow}>
                <AppTypeIcon type={a.type} status={a.status} badge={false} />
                <span className={styles.appText}>
                  <span className={styles.appTitle}>{a.service}</span>
                  <span className={styles.appCode}>{a.code}</span>
                  <span className={`${styles.appStatus} ${styles[`st_${a.status}`] || ''}`}>
                    {{ approved: 'Hoàn thành', rejected: 'Từ chối', pending: 'Chờ duyệt' }[a.status]}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------- Ví "wallet-jieyou 4" (121:17992) 358×261.788 ---------------- */

const W = 358;
const H = 261.788;

function Wallet({ balance, hidden, onToggle }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  // Màn hình hẹp hơn 390px: thu nhỏ đồng đều để giữ đúng hình học của minh hoạ
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = (p) => `url(${asset(`mobile/home/wallet/${p}.svg`)})`;
  const src = (p) => asset(`mobile/home/wallet/${p}.svg`);

  return (
    <div ref={ref} className={styles.walletSlot} style={{ height: H * scale }}>
      <div
        className={styles.wallet}
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined, '--card-mask': m('mask'), '--pocket-mask': m('pocket-mask') }}
      >
        {/* Thẻ phía sau (Clip path group 121:17994) */}
        <div className={`${styles.wl} ${styles.cardBg}`}>
          <img src={src('card-bg')} alt="" />
        </div>
        <div className={`${styles.wl} ${styles.stripe1}`}>
          <img src={src('card-stripe-1')} alt="" />
        </div>
        <div className={`${styles.wl} ${styles.stripe2}`}>
          <img src={src('card-stripe-2')} alt="" />
        </div>
        <div className={styles.cardRow}>
          <img src={src('logo')} width="75.4251" height="18.7137" alt="JIEYOU" />
          <span className={styles.cardKind}>TÀI KHOẢN TRẢ TRƯỚC</span>
        </div>
        <div className={`${styles.wl} ${styles.cardOutline}`}>
          <div className={styles.cardOutlinePad}>
            <img src={src('card-outline')} alt="" />
          </div>
        </div>
        {/* Túi ví */}
        <div className={`${styles.wl} ${styles.pocket}`}>
          <img src={src('pocket')} alt="" />
        </div>
        <div className={`${styles.wl} ${styles.pocket} ${styles.pocketShade}`}>
          <img src={src('pocket-shade')} alt="" />
        </div>
        <div className={`${styles.wl} ${styles.pocket}`}>
          <img src={src('pocket-edge')} alt="" />
        </div>
        <div className={`${styles.wl} ${styles.stitch1}`}>
          <div className={styles.stitchPad}>
            <img src={src('stitch-1')} alt="" />
          </div>
        </div>
        <div className={`${styles.wl} ${styles.stitch2}`}>
          <div className={styles.stitchPad}>
            <img src={src('stitch-2')} alt="" />
          </div>
        </div>

        <div className={styles.balanceBox}>
          <div className={styles.balanceInfo}>
            <div className={styles.balanceLabelRow}>
              <span className={styles.balanceLabel}>Số dư khả dụng</span>
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={onToggle}
                aria-pressed={hidden}
                aria-label={hidden ? 'Hiện số dư' : 'Ẩn số dư'}
              >
                <img src={asset('mobile/ui/eye-slash.svg')} width="16" height="16" alt="" />
              </button>
            </div>
            <p className={styles.balance} aria-live="polite">
              {balance === undefined ? '—' : hidden ? '••••••• đ' : vnd(balance)}
            </p>
          </div>
          <Link to="/app/nap-tien" className={styles.topupBtn}>
            Nạp tiền
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Nền sáng phía trên (121:19079) ---------------- */

/** [file, inset, pad, mask-position, className] – Scene 630.876×418.077 (121:19053, lật dọc). */
const GLOWS = [
  ['ellipse-2411', '99.64% 2.98% -1.98% 3.1%', '-153.85% -2.54%', '-19.55px 8.271px'],
  ['ellipse-2413', '94.6% 15.14% -14.57% 15.26%', '-72.07% -13.7%', '-96.248px 60.907px'],
  ['star-7', '24.28% 11.32% -2.7% 11.44%', '-16.06% -10.8%', '-72.186px 11.279px'],
  ['star-8', '21.76% 15.49% -0.18% 13.71%', '-27.52% -20.2%', '-86.473px 0.752px'],
  ['ellipse-2412', '97.84% 20.14% -2.7% 20.26%', '-74.07% -4%', '-127.829px 11.279px'],
  ['polygon-1', '91.01% 33.85% -0.18% 34.09%', '-196.08% -37.17%', '-215.054px 0.752px'],
];
/** [panel mask, inset, glow mask x, panel mask x, panel mask size] */
const PANELS = [
  ['panel-outer', '23.56% 11.86% 0 11.74%', '-74.054px', '-1.868px', '486.654px 319.574px'],
  ['panel-inner-1', '23.56% 26.5% 0 26.29%', '-165.829px', '-1.155px', '300.775px 319.574px'],
  ['panel-inner-2', '23.56% 35.42% 0 35.39%', '-223.287px', '-0.713px', '185.893px 319.574px'],
];

function HeroScene() {
  const scene = (p) => asset(`mobile/home/scene/${p}.svg`);
  const glowMask = `url(${scene('glow-area')})`;
  return (
    <div className={styles.hero} aria-hidden="true">
      <div className={styles.heroImgBox}>
        <img className={styles.heroImg} src={asset('mobile/home/hero.png')} alt="" />
      </div>
      <div className={styles.scene} style={{ '--glow-mask': glowMask }}>
        <div className={`${styles.glowFill} ${styles.glowArea}`} />
        <div className={`${styles.glowFill} ${styles.glowCore}`} />
        {GLOWS.map(([file, inset, pad, pos]) => (
          <div key={file} className={styles.glowShape} style={{ inset, WebkitMaskPosition: pos, maskPosition: pos }}>
            <div className={styles.glowPad} style={{ inset: pad }}>
              <img src={scene(file)} alt="" />
            </div>
          </div>
        ))}
        {PANELS.map(([file, inset, gx, px, size]) => {
          const maskImage = `${glowMask}, url(${scene(file)})`;
          const maskPosition = `${gx} 0px, ${px} 0px`;
          const maskSize = `630.876px 418.077px, ${size}`;
          return (
            <div key={file} className={styles.panel} style={{ inset }}>
              <div
                className={styles.panelSurface}
                style={{
                  WebkitMaskImage: maskImage,
                  maskImage,
                  WebkitMaskPosition: maskPosition,
                  maskPosition,
                  WebkitMaskSize: maskSize,
                  maskSize,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
