import * as crypto from 'node:crypto';

const VERSION = 1;
const MEMORY_KIB = 65_536;
const PASSES = 3;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;

type Argon2Parameters = {
  message: string | Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

type Argon2Sync = (algorithm: 'argon2id', parameters: Argon2Parameters) => Buffer;

function argon2id(): Argon2Sync {
  const implementation = (crypto as unknown as { argon2Sync?: Argon2Sync }).argon2Sync;
  if (!implementation) {
    throw Object.assign(
      new Error('Cribbit Web authentication requires Node.js 24.7.0 or newer for built-in Argon2id.'),
      { code: 'ARGON2_UNAVAILABLE' },
    );
  }
  return implementation;
}

function derive(password: string, salt: Buffer): Buffer {
  return argon2id()('argon2id', {
    message: password,
    nonce: salt,
    parallelism: PARALLELISM,
    tagLength: TAG_LENGTH,
    memory: MEMORY_KIB,
    passes: PASSES,
  });
}

export function validateWebPassword(password: unknown): string {
  if (typeof password !== 'string') {
    throw Object.assign(new Error('Password is required.'), { code: 'INVALID_PASSWORD', statusCode: 400 });
  }
  if (password.length < 10 || password.length > 128) {
    throw Object.assign(new Error('Password must be 10 to 128 characters.'), { code: 'INVALID_PASSWORD', statusCode: 400 });
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw Object.assign(new Error('Password must contain at least one letter and one number.'), { code: 'INVALID_PASSWORD', statusCode: 400 });
  }
  return password;
}

export function hashWebPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const tag = derive(password, salt);
  return [
    'argon2id',
    `v=${VERSION}`,
    `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM},l=${TAG_LENGTH}`,
    salt.toString('base64url'),
    tag.toString('base64url'),
  ].join('$');
}

export function verifyWebPassword(password: string, encoded: string): boolean {
  try {
    const [algorithm, versionPart, paramsPart, saltPart, tagPart] = encoded.split('$');
    if (algorithm !== 'argon2id' || versionPart !== `v=${VERSION}` || !paramsPart || !saltPart || !tagPart) return false;

    const params = Object.fromEntries(paramsPart.split(',').map(item => item.split('=')));
    if (
      Number(params.m) !== MEMORY_KIB ||
      Number(params.t) !== PASSES ||
      Number(params.p) !== PARALLELISM ||
      Number(params.l) !== TAG_LENGTH
    ) return false;

    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(tagPart, 'base64url');
    if (salt.length < 8 || expected.length !== TAG_LENGTH) return false;
    const actual = derive(password, salt);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// A process-local dummy hash ensures nonexistent usernames take the same Argon2
// verification path as real usernames. It is never persisted and never grants access.
let dummyHash: string | null = null;
export function verifyAgainstCredentialOrDummy(password: string, encoded?: string | null): boolean {
  dummyHash ??= hashWebPassword('CribbitDummyPassword2026');
  return verifyWebPassword(password, encoded || dummyHash);
}
