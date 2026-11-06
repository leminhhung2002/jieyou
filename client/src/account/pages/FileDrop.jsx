import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { asset } from '../../utils/format.js';
import styles from './FileDrop.module.css';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_OR_PDF = 'image/*,application/pdf';

/** "1,2 MB" / "320 KB" */
export const fileSize = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Chỉ gửi siêu dữ liệu tệp lên máy chủ (chưa có tải nhị phân). */
export const fileMeta = (f) => (f ? { name: f.name, size: f.size } : null);

const accepts = (file, accept) =>
  accept.split(',').some((a) => {
    const t = a.trim();
    if (t.endsWith('/*')) return file.type.startsWith(t.slice(0, -1));
    return file.type === t;
  });

/**
 * Ô kéo thả tệp – Figma "group · Kéo thả ảnh vào đây hoặc chọn từ máy" (74:2712) / "Kéo thả hoặc chọn tệp" (74:3395).
 * Viền đứt 2px #c8cbd1, bo 16px; biểu tượng tải lên 28px + dòng chữ 14px ở giữa.
 * Dùng phím được: nút bên trong mở hộp chọn tệp (input ẩn). Kiểm tra loại (ảnh/PDF) và dung lượng ≤ 10 MB.
 *
 * value: tệp đơn ({ name, size, file? }) hoặc mảng khi `multiple`.
 * preview: hiện ảnh xem trước khi tệp là ảnh (dùng cho banner quảng cáo).
 */
export default function FileDrop({
  label,
  text = 'Kéo thả hoặc chọn tệp',
  hint = null,
  accept = IMAGE_OR_PDF,
  multiple = false,
  maxFiles = 10,
  preview = false,
  height = 96,
  value,
  onChange,
  error,
  className = '',
}) {
  const id = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const files = useMemo(() => (multiple ? value || [] : value ? [value] : []), [multiple, value]);

  // Ảnh xem trước (object URL) cho tệp đơn vừa chọn trên máy
  const single = !multiple ? files[0] : null;
  const previewUrl = useMemo(
    () => (preview && single?.file && single.file.type.startsWith('image/') ? URL.createObjectURL(single.file) : null),
    [preview, single],
  );
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const pick = (list) => {
    const picked = [...list];
    if (!picked.length) return;
    const bad = picked.find((f) => !accepts(f, accept));
    if (bad) {
      setLocalError(`Tệp "${bad.name}" không đúng định dạng ${accept === IMAGE_OR_PDF ? '(chỉ nhận ảnh hoặc PDF)' : '(chỉ nhận ảnh)'}.`);
      return;
    }
    const big = picked.find((f) => f.size > MAX_FILE_SIZE);
    if (big) {
      setLocalError(`Tệp "${big.name}" vượt quá 10 MB.`);
      return;
    }
    const mapped = picked.map((f) => ({ name: f.name, size: f.size, file: f }));
    if (multiple) {
      const next = [...files, ...mapped.filter((m) => !files.some((f) => f.name === m.name && f.size === m.size))];
      if (next.length > maxFiles) {
        setLocalError(`Tối đa ${maxFiles} tệp.`);
        return;
      }
      onChange(next);
    } else {
      onChange(mapped[0]);
    }
    setLocalError('');
  };

  const remove = (i) => {
    setLocalError('');
    onChange(multiple ? files.filter((_, j) => j !== i) : null);
  };

  const shownError = localError || error;
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const hasSingle = !multiple && single;

  return (
    <div className={`${styles.field} ${className}`}>
      <span id={`${id}-label`} className={styles.label}>
        {label}
      </span>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ''} ${shownError ? styles.invalid : ''} ${hasSingle ? styles.filled : ''}`}
        style={{ minHeight: height }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(multiple ? e.dataTransfer.files : [...e.dataTransfer.files].slice(0, 1));
        }}
      >
        <button
          type="button"
          className={styles.trigger}
          onClick={() => inputRef.current?.click()}
          aria-labelledby={`${id}-label ${id}-text`}
          aria-describedby={[shownError ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
        >
          {hasSingle ? (
            <span className={styles.selected}>
              {previewUrl ? (
                <img className={styles.thumb} src={previewUrl} alt={`Xem trước ${single.name}`} />
              ) : (
                <img src={asset('account/filedrop/upload.svg')} width="28" height="28" alt="" />
              )}
              <span className={styles.selectedText}>
                <span className={styles.fileName}>{single.name}</span>
                <span id={`${id}-text`} className={styles.fileSub}>
                  {fileSize(single.size)} · Bấm để đổi tệp
                </span>
              </span>
            </span>
          ) : (
            <>
              <img src={asset('account/filedrop/upload.svg')} width="28" height="28" alt="" />
              <span id={`${id}-text`} className={styles.text}>
                {text}
              </span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          className={styles.input}
          accept={accept}
          multiple={multiple}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {multiple && files.length > 0 && (
        <ul className={styles.list} aria-label={`Tệp đã chọn cho ${label}`}>
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}`} className={styles.item}>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSub}>{fileSize(f.size)}</span>
              <button type="button" className={styles.remove} onClick={() => remove(i)} aria-label={`Xóa tệp ${f.name}`}>
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasSingle && (
        <button type="button" className={styles.removeSingle} onClick={() => remove(0)} aria-label={`Xóa tệp ${single.name}`}>
          Xóa tệp
        </button>
      )}

      {hint && !shownError && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {shownError && (
        <p id={errId} className={styles.error} role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
