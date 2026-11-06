import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { phoneVN } from '../../admin/format.js';
import { Modal } from '../../admin/ui.jsx';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { Card, FormError, FormGrid, OutlineButton, PageHeader, PrimaryButton, TextField, Toggle } from '../ui.jsx';
import styles from './SettingsPage.module.css';

const MIN_PASSWORD = 8;
const EMAIL_ROWS = [
  { key: 'topup', title: 'Nạp tiền', sub: 'Khi nạp tiền thành công' },
  { key: 'applications', title: 'Trạng thái hồ sơ', sub: 'Khi hồ sơ được duyệt hoặc từ chối' },
  { key: 'invoices', title: 'Hóa đơn', sub: 'Khi hóa đơn được phát hành' },
];

const profileOf = (u) => ({ businessName: u?.businessName || '', taxCode: u?.taxCode || '', email: u?.email || '' });

// Figma: Web người dùng: Cài đặt (74:3914)
export default function SettingsPage() {
  useDocumentTitle('Cài đặt tài khoản – JIEYOU');
  const { summary, refresh, toast } = useAccount();
  const user = summary?.user;

  /* ---------- Thông tin doanh nghiệp ---------- */
  const [profile, setProfile] = useState(() => profileOf(user));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = profileOf(user);

  // Đồng bộ khi summary tải xong / sau khi lưu
  useEffect(() => {
    if (user) setProfile(profileOf(user));
    // Chỉ đặt lại khi giá trị đã lưu thay đổi, không ghi đè lúc đang sửa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.businessName, user?.taxCode, user?.email]);

  const changed = Object.keys(saved).filter((k) => profile[k].trim() !== saved[k]);

  const setField = (key) => (e) => {
    setProfile((p) => ({ ...p, [key]: e.target.value }));
    setProfileErrors((er) => ({ ...er, [key]: undefined }));
    setProfileError('');
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!changed.length || saving) return;
    setSaving(true);
    setProfileError('');
    try {
      // Chỉ gửi các trường đã sửa
      await accountApi.updateProfile(Object.fromEntries(changed.map((k) => [k, profile[k].trim()])));
      await refresh();
      toast('Đã lưu thông tin doanh nghiệp.');
    } catch (err) {
      const field = err.details?.field;
      if (field && field in saved) setProfileErrors({ [field]: err.message });
      else setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Bảo mật & thông báo ---------- */
  const [settings, setSettings] = useState(null);
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword));
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    accountApi
      .settings({ signal: ctrl.signal })
      .then((d) => {
        setSettings(d.settings);
        setHasPassword(d.hasPassword);
      })
      .catch((err) => err.name !== 'AbortError' && toast(err.message, 'error'));
    return () => ctrl.abort();
  }, [toast]);

  // Lưu ngay khi bật/tắt: cập nhật lạc quan, lỗi thì hoàn tác
  const saveSetting = async (patch, apply) => {
    const prev = settings;
    setSettings(apply(prev));
    try {
      const d = await accountApi.updateSettings(patch);
      setSettings(d.settings);
      setHasPassword(d.hasPassword);
    } catch (err) {
      setSettings(prev);
      toast(err.message, 'error');
    }
  };

  const setOtp = (v) => saveSetting({ otpLogin: v }, (s) => ({ ...s, otpLogin: v }));
  const setEmail = (key) => (v) => saveSetting({ email: { [key]: v } }, (s) => ({ ...s, email: { ...s.email, [key]: v } }));

  const onPasswordDone = useCallback(() => {
    setPwOpen(false);
    toast(hasPassword ? 'Đã đổi mật khẩu.' : 'Đã đặt mật khẩu đăng nhập.');
    setHasPassword(true);
    refresh();
  }, [hasPassword, refresh, toast]);
  const closePassword = useCallback(() => setPwOpen(false), []);

  return (
    <>
      <PageHeader
        className={styles.header}
        sticker="account/settings/sticker.png"
        eyebrow="Cài đặt"
        title="Cài đặt tài khoản"
        subtitle="Thông tin doanh nghiệp, bảo mật và thông báo."
      />
      <div className={styles.columns}>
        <Card title="Thông tin doanh nghiệp" className={styles.card} as="form" onSubmit={saveProfile} noValidate>
          <FormGrid className={styles.grid}>
            <TextField
              span
              label="Tên doanh nghiệp"
              name="businessName"
              autoComplete="organization"
              value={profile.businessName}
              onChange={setField('businessName')}
              error={profileErrors.businessName}
              required
            />
            <TextField
              label="Mã số thuế"
              name="taxCode"
              inputMode="numeric"
              value={profile.taxCode}
              onChange={setField('taxCode')}
              error={profileErrors.taxCode}
            />
            <TextField
              label="Số điện thoại"
              name="phone"
              type="tel"
              value={phoneVN(user?.phone)}
              readOnly
              disabled
              hint="Liên hệ hỗ trợ để đổi số điện thoại"
            />
            <TextField
              span
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={profile.email}
              onChange={setField('email')}
              error={profileErrors.email}
              required
            />
          </FormGrid>
          <div className={styles.actions}>
            <PrimaryButton type="submit" size="md" className={styles.save} disabled={!user || !changed.length || saving}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </PrimaryButton>
          </div>
          <FormError>{profileError}</FormError>
        </Card>

        <div className={styles.stack}>
          <Card title="Đăng nhập và bảo mật" className={styles.card}>
            <ul className={styles.rows}>
              <li className={styles.row}>
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>Mật khẩu</p>
                  <p className={styles.rowSub}>{hasPassword ? 'Đổi mật khẩu đăng nhập' : 'Chưa đặt mật khẩu – đang đăng nhập bằng mã OTP'}</p>
                </div>
                <button type="button" className={styles.link} onClick={() => setPwOpen(true)}>
                  {hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
                </button>
              </li>
              <li className={styles.row}>
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>Đăng nhập bằng mã OTP</p>
                  <p className={styles.rowSub}>Gửi mã về số điện thoại đã đăng ký</p>
                </div>
                <Toggle checked={Boolean(settings?.otpLogin)} onChange={setOtp} disabled={!settings} label="Đăng nhập bằng mã OTP" />
              </li>
            </ul>
          </Card>

          <Card title="Thông báo qua email" className={styles.card}>
            <ul className={styles.rows}>
              {EMAIL_ROWS.map((r) => (
                <li key={r.key} className={styles.row}>
                  <div className={styles.rowText}>
                    <p className={styles.rowTitle}>{r.title}</p>
                    <p className={styles.rowSub}>{r.sub}</p>
                  </div>
                  <Toggle
                    checked={Boolean(settings?.email[r.key])}
                    onChange={setEmail(r.key)}
                    disabled={!settings}
                    label={`Email thông báo: ${r.title}`}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <PasswordDialog open={pwOpen} hasPassword={hasPassword} onClose={closePassword} onDone={onPasswordDone} />
    </>
  );
}

const EMPTY_PW = { current: '', next: '', confirm: '' };

/** Hộp thoại đổi / đặt mật khẩu. Chưa có mật khẩu thì không cần mật khẩu hiện tại. */
function PasswordDialog({ open, hasPassword, onClose, onDone }) {
  const [pw, setPw] = useState(EMPTY_PW);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPw(EMPTY_PW);
      setErrors({});
      setError('');
    }
  }, [open]);

  const set = (key) => (e) => {
    setPw((p) => ({ ...p, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    if (hasPassword && !pw.current) er.current = 'Vui lòng nhập mật khẩu hiện tại';
    if (pw.next.length < MIN_PASSWORD) er.next = `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD} ký tự`;
    else if (hasPassword && pw.next === pw.current) er.next = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    if (!er.next && pw.confirm !== pw.next) er.confirm = 'Mật khẩu nhập lại không khớp';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await accountApi.changePassword(hasPassword ? pw.current : undefined, pw.next);
      onDone();
    } catch (err) {
      const field = err.details?.field;
      if (field === 'currentPassword') setErrors({ current: err.message });
      else if (field === 'newPassword') setErrors({ next: err.message });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const title = hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu';
  return (
    <Modal open={open} onClose={onClose} title={title} labelledBy="account-password-title">
      <form className={styles.dialog} onSubmit={onSubmit} noValidate>
        {!hasPassword && <p className={styles.dialogNote}>Đặt mật khẩu để có thể đăng nhập không cần mã OTP.</p>}
        {hasPassword && (
          <TextField
            label="Mật khẩu hiện tại"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={pw.current}
            onChange={set('current')}
            error={errors.current}
          />
        )}
        <TextField
          label="Mật khẩu mới"
          type="password"
          name="newPassword"
          autoComplete="new-password"
          value={pw.next}
          onChange={set('next')}
          error={errors.next}
          hint={`Ít nhất ${MIN_PASSWORD} ký tự`}
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={pw.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <FormError>{error}</FormError>
        <div className={styles.dialogActions}>
          <OutlineButton size="md" onClick={onClose}>
            Hủy
          </OutlineButton>
          <PrimaryButton type="submit" size="md" disabled={busy}>
            {busy ? 'Đang lưu…' : title}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
