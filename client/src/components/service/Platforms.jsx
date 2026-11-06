import styles from './Platforms.module.css';

/**
 * Cấu hình hiển thị từng icon nền tảng theo Figma (112:12333): màu viền phát sáng bên trong,
 * bo góc, vùng tràn của lớp glow và các vệt sáng. Dữ liệu (tên, bảng giá) đến từ API.
 */
const LOOK = {
  facebook: { radius: 32, inner: 'rgba(40, 126, 255, 0.32)', glowInset: '-31.25%', spot: 'spot' },
  tiktok: { radius: 32, inner: '#08828d', glowInset: '-28.13% -25% -28.12% -25%', spot: 'spot' },
  youtube: { radius: 32, inner: 'rgba(252, 13, 27, 0.32)', glowInset: '-18.75% -31.25%', spot: 'spot' },
  instagram: { radius: 40, inner: 'rgba(190, 13, 252, 0.32)', glowInset: '-31.25%' },
  zalo: { radius: 40, inner: 'rgba(13, 180, 252, 0.32)', glowInset: '-9.38% -9.38% -9.37% -15.62%', spot: 'spot-2', raster: 'zalo' },
  'shopee-live': { radius: 40, inner: 'rgba(252, 56, 13, 0.32)', spot: 'spot-2', raster: 'shopee', ellipse: 'shopee' },
};

/** Figma: "Nền tảng" (112:12329) – chọn nền tảng để đổi bảng giá bên dưới. */
export default function Platforms({ platforms, activeId, onSelect, imageBase, title = 'Nền tảng' }) {
  if (!platforms?.length) return null;
  const base = `${imageBase}/platforms`;
  return (
    <section className={styles.section} aria-labelledby="platforms-title">
      <h2 id="platforms-title" className={styles.title}>
        {title}
      </h2>
      <div className={styles.list} role="group" aria-label="Chọn nền tảng để xem bảng giá">
        {platforms.map((p) => {
          const look = LOOK[p.id] || LOOK.facebook;
          const file = look.raster ? null : p.id;
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              className={`${styles.item} ${active ? styles.active : ''}`}
              aria-pressed={active}
              aria-label={p.name}
              title={p.name}
              onClick={() => onSelect(p.id)}
            >
              <span
                className={`${styles.card} ${p.id === 'shopee-live' ? styles.cardCenter : ''}`}
                style={{ borderRadius: look.radius, '--inner': look.inner }}
              >
                {look.glowInset && (
                  <span className={styles.glowBox}>
                    <span style={{ inset: look.glowInset }}>
                      <img src={`${base}/${look.raster === 'zalo' ? 'zalo' : p.id}-glow.svg`} alt="" />
                    </span>
                  </span>
                )}
                {file && <img className={styles.icon} src={`${base}/${file}.svg`} alt="" />}
                {look.raster === 'zalo' && (
                  <span className={styles.zalo}>
                    <img src={`${base}/zalo.png`} alt="" />
                  </span>
                )}
                {look.raster === 'shopee' && <img className={styles.shopee} src={`${base}/shopee.png`} alt="" />}
                <span className={styles.ellipse}>
                  <img src={`${base}/${look.ellipse || (look.raster === 'zalo' ? 'zalo' : p.id)}-ellipse.svg`} alt="" />
                </span>
                <span className={styles.inner} style={{ borderRadius: 'inherit' }} />
              </span>
              {look.spot && (
                <span className={styles.spot}>
                  <img src={`${base}/${look.spot}.svg`} alt="" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
