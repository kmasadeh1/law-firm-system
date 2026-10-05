// The one place a phone number is turned into a WhatsApp link - used by the
// public site's contact button and the dashboard's reminders. Formatting
// only: it decides nothing about who may be contacted.
//
// wa.me takes the full international number as digits only - no plus, no
// spaces, no punctuation: "+962 79 146 2040" -> "962791462040". A leading
// "00" is the international dialling prefix written out, the same as "+",
// so it is dropped too. A number stored without its country code can't be
// fixed here (guessing one would be wrong); it produces a link WhatsApp
// itself will reject.
//
// `text` pre-fills the message; WhatsApp opens it in the composer for a
// person to read, edit and send - nothing is sent from here.
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '')
  if (!digits) return null
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`
}
