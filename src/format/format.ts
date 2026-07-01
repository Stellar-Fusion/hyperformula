/**
 * @license
 * Copyright (c) 2025 Handsoncode. All rights reserved.
 */

import {Config} from '../Config'
import {TIME_FORMAT_SECONDS_ITEM_REGEXP} from '../DateTimeDefault'
import {DateTimeHelper, numberToSimpleTime, SimpleDateTime, SimpleTime} from '../DateTimeHelper'
import {RawScalarValue} from '../interpreter/InterpreterValue'
import {Maybe} from '../Maybe'
import {FormatToken, parseForDateTimeFormat, parseForNumberFormat, TokenType} from './parser'

/* Excel month-name tokens: mmm -> abbreviated, mmmm -> full, mmmmm -> single letter.
 * ponytail: en-US names only (the Excel default). Wire these to the locale if non-English
 * month names are ever needed. */
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* Excel number formats may carry up to four `;`-separated sections: positive;negative;zero;text.
 * Split at the top level only — a `;` inside a quoted literal ("...") or escaped (\;) is literal
 * text, not a separator. ponytail: the 4th (text) section is irrelevant for numeric values. */
function splitFormatSections(formatArg: string): string[] {
  const sections: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < formatArg.length; ++i) {
    const char = formatArg[i]
    if (char === '\\' && i + 1 < formatArg.length) {
      current += char + formatArg[i + 1]
      ++i
      continue
    }
    if (char === '"') {
      inQuote = !inQuote
      current += char
      continue
    }
    if (char === ';' && !inQuote) {
      sections.push(current)
      current = ''
      continue
    }
    current += char
  }
  sections.push(current)
  return sections
}

/* Pick the section matching the value's sign (Excel rules): positive -> [0]; negative -> [1]
 * formatted with the absolute value (the section supplies its own sign/parens); zero -> [2].
 * An ABSENT (undefined) negative/zero section falls back to [0] (a negative value keeps its `-`);
 * an EXPLICITLY EMPTY section (e.g. `0;;`) is a valid Excel instruction to display nothing for that
 * sign, so it is returned as-is and renders as an empty string. */
function selectNumberFormatSection(sections: string[], value: number): { sectionFormat: string, sectionValue: number } {
  if (value < 0 && sections[1] !== undefined) {
    return {sectionFormat: sections[1], sectionValue: Math.abs(value)}
  }
  if (value === 0 && sections[2] !== undefined) {
    return {sectionFormat: sections[2], sectionValue: value}
  }
  return {sectionFormat: sections[0], sectionValue: value}
}

/* Strip Excel format-literal quoting from a pure-text section: "..." quotes and \ escapes, so an
 * accounting zero section like "-" renders as - rather than the raw quoted pattern. */
function stripFormatLiteral(section: string): string {
  return section.replace(/\\(.)/g, '$1').replace(/"/g, '')
}

/* Dispatch a single (already section-selected) format through the date, duration, then number
 * formatters — the original single-format behaviour. */
function formatSection(value: number, formatArg: string, config: Config, dateHelper: DateTimeHelper): RawScalarValue {
  const tryDateTime = config.stringifyDateTime(dateHelper.numberToSimpleDateTime(value), formatArg) // default points to defaultStringifyDateTime()
  if (tryDateTime !== undefined) {
    return tryDateTime
  }
  const tryDuration = config.stringifyDuration(numberToSimpleTime(value), formatArg)
  if (tryDuration !== undefined) {
    return tryDuration
  }
  const expression = parseForNumberFormat(formatArg)
  if (expression !== undefined) {
    return numberFormat(expression.tokens, value)
  }
  return formatArg
}

export function format(value: number, formatArg: string, config: Config, dateHelper: DateTimeHelper): RawScalarValue {
  const sections = splitFormatSections(formatArg)
  if (sections.length <= 1) {
    return formatSection(value, formatArg, config, dateHelper)
  }
  // Select the sign-appropriate section first, then dispatch it through every formatter (date,
  // duration, number) — not just the number path — so a date/duration first section is honoured.
  const {sectionFormat, sectionValue} = selectNumberFormatSection(sections, value)
  const formatted = formatSection(sectionValue, sectionFormat, config, dateHelper)
  // A pure-text section parses as nothing and round-trips unchanged; strip its quoting so it renders
  // as display text instead of the raw format pattern.
  return formatted === sectionFormat ? stripFormatLiteral(sectionFormat) : formatted
}

export function padLeft(number: number | string, size: number) {
  let result = `${number}`
  while (result.length < size) {
    result = '0' + result
  }
  return result
}

export function padRight(number: number | string, size: number) {
  let result = `${number}`
  while (result.length < size) {
    result = result + '0'
  }
  return result
}

function countChars(text: string, char: string) {
  return text.split(char).length - 1
}

/* Strip Excel format-literal syntax from free text: `\x` escapes (keep x) and `"..."` quote
 * delimiters, leaving the display text (e.g. `\%` and `"%"` both render as `%`). */
function renderFormatLiteral(text: string): string {
  let result = ''
  for (let i = 0; i < text.length; ++i) {
    const ch = text[i]
    if (ch === '\\' && i + 1 < text.length) {
      result += text[i + 1]
      ++i
      continue
    }
    if (ch === '"') {
      continue
    }
    result += ch
  }
  return result
}

/* Count only ACTIVE percent signs — Excel format tokens, not display text. An escaped `\%` or a `%`
 * inside a `"..."` quoted literal is display text and must not scale the value by 100. */
function countActivePercent(text: string): number {
  let count = 0
  let inQuote = false
  for (let i = 0; i < text.length; ++i) {
    const ch = text[i]
    if (ch === '\\' && i + 1 < text.length) {
      ++i
      continue
    }
    if (ch === '"') {
      inQuote = !inQuote
      continue
    }
    if (ch === '%' && !inQuote) {
      ++count
    }
  }
  return count
}

function countPercentSigns(tokens: FormatToken[]): number {
  return tokens
    .filter((token) => token.type === TokenType.FREE_TEXT)
    .reduce((count, token) => count + countActivePercent(token.value), 0)
}

/* Excel rounds halves away from zero (2.5 -> 3, -2.5 -> -3), unlike JS toFixed which rounds
 * half-to-even on the binary value. Shifting through the decimal string (rather than value * 10**d)
 * avoids re-introducing floating-point noise. ponytail: values >= 1e15 have no meaningful
 * fractional digits in a double, so skip the shift (whose `e`-notation string would break) and
 * return them unchanged. */
function roundHalfAwayFromZero(value: number, decimals: number): number {
  if (!isFinite(value) || Math.abs(value) >= 1e15) {
    return value
  }
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  /* Magnitudes below ~1e-6 stringify in exponent form (e.g. "1e-7"), which would corrupt the
   * decimal-shift string into "1e-7e2" -> NaN. At that scale a plain numeric shift carries no
   * half-rounding risk (no representable half lands on a boundary), so use it directly. */
  if (abs.toString().includes('e')) {
    const factor = 10 ** decimals
    return sign * Math.round(abs * factor) / factor
  }
  const shifted = Math.round(Number(`${abs}e${decimals}`))
  return sign * Number(`${shifted}e${-decimals}`)
}

function numberFormat(tokens: FormatToken[], value: number): RawScalarValue {
  let result = ''

  /* Excel's `%` format token scales the displayed value by 100 for each `%` in the format
   * (e.g. "0.0%" renders 0.032 as "3.2%"). The `%` literal is emitted as free text by the
   * loop below; here we only scale the numeric value before its digits are formatted. */
  const percentSigns = countPercentSigns(tokens)
  value = value * 100 ** percentSigns

  /* Excel rounds display values to 15 significant digits. Normalising here absorbs binary
   * floating-point noise (e.g. 0.0295 * 100 === 2.9499999999999997) so the per-token rounding
   * below matches Excel (2.95 -> "3.0%" rather than "2.9%"). `value` is finite here: the
   * date/duration branches in `format()` run first, so only real numbers reach `numberFormat`. */
  if (value !== 0) {
    value = Number(value.toPrecision(15))
  }

  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i]
    if (token.type === TokenType.FREE_TEXT) {
      result += renderFormatLiteral(token.value)
      continue
    }

    const tokenParts = token.value.split('.')
    const integerFormat = tokenParts[0]
    const decimalFormat = tokenParts[1] || ''
    const separator = tokenParts[1] ? '.' : ''

    /* get fixed-point number without trailing zeros */
    const valueParts = roundHalfAwayFromZero(value, decimalFormat.length).toString().split('.')
    let integerPart = valueParts[0] || ''
    let decimalPart = valueParts[1] || ''

    if (integerFormat.length > integerPart.length) {
      const padSizeInteger = countChars(integerFormat.substr(0, integerFormat.length - integerPart.length), '0')
      integerPart = padLeft(integerPart, padSizeInteger + integerPart.length)
    }

    const padSizeDecimal = countChars(decimalFormat.substr(decimalPart.length, decimalFormat.length - decimalPart.length), '0')
    decimalPart = padRight(decimalPart, padSizeDecimal + decimalPart.length)

    result += integerPart + separator + decimalPart
  }

  return result
}

export function defaultStringifyDuration(time: SimpleTime, formatArg: string): Maybe<string> {
  const expression = parseForDateTimeFormat(formatArg)
  if (expression === undefined) {
    return undefined
  }
  const tokens = expression.tokens
  let result = ''

  for (const token of tokens) {
    if (token.type === TokenType.FREE_TEXT) {
      result += token.value
      continue
    }

    switch (token.value.toLowerCase()) {
      case 'h':
      case 'hh': {
        result += padLeft(time.hours, token.value.length)
        time.hours = 0
        break
      }

      case '[hh]': {
        result += padLeft(time.hours, token.value.length - 2)
        time.hours = 0
        break
      }

      case 'm':
      case 'mm': {
        result += padLeft(time.minutes, token.value.length)
        time.minutes = 0
        break
      }

      case '[mm]': {
        result += padLeft(time.minutes + 60 * time.hours, token.value.length - 2)
        time.minutes = 0
        time.hours = 0
        break
      }

      /* seconds */
      case 's':
      case 'ss': {
        result += padLeft(Math.floor(time.seconds), token.value.length)
        break
      }

      default: {
        if (TIME_FORMAT_SECONDS_ITEM_REGEXP.test(token.value)) {
          const fractionOfSecondPrecision = Math.max(token.value.length - 3, 0)
          result += `${time.seconds < 10 ? '0' : ''}${Math.floor(time.seconds * Math.pow(10, fractionOfSecondPrecision)) / Math.pow(10, fractionOfSecondPrecision)}`
          continue
        }
        return undefined
      }
    }
  }
  return result
}

export function defaultStringifyDateTime(dateTime: SimpleDateTime, formatArg: string): Maybe<string> {
  const expression = parseForDateTimeFormat(formatArg)
  if (expression === undefined) {
    return undefined
  }
  const tokens = expression.tokens
  let result = ''
  let minutes: boolean = false

  const ampm = tokens.some((token) => token.type === TokenType.FORMAT &&
    (token.value === 'a/p' || token.value === 'A/P' || token.value === 'am/pm' || token.value === 'AM/PM'))

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === TokenType.FREE_TEXT) {
      result += token.value
      continue
    }

    switch (token.value.toLowerCase()) {
      /* hours*/
      case 'h':
      case 'hh': {
        minutes = true
        result += padLeft(ampm ? (dateTime.hours + 11) % 12 + 1 : dateTime.hours, token.value.length)
        break
      }

      /* days */
      case 'd':
      case 'dd': {
        result += padLeft(dateTime.day, token.value.length)
        break
      }

      /* seconds */
      case 's':
      case 'ss': {
        result += padLeft(Math.floor(dateTime.seconds), token.value.length)
        break
      }

      /* minutes / months */
      case 'm':
      case 'mm': {
        if (i + 1 < tokens.length && tokens[i + 1].value.startsWith(':')) {
          minutes = true
        }
        if (minutes) {
          result += padLeft(dateTime.minutes, token.value.length)
        } else {
          result += padLeft(dateTime.month, token.value.length)
        }
        minutes = true
        break
      }

      /* month names (always a month, never minutes) */
      case 'mmm': {
        result += SHORT_MONTH_NAMES[dateTime.month - 1] ?? ''
        break
      }
      case 'mmmm': {
        result += FULL_MONTH_NAMES[dateTime.month - 1] ?? ''
        break
      }
      case 'mmmmm': {
        result += FULL_MONTH_NAMES[dateTime.month - 1]?.charAt(0) ?? ''
        break
      }

      /* years */
      case 'yy': {
        result += padLeft(dateTime.year % 100, token.value.length)
        break
      }
      case 'yyyy': {
        result += dateTime.year
        break
      }

      /* AM / PM */
      case 'am/pm':
      case 'a/p': {
        const [am, pm] = token.value.split('/')
        result += dateTime.hours < 12 ? am : pm
        break
      }
      default: {
        if (TIME_FORMAT_SECONDS_ITEM_REGEXP.test(token.value)) {
          const fractionOfSecondPrecision = token.value.length - 3
          result += `${dateTime.seconds < 10 ? '0' : ''}${Math.floor(dateTime.seconds * Math.pow(10, fractionOfSecondPrecision)) / Math.pow(10, fractionOfSecondPrecision)}`
          continue
        }
        return undefined
      }
    }
  }

  return result
}
