/**
 * whatsappHelper.ts
 *
 * Utility to open a WhatsApp conversation with a phone number.
 * Normalises Spanish phone numbers and opens wa.me link.
 */

/**
 * Normalise a Spanish phone number to international format (34XXXXXXXXX).
 * Accepts: +34 600 123 456, 0034600123456, 600123456, 34600123456, etc.
 */
export function normalisePhone(raw: string): string {
  // Strip everything except digits and leading +
  let digits = raw.replace(/[^0-9]/g, '')

  // Remove leading 00 (international prefix)
  if (digits.startsWith('00')) digits = digits.slice(2)

  // If it doesn't start with country code, assume Spain (34)
  if (!digits.startsWith('34') && digits.length >= 9) {
    digits = '34' + digits
  }

  return digits
}

/**
 * Build a WhatsApp wa.me URL.
 * @param phone - Raw phone string (will be normalised)
 * @param message - Optional pre-filled message
 */
export function whatsappUrl(phone: string, message?: string): string {
  const num = normalisePhone(phone)
  const base = `https://wa.me/${num}`
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`
  }
  return base
}

/**
 * Open WhatsApp chat in a new tab.
 */
export function openWhatsApp(phone: string, message?: string): void {
  window.open(whatsappUrl(phone, message), '_blank', 'noopener')
}
