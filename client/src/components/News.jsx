import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { fallbackNews } from '../data/fallback.js';
import { asset, formatDate } from '../utils/format.js';
import styles from './News.module.css';

// Figma: S5 (112:11084) – "Tin tức"
export default function News() {
  const { data: posts } = useApi((o) => api.news(3, o), [], fallbackNews);

  return (
    <section id="tin-tuc" className={styles.section} aria-labelledby="news-title">
      <h2 id="news-title" className={styles.title}>
        Tin tức
      </h2>
      <ul className={styles.grid}>
        {posts.map((p) => (
          <li key={p.id}>
            <article className={styles.card}>
              <div className={styles.img}>
                {p.image ? (
                  <img className={styles.cover} src={p.image} alt="" />
                ) : (
                  <>
                    <img className={styles.base} src={asset('news/img-base.png')} alt="" />
                    <img className={styles.cover} src={asset('news/img.png')} alt="" />
                  </>
                )}
              </div>
              <div className={styles.body}>
                <p className={styles.date}>
                  <img src={asset('news/time.svg')} width="24" height="24" alt="" />
                  <time dateTime={p.publishedAt}>{formatDate(p.publishedAt)}</time>
                </p>
                <div className={styles.titleRow}>
                  <h3 className={styles.postTitle}>{p.title}</h3>
                  {p.tag && <span className={styles.tag}>{p.tag}</span>}
                </div>
                <p className={styles.excerpt}>{p.excerpt}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
