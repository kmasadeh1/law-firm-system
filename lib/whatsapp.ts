// The one place a phone number is turned into a WhatsApp link - used by the
// public site's contact button, the dashboard's reminders and case share links.
// Formatting only: it decides nothing about who may be contacted.
//
// wa.me takes the full international number as digits only - no plus, no
// spaces, no punctuation: "+962791462040" -> "962791462040". Client, staff,
// enquiry and counsel phones are stored that way already (normalise_phone,
// in the database), so stripping the "+" is all they need.
//
// firm_settings.phone and whatsapp_phone are deliberately NOT normalised -
// the public site shows them as the owner typed them - and the public
// WhatsApp button passes them through here. So this stays tolerant: every
// non-digit is stripped ("+962 79 146 2040"), and a leading "00", the
// international dialling prefix written out, is dropped the same as "+"
// ("00962791462040"). A number typed without its country code can't be
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

// A pre-filled message with no recipient: WhatsApp asks the person which
// chat to send it to. For text that isn't tied to one stored number, such
// as a case-tracking link a lawyer may send to the client or to someone
// acting for them.
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
