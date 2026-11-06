import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { asset } from '../utils/format.js';
import styles from './NotFoundPage.module.css';

// Figma: 404 (112:13150)
export default function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang – JIEYOU');
  return (
    <div className={`page ${styles.page}`}>
      <img className={styles.bg} src={asset('notfound/bg.png')} alt="" aria-hidden="true" />
      <Navbar />
      <main className={styles.main}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <div className={styles.text}>
          <h1>Không tìm thấy trang này</h1>
          <p>Trang bạn tìm có thể đã được chuyển hoặc không còn tồn tại.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/" className={styles.primary}>
            Về trang chủ
          </Link>
          <a href="mailto:agency.jieyou@gmail.com" className={styles.ghost}>
            Liên hệ hỗ trợ
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
