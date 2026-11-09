import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { userStore } from './userStore.js';
import { adminStore } from './adminStore.js';
import { accountStore } from './accountStore.js';

/**
 * Lưu toàn bộ dữ liệu xuống SQLite để không mất khi server khởi động lại.
 *
 * Các kho (userStore, adminStore, accountStore) vẫn làm việc trong bộ nhớ như cũ; sau mỗi request có ghi
 * dữ liệu, `save()` ghi lại những bộ sưu tập có thay đổi trong MỘT giao dịch SQLite (WAL, an toàn khi mất điện).
 * Mỗi bản ghi là một dòng JSON trong bảng `records`, giữ đúng thứ tự (cột `pos`).
 * Mã OTP và đăng ký đang chờ xác thực vẫn chỉ ở bộ nhớ vì chỉ sống vài phút.
 */

const A = adminStore.db;
const C = accountStore.db;

/** name -> [lấy ra mảng để lưu, nạp lại từ mảng] */
const COLLECTIONS = {
  users: [() => userStore.list(), (rows) => userStore._load(rows)],
  roles: [() => A.roles, (rows) => (A.roles = rows)],
  admins: [() => A.admins, (rows) => (A.admins = rows)],
  applications: [() => A.applications, (rows) => (A.applications = rows)],
  transactions: [() => A.transactions, (rows) => (A.transactions = rows)],
  priceItems: [() => A.priceItems, (rows) => (A.priceItems = rows)],
  logs: [() => A.logs, (rows) => (A.logs = rows)],
  notifications: [() => C.notifications, (rows) => (C.notifications = rows)],
  invoices: [() => C.invoices, (rows) => (C.invoices = rows)],
  smmSettings: [() => [A.smmSettings], ([s]) => s && (A.smmSettings = s)],
  drafts: [() => [...C.drafts.entries()], (rows) => (C.drafts = new Map(rows))],
  meta: [
    () => [{ invoicesPending: A.invoicesPending, invoiceSeq: C.invoiceSeq }],
    ([m]) => {
      if (!m) return;
      A.invoicesPending = m.invoicesPending;
      C.invoiceSeq = m.invoiceSeq;
    },
  ],
};

let db = null;
let dbFile = null;
const lastSaved = new Map(); // name -> JSON đã lưu, để chỉ ghi bộ sưu tập có thay đổi

/**
 * Mở (tạo) CSDL. Nếu đã có dữ liệu thì nạp vào bộ nhớ và trả về true; CSDL trống thì trả về false
 * (khi đó gọi seed rồi `save()`).
 */
export function openDatabase(file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  dbFile = path.resolve(file);
  db = new DatabaseSync(dbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      pos INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (collection, pos)
    );
  `);
  lastSaved.clear();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM records').get();
  if (!n) return false;

  const select = db.prepare('SELECT data FROM records WHERE collection = ? ORDER BY pos');
  for (const [name, [, load]] of Object.entries(COLLECTIONS)) {
    const rows = select.all(name).map((r) => JSON.parse(r.data));
    load(rows);
    lastSaved.set(name, JSON.stringify(rows));
  }
  return true;
}

/** Ghi các bộ sưu tập đã thay đổi. Không làm gì nếu chưa mở CSDL (vd. khi chạy test). */
export function save() {
  if (!db) return;
  const changed = [];
  for (const [name, [dump]] of Object.entries(COLLECTIONS)) {
    const rows = dump();
    const json = JSON.stringify(rows);
    if (lastSaved.get(name) !== json) changed.push([name, rows, json]);
  }
  if (!changed.length) return;

  const del = db.prepare('DELETE FROM records WHERE collection = ?');
  const ins = db.prepare('INSERT INTO records (collection, pos, data) VALUES (?, ?, ?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [name, rows] of changed) {
      del.run(name);
      rows.forEach((row, i) => ins.run(name, i, JSON.stringify(row)));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  for (const [name, , json] of changed) lastSaved.set(name, json);
}

/** Lưu an toàn (ghi log thay vì làm sập request). */
export function saveSafely() {
  try {
    save();
  } catch (err) {
    console.error('[DB] Lưu dữ liệu thất bại:', err);
  }
}

/** Sao lưu ra file riêng (VACUUM INTO), giữ `keep` bản mới nhất. Trả về đường dẫn bản sao lưu. */
export function backup(dir, keep = 14) {
  if (!db) return null;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const target = path.join(dir, `jieyou-${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(target);
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^jieyou-\d{8}-\d{6}\.db$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return target;
}

export function closeDatabase() {
  if (!db) return;
  saveSafely();
  db.close();
  db = null;
}
