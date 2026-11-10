import { useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useApi } from '../../hooks/useApi.js';
import { dateTimeShort, vnd } from '../../admin/format.js';
import { formatVnd } from '../../utils/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { Card, ChoiceGroup, CostCard, FormLayout, OutlineButton, PageHeader, PrimaryButton, SubmitError, TextField } from '../ui.jsx';
import styles from './LicensePage.module.css';

/** Mua key phần mềm bản quyền: trừ số dư, nhận key ngay trên trang (kèm email). */
export default function LicensePage() {
  useDocumentTitle('Key phần mềm bản quyền – JIEYOU');
  const { summary, catalog, refresh, toast } = useAccount();
  const [reload, setReload] = useState(0);
  const products = useApi((o) => accountApi.licenses(o), [reload]);
  const orders = useApi((o) => accountApi.licenseOrders(o), [reload]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [state, setState] = useState({ submitting: false, error: '', fieldErrors: {}, insufficient: false });
  const [justBought, setJustBought] = useState(null);

  const list = products.data ?? [];
  const product = list.find((p) => p.id === productId) ?? list.find((p) => p.stock > 0) ?? null;
  const max = Math.min(product?.stock ?? 0, catalog?.licenseMaxPerOrder ?? 20);
  const qty = Number(quantity) || 0;
  const qtyValid = product && qty >= 1 && qty <= max;
  const total = (product?.price ?? 0) * qty;
  const balance = summary?.stats.balance ?? 0;

  const clear = (field) => setState((s) => ({ ...s, error: '', fieldErrors: { ...s.fieldErrors, [field]: undefined } }));

  const copy = async (text, message = 'Đã sao chép key') => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast('Không sao chép được, hãy bôi đen và sao chép thủ công', 'error');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!qtyValid) return;
    setState({ submitting: true, error: '', fieldErrors: {}, insufficient: false });
    try {
      const res = await accountApi.submit('license', { product: product.id, quantity: qty });
      setJustBought(res.application);
      setState({ submitting: false, error: '', fieldErrors: {}, insufficient: false });
      setQuantity('1');
      setReload((n) => n + 1);
      refresh();
      toast(`Đã mua ${qty} key ${product.name}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const field = err.details?.field;
      const onField = field && field !== 'balance';
      setState({
        submitting: false,
        error: onField ? '' : err.message,
        fieldErrors: onField ? { [field]: err.message } : {},
        insufficient: err.status === 402,
      });
      if (err.status === 409) setReload((n) => n + 1);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/license.svg"
        eyebrow="Key phần mềm bản quyền"
        title="Mua key bản quyền"
        subtitle="Thanh toán bằng số dư, nhận key ngay trên trang này và qua email."
      />

      {justBought && (
        <Card className={styles.bought} aria-live="polite">
          <div className={styles.boughtHead}>
            <div>
              <p className={styles.boughtEyebrow}>Mua thành công · {justBought.code}</p>
              <h2 className={styles.boughtTitle}>{justBought.details?.['Sản phẩm']}</h2>
            </div>
            {justBought.keys?.length > 1 && (
              <OutlineButton size="md" onClick={() => copy(justBought.keys.join('\n'), 'Đã sao chép tất cả key')}>
                Sao chép tất cả
              </OutlineButton>
            )}
          </div>
          <KeyList keys={justBought.keys || []} onCopy={copy} />
          <p className={styles.hint}>Lưu lại key và không chia sẻ cho người khác. Bạn luôn xem lại được key ở mục “Key đã mua” bên dưới.</p>
        </Card>
      )}

      <FormLayout
        main={
          <>
            <Card title="Chọn phần mềm">
              {products.loading && !products.data && <p className={styles.hint}>Đang tải danh sách sản phẩm…</p>}
              {products.error && <p className={styles.error}>{products.error.message}</p>}
              {products.data && !list.length && <p className={styles.hint}>Hiện chưa có sản phẩm nào đang bán. Vui lòng quay lại sau.</p>}
              {list.length > 0 && (
                <ChoiceGroup label="Sản phẩm" className={styles.products}>
                  {list.map((p) => {
                    const on = product?.id === p.id;
                    const out = p.stock < 1;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        disabled={out}
                        className={`${styles.product} ${on ? styles.productOn : ''}`}
                        onClick={() => {
                          setProductId(p.id);
                          clear('product');
                          clear('quantity');
                        }}
                      >
                        <span className={styles.dot} aria-hidden="true" />
                        <span className={styles.productText}>
                          <span className={styles.productName}>
                            {p.name}
                            {p.category && <span className={styles.category}>{p.category}</span>}
                          </span>
                          {p.description && <span className={styles.productDesc}>{p.description}</span>}
                        </span>
                        <span className={styles.productSide}>
                          <span className={styles.price}>{vnd(p.price)}</span>
                          <span className={out ? styles.stockOut : styles.stock}>{out ? 'Hết hàng' : `Còn ${formatVnd(p.stock)} key`}</span>
                        </span>
                      </button>
                    );
                  })}
                </ChoiceGroup>
              )}
              {state.fieldErrors.product && <p className={styles.error}>{state.fieldErrors.product}</p>}
            </Card>

            {product && (
              <Card title="Số lượng">
                <TextField
                  label="Số key cần mua"
                  name="quantity"
                  inputMode="numeric"
                  autoComplete="off"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value.replace(/\D/g, '').slice(0, 3));
                    clear('quantity');
                  }}
                  error={state.fieldErrors.quantity || (quantity && !qtyValid ? `Từ 1 đến ${max}` : '')}
                  hint={`Tối đa ${max} key mỗi đơn`}
                  required
                />
              </Card>
            )}

            <Card title="Key đã mua">
              {orders.loading && !orders.data && <p className={styles.hint}>Đang tải…</p>}
              {orders.data && !orders.data.length && <p className={styles.hint}>Bạn chưa mua key nào.</p>}
              {orders.data?.length > 0 && (
                <ul className={styles.orders}>
                  {orders.data.map((o) => (
                    <li key={o.code} className={styles.order}>
                      <div className={styles.orderHead}>
                        <span className={styles.orderName}>{o.product}</span>
                        <span className={styles.orderMeta}>
                          {o.code} · {dateTimeShort(o.submittedAt)} · {vnd(o.amount)}
                        </span>
                      </div>
                      <KeyList keys={o.keys} onCopy={copy} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        }
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Đơn giá', value: vnd(product?.price ?? 0) },
                { label: 'Số lượng', value: formatVnd(qty), sign: 'times' },
                { label: 'Tổng thanh toán', value: vnd(total), sign: 'equals', total: true },
                { label: 'Số dư sau khi mua', value: vnd(balance - total) },
              ]}
              note="Key được giao ngay sau khi thanh toán. Hóa đơn phát hành tự động."
            />
            <PrimaryButton type="submit" block disabled={state.submitting || !qtyValid}>
              {state.submitting ? 'Đang xử lý…' : `Mua ngay, trừ ${vnd(total)}`}
            </PrimaryButton>
            <SubmitError error={state.error} insufficient={state.insufficient} />
          </>
        }
      />
    </form>
  );
}

function KeyList({ keys, onCopy }) {
  return (
    <ul className={styles.keys}>
      {keys.map((k, i) => (
        <li key={`${i}-${k}`} className={styles.key}>
          <code className={styles.keyText}>{k}</code>
          <button type="button" className={styles.copy} onClick={() => onCopy(k)} aria-label={`Sao chép key ${i + 1}`}>
            Sao chép
          </button>
        </li>
      ))}
    </ul>
  );
}
