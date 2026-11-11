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
  SubmitError,
  TextField,
} from '../ui.jsx';
import styles from './SocialPage.module.css';

const PLATFORM_ICON = {
  facebook: 'account/social/facebook.svg',
  tiktok: 'account/social/tiktok.svg',
  youtube: 'account/social/youtube.svg',
  instagram: 'account/social/instagram.svg',
  threads: 'account/social/threads.svg',
  twitter: 'account/social/twitter.svg',
  shopee: 'account/social/shopee.svg',
  lazada: 'account/social/lazada.svg',
};
const URL_HINT = {
  facebook: 'https://www.facebook.com/100000000001/posts/…',
  tiktok: 'https://www.tiktok.com/@ten-kenh/video/…',
  youtube: 'https://www.youtube.com/watch?v=…',
  instagram: 'https://www.instagram.com/p/…',
  threads: 'https://www.threads.net/@ten-tai-khoan/post/…',
  twitter: 'https://x.com/ten-tai-khoan/status/…',
  shopee: 'https://shopee.vn/ten-shop',
  lazada: 'https://www.lazada.vn/shop/ten-shop',
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
/** Giá 1 lượt như hotrodvfb ("118 đ", "54,08 đ") */
const unitPrice = (svc) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(svc.pricePer1000 / 1000)} đ`;
/** 100000 → 100k, 1500000 → 1,5tr (giống "Tối thiểu/Tối đa: 50/100k" của hotrodvfb) */
const shortNum = (n) => {
  const f = (v) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);
  if (n >= 1_000_000) return `${f(n / 1_000_000)}tr`;
  if (n >= 1_000) return `${f(n / 1_000)}k`;
  return String(n);
};
/** Mô tả NCC → từng dòng */
const descLines = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);

/**
 * Đơn tăng tương tác tự động qua hotrodvfb – bố cục giống form "Mua dịch vụ" của hotrodvfb:
 * nền tảng → loại dịch vụ → link → chọn server → thông tin server → cảm xúc → số lượng → giá tiền → tổng giá.
 */
export default function SmmSocialForm() {
  const { summary } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('social');
  const { data, loading, error: loadError } = useApi((o) => accountApi.socialServices(o), []);
  const [form, setForm] = useState({ platform: 'facebook', group: '', service: '', quantity: '', link: '', reaction: '', comments: '', accepted: false });
  const [uid, setUid] = useState({ busy: false, message: '' });
  const warnId = useId();

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    Object.keys(patch).forEach((k) => clearError(k));
  };

  const all = data?.services ?? [];
  const platforms = (data?.platforms ?? []).filter((p) => all.some((s) => s.platform === p.key));
  const inPlatform = useMemo(() => all.filter((s) => s.platform === form.platform), [all, form.platform]);
  // Danh mục NCC (Facebook Speed / Buff / Mắt-View…) → loại dịch vụ (Like bài viết, Theo dõi…) → server, giữ thứ tự của NCC
  const sections = useMemo(() => {
    const out = [];
    for (const s of inPlatform) {
      let sec = out.find((x) => x.category === s.category);
      if (!sec) out.push((sec = { category: s.category, groups: [] }));
      let g = sec.groups.find((x) => x.name === s.group);
      if (!g) sec.groups.push((g = { name: s.group, key: `${s.category}::${s.group}`, servers: [] }));
      g.servers.push(s);
    }
    return out;
  }, [inPlatform]);
  const groups = sections.flatMap((x) => x.groups);
  const group = groups.find((g) => g.key === form.group) ?? groups[0] ?? null;
  const servers = group?.servers ?? [];
  const svc = servers.find((s) => String(s.id) === form.service) ?? servers[0] ?? null;
  const commentType = svc ? COMMENT_TYPES[svc.type] : null;

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
                    onSelect={() => update({ platform: p.key, group: '', service: '' })}
                    className={`${styles.platform} ${form.platform === p.key ? styles.platformOn : ''}`}
                    icon={<img src={asset(PLATFORM_ICON[p.key])} width="32" height="32" alt="" />}
                    title={p.name}
                  />
                ))}
              </ChoiceGroup>
              {loading && !data && <p className={styles.hint}>Đang tải danh sách dịch vụ…</p>}
              {loadError && <p className={styles.error}>{loadError.message}</p>}
            </Card>

            {groups.length > 0 && (
              <Card title="Loại dịch vụ">
                {sections.map((sec) => (
                  <div key={sec.category} className={styles.groupSection}>
                    {sections.length > 1 && <p className={styles.groupHeading}>{sec.category}</p>}
                    <ChoiceGroup label={sec.category} className={styles.groupList}>
                      {sec.groups.map((g) => {
                        const on = group?.key === g.key;
                        return (
                          <button
                            key={g.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={on || (!sec.groups.some((x) => x.key === group?.key) && g === sec.groups[0]) ? 0 : -1}
                            className={`${styles.groupItem} ${on ? styles.groupItemOn : ''}`}
                            onClick={() => update({ group: g.key, service: '' })}
                          >
                            <span className={styles.dot} aria-hidden="true" />
                            <span className={styles.groupName}>{g.name}</span>
                            <span className={styles.groupCount}>{g.servers.length}</span>
                          </button>
                        );
                      })}
                    </ChoiceGroup>
                  </div>
                ))}
              </Card>
            )}

            {svc && (
              <Card title={`Mua dịch vụ · ${group.name}`}>
                <div className={styles.buy}>
                  <div>
                    <TextField
                      label="ID hoặc link đối tượng"
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

                  <div className={styles.block}>
                    <p className={styles.label} id={`${warnId}-sv`}>
                      Chọn server
                    </p>
                    <div role="radiogroup" aria-labelledby={`${warnId}-sv`} className={styles.servers}>
                      {servers.map((s, i) => {
                        const on = svc.id === s.id;
                        const [code, ...rest] = s.server.split(' ');
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={on ? 0 : -1}
                            className={`${styles.server} ${on ? styles.serverOn : ''}`}
                            onClick={() => update({ service: String(s.id) })}
                            onKeyDown={(e) => {
                              if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                              e.preventDefault();
                              const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
                              const j = (i + step + servers.length) % servers.length;
                              update({ service: String(servers[j].id) });
                              e.currentTarget.parentElement.children[j]?.focus();
                            }}
                          >
                            <span className={styles.radio} aria-hidden="true" />
                            <span className={styles.serverName}>
                              <strong>{code}</strong>
                              {rest.length > 0 && `: ${rest.join(' ')}`}
                            </span>
                            <span className={styles.serverPrice}>{unitPrice(s)}</span>
                            <span className={styles.badge}>Hoạt động</span>
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.service && <p className={styles.error}>{fieldErrors.service}</p>}
                  </div>

                  <div className={styles.info}>
                    <p className={styles.infoId}>ID: {svc.id}</p>
                    <ul className={styles.infoList}>
                      {descLines(svc.description).map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                      {svc.refill && <li>Bảo hành {svc.refillDays} ngày</li>}
                      {svc.cancel && <li>Có thể huỷ đơn</li>}
                    </ul>
                    <p className={styles.infoMinMax}>
                      Tối thiểu/Tối đa: {shortNum(svc.min)}/{shortNum(svc.max)}
                    </p>
                  </div>

                  {svc.reactions.length > 0 && (
                    <div className={styles.block}>
                      <p className={styles.label}>Chọn loại cảm xúc</p>
                      <ChoiceGroup label="Loại cảm xúc" className={styles.reactions}>
                        {svc.reactions.map((r) => (
                          <ChoiceCard
                            key={r}
                            selected={form.reaction === r}
                            onSelect={() => update({ reaction: r })}
                            className={`${styles.reaction} ${form.reaction === r ? styles.reactionOn : ''}`}
                            title={REACTION_LABEL[r] || r}
                          />
                        ))}
                      </ChoiceGroup>
                      {fieldErrors.reaction && <p className={styles.error}>{fieldErrors.reaction}</p>}
                    </div>
                  )}

                  {commentType && (
                    <Field
                      label={
                        commentType.fromLines
                          ? `Nội dung bình luận (mỗi dòng một nội dung · ${formatVnd(qty)} dòng)`
                          : 'Ghi chú / nội dung (không bắt buộc, mỗi dòng một nội dung)'
                      }
                      error={fieldErrors.comments}
                      hint={[
                        commentType.fromLines && `Số lượng tính theo số dòng: từ ${formatVnd(svc.min)} đến ${formatVnd(svc.max)}`,
                        commentType.minLine && `Mỗi dòng tối thiểu ${commentType.minLine} ký tự`,
                      ]
                        .filter(Boolean)
                        .join('. ')}
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

                  <FormGrid className={styles.grid}>
                    {commentType?.fromLines ? (
                      <TextField label="Số lượng" name="quantity" value={formatVnd(qty)} readOnly hint="Tính theo số dòng nội dung" />
                    ) : (
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
                    <TextField label="Giá tiền (1 lượt)" name="unitPrice" value={unitPrice(svc)} readOnly />
                    <TextField label="Tổng giá" name="total" value={vnd(total)} readOnly span inputClassName={styles.totalInput} />
                  </FormGrid>
                </div>
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
                { label: 'Giá 1 lượt', value: svc ? unitPrice(svc) : '0 đ' },
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
            {svc && descLines(svc.description).length > 0 && (
              <Card title="Lưu ý" className={styles.notes}>
                <ul className={styles.notesList}>
                  {descLines(svc.description).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        }
      />
    </form>
  );
}
