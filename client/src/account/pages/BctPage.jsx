import { useEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { vnd } from '../../admin/format.js';
import { asset } from '../../utils/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, CostCard, FormGrid, FormLayout, OutlineButton, PageHeader, PrimaryButton, SelectField, SubmitError, TextField } from '../ui.jsx';
import FileDrop, { fileMeta, fileSize } from './FileDrop.jsx';
import styles from './BctPage.module.css';

const STEPS = ['Chuẩn bị', 'Thông tin', 'Tài liệu', 'Xác nhận'];

const CHECKLIST = [
  { icon: 'account/bct/document.svg', title: 'Giấy chứng nhận đăng ký doanh nghiệp', desc: 'Bản quét hoặc ảnh rõ nét, đủ các góc.' },
  { icon: 'account/bct/id-card.svg', title: 'CCCD của người đại diện', desc: 'Mặt trước và mặt sau.' },
  { icon: 'account/bct/globe.svg', title: 'Địa chỉ website hoặc gian hàng', desc: 'Nơi bạn đang bán hàng.' },
];

const EMPTY = { kind: '', businessName: '', taxCode: '', repName: '', website: '', license: null, idCard: null };

// Trường của từng bước – để kiểm tra theo bước và quay về đúng bước khi máy chủ báo lỗi
const STEP_FIELDS = { 1: ['kind', 'businessName', 'taxCode', 'repName', 'website'], 2: ['license', 'idCard'] };

function validate(step, f) {
  const e = {};
  if (step === 1) {
    if (!f.kind) e.kind = 'Vui lòng chọn loại hồ sơ';
    if (!f.businessName.trim()) e.businessName = 'Vui lòng nhập tên doanh nghiệp';
    if (!/^\d{10}(\d{3})?$/.test(f.taxCode.trim())) e.taxCode = 'Mã số thuế gồm 10 hoặc 13 chữ số';
    if (!f.repName.trim()) e.repName = 'Vui lòng nhập họ tên người đại diện';
    if (!f.website.trim()) e.website = 'Vui lòng nhập địa chỉ website hoặc gian hàng';
  }
  if (step === 2) {
    if (!f.license) e.license = 'Vui lòng tải lên Giấy chứng nhận đăng ký doanh nghiệp';
    if (!f.idCard) e.idCard = 'Vui lòng tải lên CCCD của người đại diện';
  }
  return e;
}

/** Thanh bước – Figma "group · Chuẩn bị" (74:2994): vòng 28px, đường nối 2px, nhãn 13px. */
function Stepper({ step, onGo }) {
  return (
    <ol className={styles.stepper} aria-label="Các bước đăng ký">
      {STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'todo';
        const dot = <span className={`${styles.dot} ${styles[`dot_${state}`]}`} aria-hidden="true" />;
        return (
          <li key={label} className={styles.stepItem} aria-current={state === 'current' ? 'step' : undefined}>
            {i > 0 && <span className={`${styles.line} ${i <= step ? styles.lineDone : ''}`} aria-hidden="true" />}
            <div className={styles.step}>
              {state === 'done' ? (
                <button type="button" className={styles.stepBtn} onClick={() => onGo(i)} aria-label={`${label} (đã xong) – quay lại bước này`}>
                  {dot}
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              ) : (
                <>
                  {dot}
                  <span className={styles.stepLabel}>{label}</span>
                </>
              )}
              {state === 'current' && <span className={styles.here}>Bạn đang ở đây</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Figma: Web người dùng: Hồ sơ BCT, bước chuẩn bị (74:2911) – các bước 2–4 dựng cùng ngôn ngữ thiết kế
export default function BctPage() {
  useDocumentTitle('Đăng ký hồ sơ Bộ Công Thương – JIEYOU');
  const { summary, catalog, toast } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('bct');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [savingDraft, setSavingDraft] = useState(false);
  const headingRef = useRef(null);
  const firstRender = useRef(true);

  // Điền sẵn từ hồ sơ doanh nghiệp, sau đó ghi đè bằng bản nháp (kể cả bước đang làm)
  useEffect(() => {
    if (!summary) return undefined;
    const u = summary.user;
    const base = { ...EMPTY, businessName: u.businessName || '', taxCode: u.taxCode || '' };
    const ctrl = new AbortController();
    setForm((f) => (f === EMPTY ? base : f));
    accountApi
      .draft('bct', { signal: ctrl.signal })
      .then((d) => {
        if (!d) return;
        const { step: savedStep, ...details } = d.details || {};
        setForm({ ...base, ...details });
        if (Number.isInteger(savedStep) && savedStep >= 0 && savedStep < STEPS.length) setStep(savedStep);
      })
      .catch(() => {});
    return () => ctrl.abort();
    // Chỉ chạy lần đầu có summary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(summary)]);

  // Mặc định loại hồ sơ đầu tiên khi có danh mục
  useEffect(() => {
    if (catalog?.bctKinds?.length) setForm((f) => (f.kind ? f : { ...f, kind: catalog.bctKinds[0] }));
  }, [catalog]);

  // Máy chủ báo lỗi một trường → quay về bước chứa trường đó
  useEffect(() => {
    const field = Object.keys(fieldErrors).find((k) => fieldErrors[k]);
    if (!field) return;
    const target = Number(Object.keys(STEP_FIELDS).find((s) => STEP_FIELDS[s].includes(field)));
    if (target) setStep(target);
  }, [fieldErrors]);

  // Chuyển bước → đưa tiêu điểm về tiêu đề bước cho trình đọc màn hình
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const fee = catalog?.fees.bct ?? 0;
  const balance = summary?.stats.balance ?? 0;
  const err = (k) => errors[k] || fieldErrors[k];

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    clearError(key);
  };
  const set = (key) => (e) => update(key, e.target.value);

  const next = () => {
    const e = validate(step, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (e) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    // Kiểm tra lại toàn bộ trước khi gửi
    for (const s of [1, 2]) {
      const v = validate(s, form);
      if (Object.keys(v).length) {
        setErrors(v);
        setStep(s);
        return;
      }
    }
    submit({ ...form, license: fileMeta(form.license), idCard: fileMeta(form.idCard) });
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      await accountApi.saveDraft('bct', { ...form, license: fileMeta(form.license), idCard: fileMeta(form.idCard), step });
      toast('Đã lưu nháp hồ sơ Bộ Công Thương.');
    } catch (ex) {
      toast(ex.message, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const field = (key, label, props = {}) => (
    <TextField label={label} value={form[key]} onChange={set(key)} error={err(key)} name={key} {...props} />
  );

  const draftBtn = (
    <OutlineButton className={styles.draftBtn} onClick={saveDraft} disabled={savingDraft}>
      {savingDraft ? 'Đang lưu…' : 'Lưu nháp'}
    </OutlineButton>
  );

  let main;
  if (step === 0) {
    main = (
      <Card title="Bạn cần chuẩn bị" className={styles.card} titleId="bct-step-title">
        <ul className={styles.checklist}>
          {CHECKLIST.map((c) => (
            <li key={c.title} className={styles.checkItem}>
              <span className={styles.checkIcon}>
                <img src={asset(c.icon)} width="22" height="22" alt="" />
              </span>
              <span className={styles.checkText}>
                <span className={styles.checkTitle}>{c.title}</span>
                <span className={styles.checkDesc}>{c.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  } else if (step === 1) {
    main = (
      <Card title="Thông tin hồ sơ" className={styles.card} titleId="bct-step-title">
        <FormGrid>
          <SelectField
            label="Loại hồ sơ"
            span
            name="kind"
            value={form.kind}
            onChange={set('kind')}
            error={err('kind')}
            options={catalog?.bctKinds || []}
          />
          {field('businessName', 'Tên doanh nghiệp', { span: true, autoComplete: 'organization', required: true })}
          {field('taxCode', 'Mã số thuế', { inputMode: 'numeric', required: true, maxLength: 13 })}
          {field('repName', 'Họ tên người đại diện', { autoComplete: 'name', required: true, placeholder: 'Nguyễn Văn An' })}
          {field('website', 'Địa chỉ website hoặc gian hàng', { span: true, type: 'url', inputMode: 'url', required: true, placeholder: 'https://cuahang.vn' })}
        </FormGrid>
      </Card>
    );
  } else if (step === 2) {
    main = (
      <Card title="Tài liệu" className={styles.card} titleId="bct-step-title">
        <div className={styles.docs}>
          <FileDrop
            label="Giấy chứng nhận đăng ký doanh nghiệp"
            text="Kéo thả hoặc chọn tệp – bản quét hoặc ảnh rõ nét"
            hint="Ảnh hoặc PDF, tối đa 10 MB."
            value={form.license}
            onChange={(f) => update('license', f)}
            error={err('license')}
          />
          <FileDrop
            label="CCCD của người đại diện"
            text="Kéo thả hoặc chọn tệp – đủ mặt trước và mặt sau"
            hint="Ảnh hoặc PDF, tối đa 10 MB."
            value={form.idCard}
            onChange={(f) => update('idCard', f)}
            error={err('idCard')}
          />
        </div>
      </Card>
    );
  } else {
    const rows = [
      ['Loại hồ sơ', form.kind, 1],
      ['Tên doanh nghiệp', form.businessName, 1],
      ['Mã số thuế', form.taxCode, 1],
      ['Người đại diện', form.repName, 1],
      ['Website / gian hàng', form.website, 1],
      ['Giấy chứng nhận ĐKDN', form.license ? `${form.license.name} · ${fileSize(form.license.size)}` : '—', 2],
      ['CCCD người đại diện', form.idCard ? `${form.idCard.name} · ${fileSize(form.idCard.size)}` : '—', 2],
    ];
    main = (
      <Card title="Xác nhận thông tin" className={styles.card} titleId="bct-step-title">
        <dl className={styles.review}>
          {rows.map(([label, value, target]) => (
            <div key={label} className={styles.reviewRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <button type="button" className={styles.edit} onClick={() => setStep(target)} aria-label={`Sửa ${label}`}>
                Sửa
              </button>
            </div>
          ))}
        </dl>
      </Card>
    );
  }

  let actions;
  if (step === 0) {
    actions = (
      <div className={styles.actions}>
        <PrimaryButton className={styles.mainBtn} onClick={() => setStep(1)}>
          Bắt đầu
        </PrimaryButton>
        {draftBtn}
      </div>
    );
  } else {
    const last = step === STEPS.length - 1;
    actions = (
      <>
        <div className={styles.actions}>
          <PrimaryButton type="submit" className={styles.mainBtn} disabled={last && (submitting || !catalog)}>
            {last ? (submitting ? 'Đang gửi…' : `Gửi hồ sơ, trừ ${vnd(fee)}`) : 'Tiếp tục'}
          </PrimaryButton>
          {draftBtn}
        </div>
        <OutlineButton block onClick={back}>
          Quay lại
        </OutlineButton>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/bct.png"
        eyebrow="Hồ sơ Bộ Công Thương"
        title="Đăng ký hồ sơ Bộ Công Thương"
        subtitle="Chuẩn bị đủ giấy tờ trước khi bắt đầu để điền một lần là xong."
      />
      <Stepper step={step} onGo={setStep} />
      {/* Tiêu đề ẩn để báo bước hiện tại & nhận tiêu điểm khi chuyển bước */}
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Bước {step + 1}/{STEPS.length}: {STEPS[step]}
      </h2>
      <FormLayout
        className={styles.layout}
        main={main}
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Số dư hiện tại', value: vnd(balance) },
                { label: 'Phí dịch vụ (theo Bảng giá)', value: vnd(fee), sign: 'minus' },
                { label: 'Số dư sau khi gửi', value: vnd(balance - fee), sign: 'equals', total: true },
              ]}
              note="Phí trừ vào tài khoản trả trước khi bạn gửi hồ sơ."
            />
            {actions}
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
