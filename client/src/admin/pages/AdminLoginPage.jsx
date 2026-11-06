import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../adminApi.js';
import { useAdminAuth } from '../AdminAuth.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { Button } from '../ui.jsx';
import styles from './AdminLoginPage.module.css';

// Màn đăng nhập quản trị – không có trong Figma, dựng theo ngôn ngữ thiết kế của Admin
export default function AdminLoginPage() {
  useDocumentTitle('Đăng nhập quản trị – JIEYOU');
  const { admin, signIn } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (admin) return <Navigate to={location.state?.from || '/admin'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Vui lòng nhập tên đăng nhập và mật khẩu');
    setError('');
    setLoading(true);
    try {
      signIn(await adminApi.login(username.trim(), password));
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return undefined;
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <div className={styles.brand}>
          <img src={asset('admin/logo.svg')} width="34" height="30" alt="" />
          <span className={styles.brandName}>JIEYOU</span>
          <span className={styles.badge}>ADMIN</span>
        </div>
        <div>
          <h1 className={styles.title}>Đăng nhập quản trị</h1>
          <p className={styles.sub}>Chỉ dành cho nhân sự vận hành JIEYOU.</p>
        </div>
        <label className={styles.field}>
          <span>Tên đăng nhập</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="admin" />
        </label>
        <label className={styles.field}>
          <span>Mật khẩu</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className={styles.submit}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
    </div>
  );
}
