import { randomInt } from 'crypto'

// Supabase Auth's password policy requires at least one character from each
// of these four classes; a draw that misses one is rejected with a 422.
// Excludes visually ambiguous characters (0/O, 1/l/I) since this is read off
// a screen and typed back in by someone else, not autofilled.
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

const MIN_LENGTH = 12

function pick(chars: string): string {
  return chars[randomInt(chars.length)]
}

// Seeds one character from each required class, fills the remainder from the
// full alphabet, then shuffles (Fisher-Yates) so the seeded characters don't
// sit in predictable positions. crypto.randomInt is the CSPRNG-backed,
// unbiased counterpart to crypto.getRandomValues - never Math.random.
export function generateTempPassword(length = 16): string {
  const size = Math.max(length, MIN_LENGTH)
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < size) {
    chars.push(pick(ALL))
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
