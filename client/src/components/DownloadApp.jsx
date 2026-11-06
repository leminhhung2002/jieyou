import { asset } from '../utils/format.js';
import styles from './DownloadApp.module.css';

// Link store – thay bằng link thật khi app được phát hành
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || 'https://apps.apple.com/';
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store';

// Figma: Download app (68:2330)
export default function DownloadApp() {
  return (
    <section className={styles.section} aria-labelledby="download-title">
      <div className={styles.card}>
        <img className={styles.bg} src={asset('app/bg.png')} alt="" aria-hidden="true" />

        <div className={styles.content}>
          <div className={styles.text}>
            <h2 id="download-title" className={styles.title}>
              Tải App ngay!
            </h2>
            <p className={styles.sub}>Nạp tiền, xem số dư, nhận thông báo duyệt hồ sơ ngay trên điện thoại</p>
          </div>
          <div className={styles.stores}>
            <a className={styles.store} href={APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Tải trên App Store">
              <img className={styles.apple} src={asset('app/apple.svg')} alt="" />
              <span className={styles.appleText}>
                <span className={styles.small}>Download on the</span>
                <span className={styles.big}>App Store</span>
              </span>
            </a>
            <a className={styles.store} href={PLAY_STORE_URL} target="_blank" rel="noreferrer" aria-label="Tải trên Google Play">
              <img className={styles.play} src={asset('app/playstore.svg')} alt="" />
              <span className={styles.playText}>
                <span className={styles.getIt}>GET IT ON</span>
                <img className={styles.playWord} src={asset('app/google-play-text.svg')} alt="" />
              </span>
            </a>
          </div>
        </div>

        {/* iPhone 16 Plus Dark mockup */}
        <div className={styles.phone} aria-hidden="true">
          <span className={`${styles.btn} ${styles.btnPower}`} />
          <span className={`${styles.btn} ${styles.btnAction}`} />
          <span className={`${styles.btn} ${styles.btnVolUp}`} />
          <span className={`${styles.btn} ${styles.btnVolDown}`} />
          <div className={styles.frame} />
          <div className={styles.screenFrame} />
          <div className={styles.screen}>
            <img src={asset('app/phone-screen.png')} alt="" />
          </div>
          <img className={styles.island} src={asset('app/dynamic-island.svg')} alt="" />
        </div>
      </div>
    </section>
  );
}
