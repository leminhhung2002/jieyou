import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** Chỉ chấp nhận đúng thuật toán HS256 và đúng issuer (OWASP A02 – chống tấn công đổi thuật toán / dùng token lạ). */
const ALG = 'HS256';
const ISSUER = 'jieyou';

export const signJwt = (payload, expiresIn) => jwt.sign(payload, config.jwtSecret, { algorithm: ALG, issuer: ISSUER, expiresIn });

export const verifyJwt = (token) => jwt.verify(String(token || ''), config.jwtSecret, { algorithms: [ALG], issuer: ISSUER });

/**
 * Phiên bản thông tin đăng nhập của tài khoản. Tăng lên mỗi khi đổi / đặt lại mật khẩu,
 * mọi token cũ (phiên đăng nhập, token đặt lại mật khẩu) mang `ver` cũ sẽ hết hiệu lực.
 */
export const credentialVersion = (account) => account?.tokenVersion || 0;
