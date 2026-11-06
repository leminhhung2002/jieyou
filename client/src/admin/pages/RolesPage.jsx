import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { Button, DataTable, LoadingRow, Modal, PageHeader, Toast } from '../ui.jsx';
import HeaderButton from '../components/HeaderButton.jsx';
import form from '../components/form.module.css';
import styles from './RolesPage.module.css';

// Độ rộng cột theo Figma (cột vai trò + 5 nhóm quyền); quyền thêm sau dùng auto
const COL_WIDTHS = [203.563, 164.094, 165.641, 269.063, 135.75, 137.891];

// Figma: Admin: Phân quyền (76:930)
export default function RolesPage() {
  useDocumentTitle('Phân quyền – JIEYOU Admin');
  const [roles, setRoles] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({}); // { 'roleId:perm': true }
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);
  const rolesRef = useRef(null);
  rolesRef.current = roles;

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi
      .roles({ signal: ctrl.signal })
      .then(({ data, meta }) => {
        setRoles(data);
        setPermissions(meta.permissions || []);
      })
      .catch((err) => err.name !== 'AbortError' && setError(err));
    return () => ctrl.abort();
  }, []);

  // Bật/tắt 1 quyền: cập nhật lạc quan, lỗi thì hoàn tác
  const toggle = useCallback(async (role, permKey, permLabel) => {
    const key = `${role.id}:${permKey}`;
    const current = rolesRef.current.find((r) => r.id === role.id);
    const had = current.permissions.includes(permKey);
    const next = had ? current.permissions.filter((p) => p !== permKey) : [...current.permissions, permKey];
    const prev = current.permissions;
    setRoles((list) => list.map((r) => (r.id === role.id ? { ...r, permissions: next } : r)));
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await adminApi.updateRole(role.id, next);
      setToast({ message: `${had ? 'Đã bỏ' : 'Đã cấp'} quyền “${permLabel}” cho ${role.name}`, tone: 'success' });
    } catch (err) {
      setRoles((list) => list.map((r) => (r.id === role.id ? { ...r, permissions: prev } : r)));
      setToast({ message: err.message || 'Không lưu được phân quyền', tone: 'error' });
    } finally {
      setSaving((s) => {
        const { [key]: _, ...rest } = s;
        return rest;
      });
    }
  }, []);

  const columns = [
    { key: 'name', label: 'Vai trò', width: COL_WIDTHS[0] },
    ...permissions.map((p, i) => ({
      key: p.key,
      label: p.label,
      width: COL_WIDTHS[i + 1],
      render: (r) => {
        const granted = r.permissions.includes(p.key);
        const mark = granted ? (
          <img className={styles.check} src={asset('admin/icons/check-circle.svg')} width="22" height="22" alt="" />
        ) : (
          <span className={styles.dash} aria-hidden="true">
            —
          </span>
        );
        // Super Admin bị khóa: chỉ hiển thị, không bấm được
        if (r.locked) {
          return (
            <span className={styles.cell} title="Không thể sửa quyền của Super Admin">
              {mark}
              <span className="sr-only">{granted ? 'Có quyền' : 'Không có quyền'}</span>
            </span>
          );
        }
        return (
          <button
            type="button"
            className={`${styles.cell} ${styles.toggle}`}
            aria-pressed={granted}
            aria-label={`${p.label} – ${r.name}`}
            title={granted ? 'Bấm để bỏ quyền' : 'Bấm để cấp quyền'}
            disabled={Boolean(saving[`${r.id}:${p.key}`])}
            onClick={() => toggle(r, p.key, p.label)}
          >
            {mark}
          </button>
        );
      },
    })),
  ];

  return (
    <>
      <PageHeader
        title="Phân quyền"
        subtitle="Vai trò và quyền theo từng nhóm chức năng."
        actions={<HeaderButton onClick={() => setAdding(true)}>Thêm vai trò</HeaderButton>}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!roles ? (
        !error && <LoadingRow />
      ) : (
        <>
          <DataTable caption="Ma trận phân quyền theo vai trò" columns={columns} rows={roles} rowKey={(r) => r.id} empty="Chưa có vai trò" />
          <p className={styles.note}>Ma trận mẫu, cần đối chiếu với PRD Admin trước khi chốt.</p>
        </>
      )}

      {adding && (
        <AddRoleModal
          permissions={permissions}
          onClose={() => setAdding(false)}
          onCreated={(role) => {
            setRoles((list) => [...(list || []), role]);
            setAdding(false);
            setToast({ message: `Đã thêm vai trò “${role.name}”`, tone: 'success' });
          }}
        />
      )}

      <Toast message={toast?.message} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

/** Hộp thoại thêm vai trò: tên + chọn các nhóm quyền. */
function AddRoleModal({ permissions, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [perms, setPerms] = useState([]);
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const flip = (k) => setPerms((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setNameError('Vui lòng nhập tên vai trò');
      return;
    }
    setBusy(true);
    try {
      // Giữ thứ tự quyền theo danh sách gốc
      const ordered = permissions.map((p) => p.key).filter((k) => perms.includes(k));
      onCreated(await adminApi.createRole(name.trim(), ordered));
    } catch (err) {
      if (err.details?.field === 'name' || err.status === 409) setNameError(err.message);
      else setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Thêm vai trò" labelledBy="role-modal-title">
      <form className={form.form} onSubmit={submit} noValidate>
        {formError && (
          <p role="alert" className={form.alert}>
            {formError}
          </p>
        )}
        <label className={form.field}>
          <span className={form.label}>Tên vai trò</span>
          <input
            className={form.input}
            value={name}
            maxLength={60}
            placeholder="VD: Chăm sóc đối tác"
            onChange={(e) => {
              setName(e.target.value);
              setNameError('');
            }}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'role-name-error' : undefined}
          />
          {nameError && (
            <span id="role-name-error" className={form.error}>
              {nameError}
            </span>
          )}
        </label>
        <fieldset className={form.checks}>
          <legend className={form.label}>Quyền</legend>
          {permissions.map((p) => (
            <label key={p.key} className={form.check}>
              <input type="checkbox" checked={perms.includes(p.key)} onChange={() => flip(p.key)} />
              {p.label}
            </label>
          ))}
        </fieldset>
        <div className={form.actions}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Thêm vai trò'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
