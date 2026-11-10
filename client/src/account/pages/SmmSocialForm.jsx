import { useEffect, useId, useMemo, useState } from 'react';
import { vnd } from '../../admin/format.js';
import { useApi } from '../../hooks/useApi.js';
import { asset, formatVnd } from '../../utils/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import {
  Card,
  ChoiceCard,
  ChoiceGroup,
  CostCard,
  Field,
  FormGrid,
  FormLayout,
  OutlineButton,
  PageHeader,
  PrimaryButton,
  SelectField,
  SubmitError,
  TextField,
} from '../ui.jsx';
import styles from './SocialPage.module.css';

const PLATFORM_ICON = {
  facebook: 'account/social/facebook.svg',
  tiktok: 'account/social/tiktok.svg',
  youtube: 'account/social/youtube.svg',
  instagram: 'account/social/instagram.svg',
};
const URL_HINT = {
  facebook: 'https://www.facebook.com/100000000001/posts/…',
  tiktok: 'https://www.tiktok.com/@ten-kenh/video/…',
  youtube: 'https://www.youtube.com/watch?v=…',
  instagram: 'https://www.instagram.com/p/…',
};
const REACTION_LABEL = { like: 'Thích', love: 'Yêu thích', care: 'Thương thương', wow: 'Wow', haha: 'Haha', sad: 'Buồn', angry: 'Phẫn nộ' };
/** Khớp server/src/services/smmCatalog.js – SMM_TYPES */
const COMMENT_TYPES = {
  'Custom Comments': { required: true, fromLines: true },
  'Custom Reviews': { required: true, fromLines: true, minLine: 26 },
  'Custom Checkin': { required: false, minLine: 26 },
};

const lineCount = (text) => text.split(/\r?\n/).filter((l) => l.trim()).length;
const amountOf = (svc, qty) => (svc ? Math.ceil((svc.pricePer1000 * qty) / 1000) : 0);

/** Đơn tăng tương tác tự động qua hotrodvfb: chọn dịch vụ theo nền tảng → danh mục → gói. */
export default function SmmSocialForm() {
  const { summary } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('social');
  const { data, loading, error: loadError } = useApi((o) => accountApi.socialServices(o), []);
  const [form, setForm] = useState({ platform: 'facebook', category: '', service: '', quantity: '', link: '', reaction: '', comments: '', accepted: false });
  const [uid, setUid] = useState({ busy: false, message: '' });
  const warnId = useId();

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    Object.keys(patch).forEach((k) => clearError(k));
  };

  const all = data?.services ?? [];
  const platforms = (data?.platforms ?? []).filter((p) => all.some((s) => s.platform === p.key));
  const inPlatform = useMemo(() => all.filter((s) => s.platform === form.platform), [all, form.platform]);
  const categories = useMemo(() => [...new Set(inPlatform.map((s) => s.category))], [inPlatform]);
  const category = categories.includes(form.category) ? form.category : categories[0] || '';
  const inCategory = inPlatform.filter((s) => s.category === category);
  const svc = inCategory.find((s) => String(s.id) === form.service) ?? inCategory[0] ?? null;
  const commentType = svc ? COMMENT_TYPES[svc.type] : null;

  // Danh sách dạng cây: mặc định chỉ mở danh mục đang chọn; bấm tiêu đề để mở/đóng từng danh mục
  const [openCats, setOpenCats] = useState(null);
  const open = openCats ?? new Set([category]);
  const toggleCategory = (c) =>
    setOpenCats((prev) => {
      const s = new Set(prev ?? [category]);
      if (s.has(c)) s.delete(c);
      else s.add(c);
      return s;
    });

  // Đổi gói → số lượng mặc định = tối thiểu, cảm xúc mặc định = cái đầu tiên
  useEffect(() => {
    if (!svc) return;
    setForm((f) => ({ ...f, quantity: String(svc.min), reaction: svc.reactions[0] || '' }));
  }, [svc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = commentType?.fromLines ? lineCount(form.comments) : Number(form.quantity) || 0;
  const total = amountOf(svc, qty);
  const balance = summary?.stats.balance ?? 0;
  const qtyValid = svc && qty >= svc.min && qty <= svc.max;

  const toUid = async () => {
    setUid({ busy: true, message: '' });
    try {
      const r = await accountApi.socialUid(form.link.trim());
      update({ link: r.link });
      setUid({ busy: false, message: `Đã đổi sang UID ${r.id}${r.name ? ` (${r.name})` : ''}` });
    } catch (e) {
      setUid({ busy: false, message: e.message });
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.accepted || !svc) return;
    submit({
      service: svc.id,
      link: form.link.trim(),
      quantity: qty,
      ...(svc.reactions.length ? { reaction: form.reaction } : {}),
      ...(commentType ? { comments: form.comments } : {}),
      acceptedWarning: true,
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        className={styles.header}
        sticker="account/social/sticker.png"
        eyebrow="Tăng tương tác MXH"
        title="Đặt dịch vụ tăng tương tác"
        subtitle="Chọn nền tảng, dịch vụ và số lượng. Đơn chạy tự động ngay sau khi đặt."
      />
      <FormLayout
        main={
          <>
            <Card title="Nền tảng">
              <ChoiceGroup label="Nền tảng" className={styles.platforms}>
                {platforms.map((p) => (
                  <ChoiceCard
                    key={p.key}
                    selected={form.platform === p.key}
                    onSelect={() => {
                      update({ platform: p.key, category: '', service: '' });
                      setOpenCats(null);
                    }}
                    className={`${styles.platform} ${form.platform === p.key ? styles.platformOn : ''}`}
                    icon={<img src={asset(PLATFORM_ICON[p.key])} width="32" height="32" alt="" />}
                    title={p.name}
                  />
                ))}
              </ChoiceGroup>
              {loading && !data && <p className={styles.hint}>Đang tải danh sách dịch vụ…</p>}
              {loadError && <p className={styles.error}>{loadError.message}</p>}
            </Card>

            {categories.length > 0 && (
              <Card title="Dịch vụ">
                <div className={styles.tree}>
                  {categories.map((c) => {
                    const isOpen = open.has(c);
                    const items = inPlatform.filter((s) => s.category === c);
                    return (
                      <div key={c} className={styles.treeGroup}>
                        <button
                          type="button"
                          className={`${styles.treeHead} ${c === category ? styles.treeHeadOn : ''}`}
                          aria-expanded={isOpen}
                          onClick={() => toggleCategory(c)}
                        >
                          <span className={styles.treeHeadText}>{c}</span>
                          <span className={styles.treeCount}>{items.length}</span>
                          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
                        </button>
                        {isOpen && (
                          <ChoiceGroup label={c} className={styles.treeList}>
                            {items.map((s) => {
                              const on = svc?.id === s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  tabIndex={on || (!items.some((x) => x.id === svc?.id) && s === items[0]) ? 0 : -1}
                                  className={`${styles.treeItem} ${on ? styles.treeItemOn : ''}`}
                                  onClick={() => update({ category: c, service: String(s.id) })}
                                >
                                  <span className={styles.dot} aria-hidden="true" />
                                  <span className={styles.treeItemName}>{s.name}</span>
                                  <span className={styles.treeItemPrice}>{vnd(s.pricePer1000)}/1.000</span>
                                </button>
                              );
                            })}
                          </ChoiceGroup>
                        )}
                      </div>
                    );
                  })}
                </div>
                {fieldErrors.service && <p className={styles.error}>{fieldErrors.service}</p>}
              </Card>
            )}

            {svc && (
              <Card title={svc.name}>
                <FormGrid className={styles.grid}>
                  {(svc.description || svc.refill || svc.cancel) && (
                    <p className={`${styles.hint} ${styles.span}`}>
                      {svc.description}
                      {svc.refill && ` · Bảo hành ${svc.refillDays} ngày`}
                      {svc.cancel && ' · Có thể huỷ'}
                    </p>
                  )}
                  <div className={styles.span}>
                    <TextField
                      label="Đường dẫn trang hoặc bài viết"
                      name="link"
                      type="url"
                      inputMode="url"
                      maxLength={200}
                      placeholder={URL_HINT[form.platform]}
                      value={form.link}
                      onChange={(e) => {
                        update({ link: e.target.value });
                        setUid({ busy: false, message: '' });
                      }}
                      error={fieldErrors.link}
                      required
                    />
                    {form.platform === 'facebook' && (
                      <div className={styles.uidRow}>
                        <OutlineButton size="md" onClick={toUid} disabled={uid.busy || !form.link.trim()}>
                          {uid.busy ? 'Đang lấy UID…' : 'Đổi link profile sang UID'}
                        </OutlineButton>
                        <span className={styles.hint} role="status">
                          {uid.message || 'Dịch vụ cho trang cá nhân Facebook cần link dạng UID số.'}
                        </span>
                      </div>
                    )}
                  </div>
                  {!commentType?.fromLines && (
                    <TextField
                      label="Số lượng"
                      name="quantity"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.quantity ? formatVnd(Number(form.quantity)) : ''}
                      onChange={(e) => update({ quantity: e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9) })}
                      error={fieldErrors.quantity || (form.quantity && !qtyValid ? `Từ ${formatVnd(svc.min)} đến ${formatVnd(svc.max)}` : '')}
                      hint={`Từ ${formatVnd(svc.min)} đến ${formatVnd(svc.max)}`}
                      required
                    />
                  )}
                  {svc.reactions.length > 0 && (
                    <SelectField
                      label="Cảm xúc"
                      name="reaction"
                      options={svc.reactions.map((r) => ({ value: r, label: REACTION_LABEL[r] || r }))}
                      value={form.reaction}
                      onChange={(e) => update({ reaction: e.target.value })}
                      error={fieldErrors.reaction}
                    />
                  )}
                  {commentType && (
                    <Field
                      span
                      label={commentType.fromLines ? `Nội dung (mỗi dòng một nội dung · ${formatVnd(qty)} dòng)` : 'Nội dung (không bắt buộc, mỗi dòng một nội dung)'}
                      error={fieldErrors.comments}
                      hint={[
                        commentType.fromLines && `Số lượng tính theo số dòng: từ ${formatVnd(svc.min)} đến ${formatVnd(svc.max)}`,
                        commentType.minLine && `Mỗi dòng tối thiểu ${commentType.minLine} ký tự`,
                      ].filter(Boolean).join('. ')}
                    >
                      {(id, describedBy, invalid) => (
                        <textarea
                          id={id}
                          name="comments"
                          rows={6}
                          className={`${styles.textarea} ${invalid ? styles.textareaInvalid : ''}`}
                          aria-invalid={invalid || undefined}
                          aria-describedby={describedBy}
                          value={form.comments}
                          onChange={(e) => update({ comments: e.target.value })}
                        />
                      )}
                    </Field>
                  )}
                </FormGrid>
              </Card>
            )}

            <label className={styles.warning} htmlFor={warnId}>
              <input
                id={warnId}
                type="checkbox"
                className={styles.checkInput}
                checked={form.accepted}
                onChange={(e) => {
                  update({ accepted: e.target.checked });
                  clearError('acceptedWarning');
                }}
              />
              <span className={styles.checkBox} aria-hidden="true">
                <img src={asset('account/social/check.svg')} width="14" height="14" alt="" />
              </span>
              <span>Tôi đã đọc cảnh báo: dịch vụ này có thể trái điều khoản của nền tảng mạng xã hội.</span>
            </label>
            {fieldErrors.acceptedWarning && <p className={styles.error}>{fieldErrors.acceptedWarning}</p>}
          </>
        }
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Đơn giá / 1.000', value: vnd(svc?.pricePer1000 ?? 0) },
                { label: 'Số lượng', value: formatVnd(qty), sign: 'times' },
                { label: 'Tổng thanh toán', value: vnd(total), sign: 'equals', total: true },
                { label: 'Số dư sau khi gửi', value: vnd(balance - total) },
              ]}
              note="Đơn bị huỷ hoặc chạy thiếu sẽ được hoàn tiền phần chưa chạy vào số dư."
            />
            <PrimaryButton type="submit" block disabled={submitting || !svc || !qtyValid || !form.link.trim() || !form.accepted}>
              {submitting ? 'Đang gửi…' : `Đặt đơn, trừ ${vnd(total)}`}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
