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

export function format(value: number, formatArg: string, config: Config, dateHelper: DateTimeHelper): RawScalarValue {
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

function countPercentSigns(tokens: FormatToken[]): number {
  return tokens
    .filter((token) => token.type === TokenType.FREE_TEXT)
    .reduce((count, token) => count + countChars(token.value, '%'), 0)
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
  const shifted = Math.round(Number(`${Math.abs(value)}e${decimals}`))
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
      result += token.value
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
