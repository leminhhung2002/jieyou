import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { phoneVN } from '../../admin/format.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, CostCard, Field, FormGrid, FormLayout, PageHeader, PrimaryButton, SelectField, SubmitError, TextField } from '../ui.jsx';
import styles from './WebappPage.module.css';

const EMPTY = { kind: '', projectName: '', description: '', budget: '', deadline: '', references: '', contactName: '', phone: '', email: '' };
const MIN_DESC = 20;

function validate(f) {
  const e = {};
  if (!f.kind) e.kind = 'Vui lòng chọn loại sản phẩm';
  if (!f.projectName.trim()) e.projectName = 'Vui lòng nhập tên dự án';
  if (f.description.trim().length < MIN_DESC) e.description = `Vui lòng mô tả yêu cầu (tối thiểu ${MIN_DESC} ký tự)`;
  if (!f.budget) e.budget = 'Vui lòng chọn ngân sách dự kiến';
  if (!f.deadline) e.deadline = 'Vui lòng chọn thời gian mong muốn';
  if (!f.contactName.trim()) e.contactName = 'Vui lòng nhập tên người liên hệ';
  if (!/^(\+?84|0)\d{9}$/.test(f.phone.replace(/[\s.-]/g, ''))) e.phone = 'Số điện thoại không hợp lệ';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Email không hợp lệ';
  return e;
}

/** Gửi yêu cầu làm app / web: miễn phí, admin liên hệ tư vấn và báo giá. */
export default function WebappPage() {
  useDocumentTitle('Làm app/web theo yêu cầu – JIEYOU');
  const { summary, catalog } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('webapp');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const opts = catalog?.webapp;

  // Điền sẵn liên hệ từ hồ sơ tài khoản
  useEffect(() => {
    if (!summary) return;
    const u = summary.user;
    setForm((f) => ({ ...f, contactName: f.contactName || u.businessName || '', phone: f.phone || phoneVN(u.phone), email: f.email || u.email || '' }));
  }, [summary]);

  const err = (k) => errors[k] || fieldErrors[k];
  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    clearError(key);
  };
  const select = (key, label, options) => (
    <SelectField
      label={label}
      name={key}
      options={[{ value: '', label: 'Chọn…' }, ...(options || []).map((o) => ({ value: o, label: o }))]}
      value={form[key]}
      onChange={(e) => update(key, e.target.value)}
      error={err(key)}
    />
  );

  const onSubmit = (e) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    submit({ ...form, phone: form.phone.replace(/[\s.-]/g, '') });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/webapp.svg"
        eyebrow="Làm app/web theo yêu cầu"
        title="Gửi yêu cầu làm app, website"
        subtitle="Mô tả sản phẩm bạn cần. Gửi miễn phí, chúng tôi liên hệ tư vấn và báo giá trong 24 giờ làm việc."
      />
      <FormLayout
        main={
          <>
            <Card title="Sản phẩm cần làm">
              <FormGrid className={styles.grid}>
                {select('kind', 'Loại sản phẩm', opts?.kinds)}
                <TextField
                  label="Tên dự án"
                  name="projectName"
                  maxLength={120}
                  placeholder="VD: Website bán hàng An Phát"
                  value={form.projectName}
                  onChange={(e) => update('projectName', e.target.value)}
                  error={err('projectName')}
                  required
                />
                <Field
                  span
                  label="Mô tả yêu cầu"
                  error={err('description')}
                  hint="Chức năng chính, đối tượng người dùng, giao diện mong muốn… càng chi tiết báo giá càng sát."
                >
                  {(id, describedBy, invalid) => (
                    <textarea
                      id={id}
                      name="description"
                      rows={7}
                      maxLength={3000}
                      className={`${styles.textarea} ${invalid ? styles.textareaInvalid : ''}`}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  )}
                </Field>
                {select('budget', 'Ngân sách dự kiến', opts?.budgets)}
                {select('deadline', 'Thời gian mong muốn', opts?.deadlines)}
                <TextField
                  span
                  label="Website / app tham khảo (không bắt buộc)"
                  name="references"
                  maxLength={500}
                  placeholder="Đường dẫn các sản phẩm bạn thích"
                  value={form.references}
                  onChange={(e) => update('references', e.target.value)}
                  error={err('references')}
                />
              </FormGrid>
            </Card>

            <Card title="Thông tin liên hệ">
              <FormGrid className={styles.grid}>
                <TextField
                  span
                  label="Người liên hệ"
                  name="contactName"
                  maxLength={120}
                  value={form.contactName}
                  onChange={(e) => update('contactName', e.target.value)}
                  error={err('contactName')}
                  required
                />
                <TextField
                  label="Số điện thoại"
                  name="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  error={err('phone')}
                  required
                />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  error={err('email')}
                  required
                />
              </FormGrid>
            </Card>
          </>
        }
        aside={
          <>
            <CostCard
              title="Chi phí"
              rows={[
                { label: 'Phí gửi yêu cầu', value: 'Miễn phí' },
                { label: 'Báo giá', value: 'Trong 24 giờ', total: true },
              ]}
              note="Không trừ tiền khi gửi. Báo giá được gửi qua thông báo, email và điện thoại."
            />
            <PrimaryButton type="submit" block disabled={submitting || !opts}>
              {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
