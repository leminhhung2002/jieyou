import { useId } from 'react';
import { Link } from 'react-router-dom';
import { asset } from '../utils/format.js';
import styles from './ui.module.css';

/**
 * Bộ thành phần dùng chung của Web người dùng (Figma trang "Web người dùng" 26:3).
 * Trang cần chỉnh pixel riêng thì truyền `className` và ghi đè trong CSS module của trang,
 * không sửa trực tiếp file này.
 */

/** Tiêu đề trang: sticker 88px + eyebrow 14px / tiêu đề 34px / mô tả 16px – Figma "row · Tài khoản UniPay" (74:2825). */
export function PageHeader({ sticker, eyebrow, title, subtitle, actions, className = '' }) {
  return (
    <header className={`${styles.header} ${className}`}>
      {sticker && <img className={styles.sticker} src={asset(sticker)} width="88" height="88" alt="" />}
      <div className={styles.headerText}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

/** Bố cục 2 cột của các màn đặt dịch vụ: cột form 632px + cột chi phí 420px, cách 24px (74:2836). */
export function FormLayout({ main, aside, className = '' }) {
  return (
    <div className={`${styles.formLayout} ${className}`}>
      <div className={styles.formMain}>{main}</div>
      <div className={styles.formAside}>{aside}</div>
    </div>
  );
}

/** Thẻ trắng bo 24px, viền mờ, tiêu đề 18px – Figma "stack · Thông tin đại diện" (74:2837). */
export function Card({ title, children, className = '', as: Tag = 'section', titleId, ...props }) {
  const autoId = useId();
  const id = title ? titleId || autoId : undefined;
  return (
    <Tag className={`${styles.card} ${className}`} aria-labelledby={id} {...props}>
      {title && (
        <h2 id={id} className={styles.cardTitle}>
          {title}
        </h2>
      )}
      {children}
    </Tag>
  );
}

/** Lưới 2 cột cho các ô nhập: cách ngang 16px, dọc 18px (74:2840). */
export function FormGrid({ children, className = '' }) {
  return <div className={`${styles.grid} ${className}`}>{children}</div>;
}

/**
 * Nhãn + ô nhập + lỗi. `span` = chiếm 2 cột. Truyền `children(id, describedBy)` để tự gắn id cho input,
 * hoặc dùng các ô nhập dưới đây với prop `label`.
 */
export function Field({ label, error, hint, span = false, children, className = '' }) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`${styles.field} ${span ? styles.span2 : ''} ${className}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id, describedBy, Boolean(error))}
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Ô nhập nền #f7f8fa, viền 1.5px, cao 52px, bo 14px (74:2844). `icon`: đường dẫn asset 20px bên trái. */
export function TextField({ label, error, hint, span, icon, className = '', inputClassName = '', ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} span={span} className={className}>
      {(id, describedBy, invalid) => (
        <div className={`${styles.control} ${invalid ? styles.invalid : ''} ${inputProps.disabled ? styles.disabled : ''}`}>
          {icon && <img src={asset(icon)} width="20" height="20" alt="" />}
          <input
            id={id}
            className={`${styles.input} ${inputClassName}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...inputProps}
          />
        </div>
      )}
    </Field>
  );
}

/** Ô chọn (native select) cùng kiểu ô nhập. `options`: [{ value, label }] hoặc chuỗi. */
export function SelectField({ label, error, hint, span, options, chevron = 'account/ui/chevron-down.svg', className = '', ...selectProps }) {
  return (
    <Field label={label} error={error} hint={hint} span={span} className={className}>
      {(id, describedBy, invalid) => (
        <div className={`${styles.control} ${styles.selectControl} ${invalid ? styles.invalid : ''} ${selectProps.disabled ? styles.disabled : ''}`}>
          <select id={id} className={styles.select} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...selectProps}>
            {options.map((o) => {
              const opt = typeof o === 'object' ? o : { value: o, label: o };
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            })}
          </select>
          <img className={styles.chevron} src={asset(chevron)} width="20" height="20" alt="" />
        </div>
      )}
    </Field>
  );
}

const SIGN_ICON = {
  minus: 'account/ui/sign-minus.svg',
  equals: 'account/ui/sign-equals.svg',
  plus: 'account/ui/sign-plus.svg',
  times: 'account/ui/sign-times.svg',
};
const SIGN_LABEL = { minus: 'trừ', equals: 'bằng', plus: 'cộng', times: 'nhân' };

/**
 * Thẻ "Chi phí" – Figma "group · Chi phí" (74:2879).
 * rows: [{ label, value, sign?: 'minus'|'plus'|'times'|'equals', total?: true }]
 * Dòng `total` có đường kẻ phía trên, chữ đậm và số 22px.
 */
export function CostCard({ title = 'Chi phí', rows, note, className = '' }) {
  return (
    <Card title={title} className={`${styles.costCard} ${className}`}>
      <dl className={styles.costRows}>
        {rows.map((r) => (
          <div key={r.label} className={`${styles.costRow} ${r.total ? styles.costTotal : ''} ${r.sign ? styles.costSigned : ''}`}>
            <dt>
              {r.sign && (
                <span className={styles.sign}>
                  <img src={asset(SIGN_ICON[r.sign])} width="12" height="12" alt={SIGN_LABEL[r.sign]} />
                </span>
              )}
              {r.label}
            </dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className={styles.costNote}>{note}</p>}
    </Card>
  );
}

/**
 * Nút chính gradient teal (74:2906) – cao 56px, bo tròn. `to` → Link, ngược lại <button>.
 * size: 'xl' (56px, mặc định) | 'md' (44px). `block`: rộng 100%.
 */
export function PrimaryButton({ to, size = 'xl', block = false, icon, children, className = '', type = 'button', ...props }) {
  const cls = `${styles.btn} ${styles.primary} ${styles[`size_${size}`]} ${block ? styles.block : ''} ${className}`;
  const inner = (
    <>
      {icon}
      <span>{children}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {inner}
      </Link>
    );
  }
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={cls} {...props}>
      {inner}
    </button>
  );
}

/** Nút viền xám #c8cbd1 nền trắng (74:2909 "Lưu nháp"). */
export function OutlineButton({ to, size = 'xl', block = false, icon, children, className = '', type = 'button', ...props }) {
  const cls = `${styles.btn} ${styles.outline} ${styles[`size_${size}`]} ${block ? styles.block : ''} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={cls} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

/**
 * Bảng dữ liệu kiểu Web người dùng – Figma "table" (74:2145): tiêu đề 12px in hoa, hàng 61px, kẻ trên #e3e5e9.
 * columns: [{ key, label, width, align, primary (chữ đậm), className, render(row) }]
 */
export function AccountTable({ columns, rows, rowKey, empty = 'Không có dữ liệu', caption, className = '' }) {
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
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`${c.primary ? styles.primaryCell : ''} ${c.className || ''}`}
                  style={{ textAlign: c.align || 'left' }}
                >
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Công tắc bật/tắt (role="switch"). */
export function Toggle({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${className}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}

/**
 * Thẻ lựa chọn (radio) – nền #e8fbfb viền teal khi chọn. Dùng cho vị trí banner, thiết bị, nền tảng…
 * Đặt trong <ChoiceGroup> để có role="radiogroup" và điều hướng bằng phím.
 */
export function ChoiceCard({ selected, onSelect, icon, title, subtitle, disabled = false, className = '', children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      className={`${styles.choice} ${selected ? styles.choiceOn : ''} ${className}`}
      onClick={onSelect}
    >
      {icon}
      <span className={styles.choiceText}>
        <span className={styles.choiceTitle}>{title}</span>
        {subtitle && <span className={styles.choiceSub}>{subtitle}</span>}
      </span>
      {children}
    </button>
  );
}

export function ChoiceGroup({ label, children, className = '' }) {
  const onKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    next.focus();
    next.click();
  };
  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/** Thông báo lỗi chung của form (dưới nút gửi). */
export function FormError({ children }) {
  if (!children) return null;
  return (
    <p className={styles.formError} role="alert">
      {children}
    </p>
  );
}

/** Lỗi khi gửi hồ sơ; số dư không đủ thì kèm link Nạp tiền. Dùng với useSubmitApplication(). */
export function SubmitError({ error, insufficient }) {
  if (!error) return null;
  return (
    <FormError>
      {error}
      {insufficient && (
        <>
          {' '}
          <Link to="/tai-khoan/nap-tien" className={styles.errorLink}>
            Nạp tiền ngay
          </Link>
        </>
      )}
    </FormError>
  );
}
