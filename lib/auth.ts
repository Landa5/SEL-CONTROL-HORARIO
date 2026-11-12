import bcrypt from 'bcryptjs';
export { signToken, verifyToken, getSession, updateSession } from './jwt';

export async function hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(plain: string, hashed: string) {
    return await bcrypt.compare(plain, hashed);
}
