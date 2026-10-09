// A Jordanian-dinar amount written out in words, for payment receipts - the
// line that stops a figure being altered after the receipt is handed over.
// Display formatting only, like lib/format-money.ts: it spells out a stored
// amount and decides nothing.
//
// Amounts are numeric(12,2) dinars. The two decimals are hundredths of a
// dinar; a dinar is 1000 fils, so 0.50 is 500 fils. The amount is split
// from its fixed two-decimal string, never by float arithmetic.
//
// Arabic follows the counted-noun (tamyiz) rules for a masculine noun
// (دينار, فلس, ألف, مليون, مليار are all masculine), reading the noun's form
// off the last two digits of the number before it:
//   1                -> دينار أردني واحد      (noun first)
//   2                -> ديناران أردنيان       (dual, no number word)
//   ..00 (100, 1000)  -> مائة دينار أردني      (singular, in construct: a
//                                              dual before it drops its ن -
//                                              مئتا دينار، ألفا دينار - and an
//                                              accusative its tanween - أحد
//                                              عشر ألف دينار)
//   ..03 - ..10      -> ثلاثة دنانير أردنية   (plural; 3-10 take the
//                                              feminine-looking form)
//   ..11 - ..99      -> أحد عشر دينارًا أردنيًا (singular accusative)
//   ..01, ..02 >100  -> مائة وواحد دينار أردني (the common receipt and
//                                              cheque convention; the
//                                              classical alternative is
//                                              مائة دينار ودينار)
// The same rules apply to the count of thousands, millions and billions.
// Number words are in the nominative, as receipts are conventionally read.
// The phrase is framed as "فقط ... لا غير", the Jordanian receipt formula.

type Locale = 'ar' | 'en'

function splitAmount(amount: number): { dinars: number; fils: number } {
  const [whole, hundredths] = amount.toFixed(2).split('.')
  return { dinars: Number(whole), fils: Number(hundredths) * 10 }
}

// ---------------------------------------------------------------- Arabic

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const AR_HUNDREDS = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

function arBelowHundred(n: number): string {
  if (n <= 10) return AR_ONES[n]
  if (n === 11) return 'أحد عشر'
  if (n === 12) return 'اثنا عشر'
  if (n < 20) return `${AR_ONES[n - 10]} عشر`
  const unit = n % 10
  const tens = AR_TENS[Math.floor(n / 10)]
  return unit === 0 ? tens : `${AR_ONES[unit]} و${tens}`
}

// 1..999, in the forms used before a masculine counted noun.
function arBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds > 0) parts.push(AR_HUNDREDS[hundreds])
  if (rest > 0) parts.push(arBelowHundred(rest))
  return parts.join(' و')
}

type NounForms = {
  singular: string // after ..00 and the ..01/..02 convention
  dual: string
  plural: string // after 3-10
  accusative: string // after 11-99
}

// Number words for `count` (>= 1) followed by its counted noun. A count of 1
// or 2 is the noun alone (ألف، ألفان); the caller adds "واحد" for a final 1.
function arCounted(count: number, noun: NounForms): string {
  if (count === 1) return noun.singular
  if (count === 2) return noun.dual
  const words = arWholeNumber(count)
  const lastTwo = count % 100
  if (lastTwo >= 3 && lastTwo <= 10) return `${words} ${noun.plural}`
  if (lastTwo >= 11) return `${words} ${noun.accusative}`
  if (lastTwo === 0) {
    // The word before the noun is in construct with it (إضافة):
    //   a dual drops its ن         - مئتان -> مئتا دينار، ألفان -> ألفا دينار
    //   an accusative drops its tanween - ألفًا -> أحد عشر ألف دينار
    // (only a final noun can follow a scale word directly; a count of
    // thousands or millions is always under 1000, so never ends in one).
    if (words.endsWith('ان')) return `${words.slice(0, -1)} ${noun.singular}`
    if (words.endsWith('ًا')) return `${words.slice(0, -2)} ${noun.singular}`
  }
  return `${words} ${noun.singular}`
}

const AR_SCALES: { value: number; noun: NounForms }[] = [
  { value: 1e9, noun: { singular: 'مليار', dual: 'ملياران', plural: 'مليارات', accusative: 'مليارًا' } },
  { value: 1e6, noun: { singular: 'مليون', dual: 'مليونان', plural: 'ملايين', accusative: 'مليونًا' } },
  { value: 1e3, noun: { singular: 'ألف', dual: 'ألفان', plural: 'آلاف', accusative: 'ألفًا' } },
]

// Any whole number >= 1, without a counted noun of its own.
function arWholeNumber(n: number): string {
  const parts: string[] = []
  let rest = n
  for (const scale of AR_SCALES) {
    const count = Math.floor(rest / scale.value)
    if (count > 0) parts.push(arCounted(count, scale.noun))
    rest %= scale.value
  }
  if (rest > 0) parts.push(arBelowThousand(rest))
  return parts.join(' و')
}

const AR_DINAR: NounForms = {
  singular: 'دينار أردني',
  dual: 'ديناران أردنيان',
  plural: 'دنانير أردنية',
  accusative: 'دينارًا أردنيًا',
}

const AR_FILS: NounForms = {
  singular: 'فلس',
  dual: 'فلسان',
  plural: 'فلوس',
  accusative: 'فلسًا',
}

function arWithNoun(n: number, noun: NounForms): string {
  if (n === 1) return `${noun.singular} واحد`
  return arCounted(n, noun)
}

function arabicAmount(dinars: number, fils: number): string {
  const parts: string[] = []
  if (dinars > 0) parts.push(arWithNoun(dinars, AR_DINAR))
  if (fils > 0) parts.push(arWithNoun(fils, AR_FILS))
  return `فقط ${parts.join(' و')} لا غير`
}

// --------------------------------------------------------------- English

const EN_ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function enBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const below =
    rest < 20 ? EN_ONES[rest] : EN_TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${EN_ONES[rest % 10]}` : '')
  if (hundreds === 0) return below
  return rest === 0 ? `${EN_ONES[hundreds]} hundred` : `${EN_ONES[hundreds]} hundred and ${below}`
}

const EN_SCALES: [number, string][] = [
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
]

// British usage, as in Jordanian English: "and" before the last part under
// a hundred, e.g. "two thousand and five", "one hundred and twenty".
function enWholeNumber(n: number): string {
  const parts: string[] = []
  let rest = n
  for (const [value, name] of EN_SCALES) {
    const count = Math.floor(rest / value)
    if (count > 0) parts.push(`${enBelowThousand(count)} ${name}`)
    rest %= value
  }
  if (rest > 0) parts.push(rest < 100 && parts.length > 0 ? `and ${enBelowThousand(rest)}` : enBelowThousand(rest))
  return parts.join(' ')
}

function englishAmount(dinars: number, fils: number): string {
  const parts: string[] = []
  if (dinars > 0) parts.push(`${enWholeNumber(dinars)} Jordanian ${dinars === 1 ? 'dinar' : 'dinars'}`)
  if (fils > 0) parts.push(`${enWholeNumber(fils)} fils`)
  const text = `${parts.join(' and ')} only`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// --------------------------------------------------------------- Public

// null for anything that can't be spelled out honestly (not a positive
// finite amount, or beyond numeric(12,2)'s range) - the receipt then shows
// no words line rather than a wrong one.
export function amountInWords(amount: number | null | undefined, locale: string): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0 || amount >= 1e12) {
    return null
  }
  const { dinars, fils } = splitAmount(amount)
  if (dinars === 0 && fils === 0) return null
  return (locale as Locale) === 'ar' ? arabicAmount(dinars, fils) : englishAmount(dinars, fils)
}
