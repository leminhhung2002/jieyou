import crypto from 'node:crypto';

/**
 * Kho người dùng trong bộ nhớ. Giao diện (findById/findByPhone/create/update)
 * được giữ nhỏ gọn để có thể thay bằng DB thật (Postgres/Mongo) mà không đổi route.
 */
const users = new Map();

export const userStore = {
  list() {
    return [...users.values()];
  },
  findById(id) {
    return users.get(id) || null;
  },
  findByPhone(phone) {
    for (const u of users.values()) if (u.phone === phone) return u;
    return null;
  },
  findByEmail(email) {
    if (!email) return null;
    for (const u of users.values()) if (u.email === email) return u;
    return null;
  },
  create(data) {
    const user = {
      id: crypto.randomUUID(),
      balance: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...data,
    };
    users.set(user.id, user);
    return user;
  },
  update(id, patch) {
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, patch, { updatedAt: new Date().toISOString() });
    return user;
  },
  /** Bỏ các trường nhạy cảm trước khi trả về client. */
  toPublic(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  },
  _reset() {
    users.clear();
  },
};
