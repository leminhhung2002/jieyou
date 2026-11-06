import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateTimeShort } from '../format.js';
import { DataTable, FilterSelect, LoadingRow, PageHeader, SearchInput, StatusPill } from '../ui.jsx';
import styles from './LogsPage.module.css';

const RESULT = {
  success: { tone: 'success', label: 'Thành công' },
  failed: { tone: 'danger', label: 'Thất bại' },
};

// Figma: Admin: Nhật ký hoạt động (76:1079)
export default function LogsPage() {
  useDocumentTitle('Nhật ký hoạt động – JIEYOU Admin');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');
  const [list, setList] = useState(null);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);

  // Tìm kiếm khi ngừng gõ 300ms
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    adminApi
      .logs({ q: query, action }, { signal: ctrl.signal })
      .then(({ data, meta }) => {
        setList(data);
        setActions(meta.actions || []);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e));
    return () => ctrl.abort();
  }, [query, action]);

  const actionOptions = [{ value: 'all', label: 'Tất cả hành động' }, ...actions.map((a) => ({ value: a, label: a }))];

  const columns = [
    { key: 'at', label: 'Thời gian', width: 145.313, className: styles.plain, render: (r) => dateTimeShort(r.at) },
    { key: 'actor', label: 'Người thực hiện', width: 225.828, className: styles.strong },
    { key: 'action', label: 'Hành động', width: 238.531 },
    { key: 'target', label: 'Đối tượng', width: 275.563 },
    {
      key: 'result',
      label: 'Kết quả',
      width: 190.766,
      render: (r) => {
        const s = RESULT[r.result] || RESULT.failed;
        return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Nhật ký hoạt động" subtitle="Mọi thao tác của quản trị viên đều được ghi lại." />
      <div className={styles.toolbar}>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm theo người thực hiện hoặc đối tượng" />
        <FilterSelect label="Lọc hành động" value={action} onChange={setAction} options={actionOptions} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!list ? (
        <LoadingRow />
      ) : (
        <DataTable
          caption="Nhật ký hoạt động"
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          empty={query || action !== 'all' ? 'Không có hoạt động phù hợp' : 'Chưa có hoạt động nào'}
        />
      )}
    </>
  );
}
