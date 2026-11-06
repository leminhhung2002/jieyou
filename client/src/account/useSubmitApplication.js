import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from './accountApi.js';
import { useAccount } from './AccountLayout.jsx';

/**
 * Gửi hồ sơ / đơn dịch vụ: POST /api/account/applications.
 * - Lỗi theo trường (`details.field`) → `fieldErrors[field]`, lỗi chung → `error`.
 * - Số dư không đủ (402) → `insufficient = true` để trang hiện link Nạp tiền.
 * - Thành công → làm mới số dư, toast, chuyển về Tổng quan (hồ sơ hiện ở "Hồ sơ gần đây").
 */
export function useSubmitApplication(type) {
  const { refresh, toast } = useAccount();
  const navigate = useNavigate();
  const [state, setState] = useState({ submitting: false, error: '', fieldErrors: {}, insufficient: false });

  const submit = useCallback(
    async (details) => {
      setState({ submitting: true, error: '', fieldErrors: {}, insufficient: false });
      try {
        const res = await accountApi.submit(type, details);
        await refresh();
        toast(`Đã gửi ${res.application.title}. Chúng tôi sẽ thông báo khi có kết quả duyệt.`);
        navigate('/tai-khoan');
        return res;
      } catch (e) {
        const field = e.details?.field;
        setState({
          submitting: false,
          error: field && field !== 'balance' ? '' : e.message,
          fieldErrors: field && field !== 'balance' ? { [field]: e.message } : {},
          insufficient: e.status === 402,
        });
        return null;
      }
    },
    [type, refresh, toast, navigate],
  );

  /** Xoá lỗi của một trường khi người dùng sửa lại. */
  const clearError = useCallback(
    (field) =>
      setState((s) => (s.fieldErrors[field] || s.error ? { ...s, error: '', fieldErrors: { ...s.fieldErrors, [field]: undefined } } : s)),
    [],
  );

  return { ...state, submit, clearError };
}
