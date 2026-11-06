import { useEffect, useId, useRef, useState } from 'react';
import { asset } from '../utils/format.js';
import styles from './ui.module.css';

/** Tiêu đề trang: "Admin" / Tiêu đề 34px / mô tả – Figma "group · Admin" (76:47). */
export function PageHeader({ eyebrow = 'Admin', title, subtitle, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

/** Thẻ số liệu nền #f7f8fa – Figma "group · Hồ sơ chờ duyệt" (76:56). */
export function StatCard({ icon, label, value, hint }) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>
        {icon && <img src={asset(icon)} width="18" height="18" alt="" />}
        {label}
      </p>
      <p className={styles.statValue}>{value}</p>
      {hint && <p className={styles.statHint}>{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className={styles.statGrid}>{children}</div>;
}

/**
 * Nhãn trạng thái dạng viên thuốc có chấm – Figma "row · Chờ duyệt" (76:118).
 * tone: warning | danger | success | neutral | info
 */
export function StatusPill({ tone = 'neutral', children }) {
  return (
    <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Bảng dữ liệu theo style Admin. columns: [{ key, label, align, width, className, render(row) }]
 * `className` (cột) gắn cho cả th/td; `className` (bảng) gắn cho khung bọc để trang tùy chỉnh chiều cao hàng.
 */
export function DataTable({ columns, rows, rowKey, onRowClick, selectedKey, empty = 'Không có dữ liệu', caption, className = '' }) {
  return (
    <div className={`${styles.tableWrap} ${className}`}>
      <table className={styles.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.className} style={{ width: c.width, textAlign: c.align || 'left' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const key = rowKey(r);
            return (
              <tr
                key={key}
                className={`${onRowClick ? styles.clickable : ''} ${selectedKey === key ? styles.selected : ''}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(r)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? selectedKey === key : undefined}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={`${i === 0 ? styles.primaryCell : ''} ${c.className || ''}`}
                    style={{ textAlign: c.align || 'left' }}
                  >
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Nút: variant primary (gradient teal) | outline | danger | ghost; size md (44px) | lg (48px – Figma 76:337) */
export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[`btn_${variant}`]} ${size === 'lg' ? styles.btn_lg : ''} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

/** Hộp thoại có lớp phủ – đóng bằng Esc / click nền; giữ focus trong hộp thoại. */
export function Modal({ open, onClose, title, children, labelledBy = 'modal-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    el?.querySelector('textarea, input, button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll('button, textarea, input, select, a[href]');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {title && (
          <h2 id={labelledBy} className={styles.modalTitle}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

/** Thông báo nhỏ góc dưới (sau khi thao tác thành công/lỗi). */
export function Toast({ message, tone = 'success', onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className={`${styles.toast} ${tone === 'error' ? styles.toastError : ''}`} role="status">
      {message}
    </div>
  );
}

export function LoadingRow({ text = 'Đang tải…' }) {
  return <p className={styles.loading}>{text}</p>;
}

/** Ô tìm kiếm nền #f7f8fa có icon kính lúp – Figma "row · Tìm theo tên, MST…" (76:503). */
export function SearchInput({ value, onChange, placeholder, label, className = '', ...props }) {
  return (
    <label className={`${styles.search} ${className}`}>
      <img src={asset('admin/ui/search.svg')} width="20" height="20" alt="" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        {...props}
      />
    </label>
  );
}

/**
 * Nút lọc dạng viên thuốc mở danh sách lựa chọn – Figma "row · Tất cả trạng thái" (76:507).
 * options: [{ value, label }]; nhãn nút là label của lựa chọn hiện tại.
 */
export function FilterSelect({ value, onChange, options, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) || options[0];
  const focusButton = () => ref.current?.querySelector('button')?.focus();
  const choose = (v) => {
    onChange(v);
    setOpen(false);
    focusButton();
  };

  useEffect(() => {
    if (!open) return undefined;
    // Đóng khi click ra ngoài hoặc bấm Esc
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        focusButton();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Đưa focus vào lựa chọn hiện tại để thao tác bằng bàn phím
    ref.current?.querySelector('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListKey = (e) => {
    if (e.key === 'Tab') return setOpen(false);
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return undefined;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('[role="option"]')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    return undefined;
  };

  return (
    <div className={styles.filter} ref={ref}>
      <button
        type="button"
        className={`${styles.filterBtn} ${open ? styles.filterOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? `${label}: ${current?.label}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.label}
      </button>
      {open && (
        <ul id={listId} role="listbox" className={styles.filterMenu} onKeyDown={onListKey} aria-label={label}>
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              tabIndex={-1}
              aria-selected={o.value === current?.value}
              className={o.value === current?.value ? styles.filterActive : ''}
              onClick={() => choose(o.value)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(o.value))}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nhóm chip lọc (chip đang chọn nền đen) – Figma "row · Tất cả" (76:228). options: [{ value, label }] */
export function FilterChips({ value, onChange, options, label }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.chip} ${o.value === value ? styles.chipActive : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
