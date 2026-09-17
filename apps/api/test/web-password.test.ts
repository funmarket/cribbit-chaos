import assert from 'node:assert/strict';
import test from 'node:test';
import { hashWebPassword, validateWebPassword, verifyWebPassword } from '../src/web-password.ts';

test('Web passwords are encoded with Argon2id and never stored as plaintext', () => {
  const password = 'CribbitPassword123';
  const encoded = hashWebPassword(password);
  assert.match(encoded,/^argon2id\$v=1\$/);
  assert.equal(encoded.includes(password),false);
  assert.equal(verifyWebPassword(password,encoded),true);
  assert.equal(verifyWebPassword('WrongPassword123',encoded),false);
});

test('Web password policy rejects short or weak passwords', () => {
  assert.throws(() => validateWebPassword('short1'),/10 to 128/);
  assert.throws(() => validateWebPassword('onlyletterslong'),/letter and one number/);
  assert.throws(() => validateWebPassword('1234567890123'),/letter and one number/);
  assert.equal(validateWebPassword('StrongPassword123'),'StrongPassword123');
});
