import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { fallbackServices } from '../data/fallback.js';
import { asset } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Navbar.module.css';

const LINKS = [
  { to: '/#bang-gia', label: 'Bảng giá' },
  { to: '/#tin-tuc', label: 'Tin tức' },
  { to: '/#faq', label: 'Hỗ trợ' },
];

/**
 * Thanh điều hướng có 2 trạng thái đúng như thiết kế:
 *  - Ở đầu trang: trong suốt, chữ trắng (frame "Container" 112:10424)
 *  - Khi cuộn: thanh "pill" kính mờ nổi, chữ tối (frame 112:10465)
 * `variant="solid"` dùng cho trang nền sáng (luôn hiển thị dạng pill).
 */
export default function Navbar({ variant = 'transparent' }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Đóng menu khi chuyển trang
  useEffect(() => {
    setMenuOpen(false);
    setServicesOpen(false);
  }, [location.pathname, location.hash]);

  // Đóng dropdown khi click ra ngoài / bấm Esc
  useEffect(() => {
    if (!servicesOpen) return undefined;
    const onDown = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setServicesOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setServicesOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [servicesOpen]);

  const floating = variant === 'solid' || scrolled || menuOpen;
  const services = fallbackServices.filter((s) => s.slug);

  return (
    <header className={`${styles.header} ${floating ? styles.floating : styles.top}`}>
      <nav className={styles.bar} aria-label="Điều hướng chính">
        <div className={styles.start}>
          <Link to="/" className={styles.brand} aria-label="JIEYOU – Trang chủ">
            <img src={asset(floating ? 'nav/logo.svg' : 'nav/logo-white.svg')} width="34" height="30" alt="" />
            <span>JIEYOU</span>
          </Link>

          <ul className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
            <li className={styles.dropdown} ref={dropdownRef}>
              <button
                type="button"
                className={styles.link}
                aria-expanded={servicesOpen}
                aria-haspopup="true"
                onClick={() => setServicesOpen((v) => !v)}
              >
                Dịch vụ
                <img
                  src={asset(floating ? 'nav/chevron-dark.svg' : 'nav/chevron-white.svg')}
                  width="14"
                  height="14"
                  alt=""
                  className={servicesOpen ? styles.chevronUp : ''}
                />
              </button>
              {servicesOpen && (
                <ul className={styles.menu}>
                  {services.map((s) => (
                    <li key={s.slug}>
                      <Link to={`/dich-vu/${s.slug}`} className={styles.menuItem}>
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className={styles.link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <NavLink to="/tai-khoan" className={styles.login} title={user.businessName || user.phone}>
                {user.businessName || user.phone}
              </NavLink>
              <button type="button" className={styles.signup} onClick={signOut}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <NavLink to="/dang-nhap" className={styles.login}>
                Đăng nhập
              </NavLink>
              <NavLink to="/dang-ky" className={styles.signup}>
                Đăng ký
              </NavLink>
            </>
          )}
          <button
            type="button"
            className={styles.burger}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>
    </header>
  );
}
