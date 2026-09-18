/**
 * Hide payment card numbers that customers paste into chat. Only digit runs that pass the
 * Luhn check are masked, so order numbers and phone numbers are left alone.
 */
// Ends on a digit so a trailing space or punctuation isn't swallowed with the number.
const CARD_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g;

export function maskCardNumbers(text: string | null | undefined): string {
  if (!text) {
    return text ?? "";
  }

  return text.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, "");

    if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) {
      return match;
    }

    return `•••• •••• •••• ${digits.slice(-4)}`;
  });
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);

    if (double) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }

    sum += value;
    double = !double;
  }

  return sum % 10 === 0;
}
