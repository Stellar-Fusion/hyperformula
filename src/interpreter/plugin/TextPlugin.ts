/**
 * @license
 * Copyright (c) 2025 Handsoncode. All rights reserved.
 */

import {CellError, ErrorType} from '../../Cell'
import {ErrorMessage} from '../../error-message'
import {roundHalfAwayFromZero} from '../../format/format'
import {ProcedureAst} from '../../parser'
import {InterpreterState} from '../InterpreterState'
import {InterpreterValue, RawScalarValue} from '../InterpreterValue'
import {FunctionArgumentType, FunctionPlugin, FunctionPluginTypecheck, ImplementedFunctions} from './FunctionPlugin'

/**
 * Interpreter plugin containing text-specific functions
 */
export class TextPlugin extends FunctionPlugin implements FunctionPluginTypecheck<TextPlugin> {
  public static implementedFunctions: ImplementedFunctions = {
    'CONCATENATE': {
      method: 'concatenate',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ],
      repeatLastArgs: 1,
      expandRanges: true,
    },
    'FIXED': {
      method: 'fixed',
      parameters: [
        {argumentType: FunctionArgumentType.NUMBER},
        {argumentType: FunctionArgumentType.NUMBER, defaultValue: 2},
        {argumentType: FunctionArgumentType.BOOLEAN, defaultValue: false},
      ],
    },
    'CONCAT': {
      method: 'concat',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ],
      repeatLastArgs: 1,
      expandRanges: true,
    },
    'TEXTJOIN': {
      method: 'textjoin',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.BOOLEAN},
        {argumentType: FunctionArgumentType.STRING}
      ],
      repeatLastArgs: 1,
      expandRanges: true,
    },
    'EXACT': {
      method: 'exact',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'SPLIT': {
      method: 'split',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER},
      ]
    },
    'LEN': {
      method: 'len',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'LOWER': {
      method: 'lower',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'MID': {
      method: 'mid',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER},
        {argumentType: FunctionArgumentType.NUMBER},
      ]
    },
    'TRIM': {
      method: 'trim',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'T': {
      method: 't',
      parameters: [
        {argumentType: FunctionArgumentType.SCALAR}
      ]
    },
    'PROPER': {
      method: 'proper',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'CLEAN': {
      method: 'clean',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'REPT': {
      method: 'rept',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER},
      ]
    },
    'RIGHT': {
      method: 'right',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER, defaultValue: 1},
      ]
    },
    'LEFT': {
      method: 'left',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER, defaultValue: 1},
      ]
    },
    'REPLACE': {
      method: 'replace',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER},
        {argumentType: FunctionArgumentType.NUMBER},
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'SEARCH': {
      method: 'search',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER, defaultValue: 1},
      ]
    },
    'SUBSTITUTE': {
      method: 'substitute',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER, optionalArg: true}
      ]
    },
    'FIND': {
      method: 'find',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.NUMBER, defaultValue: 1},
      ]
    },
    'UPPER': {
      method: 'upper',
      parameters: [
        {argumentType: FunctionArgumentType.STRING}
      ]
    },
    'VALUE': {
      method: 'value',
      parameters: [
        {argumentType: FunctionArgumentType.NUMBER}
      ]
    },
    'NUMBERVALUE': {
      method: 'numberValue',
      parameters: [
        {argumentType: FunctionArgumentType.STRING},
        {argumentType: FunctionArgumentType.STRING, optionalArg: true},
        {argumentType: FunctionArgumentType.STRING, optionalArg: true},
      ]
    },
  }

  /**
   * Corresponds to CONCATENATE(value1, [value2, ...])
   *
   * Concatenates provided arguments to one string.
   *
   * @param ast
   * @param state
   */
  public concatenate(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('CONCATENATE'), (...args) => {
      return ''.concat(...args)
    })
  }

  public fixed(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('FIXED'), (value: number, decimals: number, noCommas: boolean) => {
      const places = Math.trunc(decimals)
      // Reuse the format engine's decimal-string rounder (round-half-away-from-zero without the
      // multiply-based IEEE noise, e.g. 1.005 -> "1.01"). It leaves extreme magnitudes/precisions
      // unshifted; that's fine here, the double already carries every significant digit.
      let rounded = roundHalfAwayFromZero(value, places)
      if (Number.isNaN(rounded)) {
        rounded = value
      }
      if (!isFinite(rounded)) {
        return new CellError(ErrorType.NUM, ErrorMessage.NaN)
      }
      // toFixed only accepts 0..100 fraction digits and switches to exponent form at 1e21; guard both
      // so a large `decimals` or magnitude can never throw or leak an "e" into the grouped output.
      const decimalPlaces = Math.min(100, Math.max(0, places))
      const magnitude = Math.abs(rounded)
      const body = magnitude < 1e21
        ? magnitude.toFixed(decimalPlaces)
        : magnitude.toLocaleString('en-US', {maximumFractionDigits: 0, useGrouping: false}) +
          (decimalPlaces > 0 ? `.${'0'.repeat(decimalPlaces)}` : '')

      const [integerPart, decimalPart] = body.split('.')
      const decimalSeparator = this.config.decimalSeparator
      // Never let the grouping separator collide with the decimal separator (a comma-decimal locale
      // groups with '.'), and honour an explicit config separator when set.
      const thousandSeparator = noCommas
        ? ''
        : this.config.thousandSeparator !== ''
          ? this.config.thousandSeparator
          : decimalSeparator === ','
            ? '.'
            : ','
      const groupedInteger = thousandSeparator === ''
        ? integerPart
        : integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
      const magnitudeText = decimalPart === undefined ? groupedInteger : `${groupedInteger}${decimalSeparator}${decimalPart}`
      // A value that rounds to zero yields +0/-0, for which `rounded < 0` is already false, so no
      // sign leaks onto "0.00" (Excel: FIXED(-0.001,1) -> "0.0").
      return rounded < 0 ? `-${magnitudeText}` : magnitudeText
    })
  }

  /**
   * Corresponds to CONCAT(value1, [value2, ...]) — the modern replacement for CONCATENATE.
   * Concatenates all arguments (ranges are expanded) into one string.
   */
  public concat(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('CONCAT'), (...args) => {
      return ''.concat(...args)
    })
  }

  /**
   * Corresponds to TEXTJOIN(delimiter, ignore_empty, text1, [text2, ...]).
   * Joins the text arguments with `delimiter`; when `ignore_empty` is true, empty strings are skipped.
   */
  public textjoin(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('TEXTJOIN'), (delimiter: string, ignoreEmpty: boolean, ...args: string[]) => {
      const parts = ignoreEmpty ? args.filter(arg => arg !== '') : args
      return parts.join(delimiter)
    })
  }

  /**
   * Corresponds to SPLIT(string, index)
   *
   * Splits provided string using space separator and returns chunk at zero-based position specified by second argument
   *
   * @param ast
   * @param state
   */
  public split(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('SPLIT'), (stringToSplit: string, indexToUse: number) => {
      const splittedString = stringToSplit.split(' ')

      if (indexToUse >= splittedString.length || indexToUse < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.IndexBounds)
      }

      return splittedString[indexToUse]
    })
  }

  public len(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('LEN'), (arg: string) => {
      return arg.length
    })
  }

  public lower(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('LOWER'), (arg: string) => {
      return arg.toLowerCase()
    })
  }

  public trim(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('TRIM'), (arg: string) => {
      return arg
        .replace(/^ +/g, '')
        .replace(/ +$/g, '')
        .replace(/ +/g, ' ')
    })
  }

  public proper(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('PROPER'), (arg: string) => {
      return arg.replace(/\p{L}+/gu, word => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase())
    })
  }

  public clean(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('CLEAN'), (arg: string) => {
      // eslint-disable-next-line no-control-regex
      return arg.replace(/[\u0000-\u001F]/g, '')
    })
  }

  public exact(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('EXACT'), (left: string, right: string) => {
      return left === right
    })
  }

  public rept(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('REPT'), (text: string, count: number) => {
      if (count < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.NegativeCount)
      }
      return text.repeat(count)
    })
  }

  public right(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('RIGHT'), (text: string, length: number) => {
      if (length < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.NegativeLength)
      } else if (length === 0) {
        return ''
      }
      return text.slice(-length)
    })
  }

  public left(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('LEFT'), (text: string, length: number) => {
      if (length < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.NegativeLength)
      }
      return text.slice(0, length)
    })
  }

  public mid(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('MID'), (text: string, startPosition: number, numberOfChars: number) => {
      if (startPosition < 1) {
        return new CellError(ErrorType.VALUE, ErrorMessage.LessThanOne)
      }
      if (numberOfChars < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.NegativeLength)
      }
      return text.substring(startPosition - 1, startPosition + numberOfChars - 1)
    })
  }

  public replace(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('REPLACE'), (text: string, startPosition: number, numberOfChars: number, newText: string) => {
      if (startPosition < 1) {
        return new CellError(ErrorType.VALUE, ErrorMessage.LessThanOne)
      }
      if (numberOfChars < 0) {
        return new CellError(ErrorType.VALUE, ErrorMessage.NegativeLength)
      }
      return text.substring(0, startPosition - 1) + newText + text.substring(startPosition + numberOfChars - 1)
    })
  }

  public search(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('SEARCH'), (pattern: string, text: string, startIndex: number) => {
      if (startIndex < 1 || startIndex > text.length) {
        return new CellError(ErrorType.VALUE, ErrorMessage.LengthBounds)
      }

      const normalizedPattern = pattern.toLowerCase()
      const normalizedText = text.substring(startIndex - 1).toLowerCase()

      const index = this.arithmeticHelper.requiresRegex(normalizedPattern)
        ? this.arithmeticHelper.searchString(normalizedPattern, normalizedText)
        : normalizedText.indexOf(normalizedPattern)

      return index > -1 ? index + startIndex : new CellError(ErrorType.VALUE, ErrorMessage.PatternNotFound)
    })
  }

  public substitute(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('SUBSTITUTE'), (text: string, searchString: string, replacementString: string, occurrenceNum: number | undefined) => {
      const escapedSearchString = this.escapeRegExpSpecialCharacters(searchString)
      const searchRegExp = new RegExp(escapedSearchString, 'g')

      if (occurrenceNum === undefined) {
        return text.replace(searchRegExp, replacementString)
      }

      if (occurrenceNum < 1) {
        return new CellError(ErrorType.VALUE, ErrorMessage.LessThanOne)
      }

      let match: RegExpExecArray | null
      let i = 0
      while ((match = searchRegExp.exec(text)) !== null) {
        if (occurrenceNum === ++i) {
          return text.substring(0, match.index) + replacementString + text.substring(searchRegExp.lastIndex)
        }
      }

      return text
    })
  }

  public find(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('FIND'), (pattern, text: string, startIndex: number) => {
      if (startIndex < 1 || startIndex > text.length) {
        return new CellError(ErrorType.VALUE, ErrorMessage.IndexBounds)
      }

      const shiftedText = text.substring(startIndex - 1)
      const index = shiftedText.indexOf(pattern) + startIndex

      return index > 0 ? index : new CellError(ErrorType.VALUE, ErrorMessage.PatternNotFound)
    })
  }

  public t(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('T'), (arg: RawScalarValue) => {
      if (arg instanceof CellError) {
        return arg
      }
      return typeof arg === 'string' ? arg : ''
    })
  }

  public upper(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('UPPER'), (arg: string) => {
      return arg.toUpperCase()
    })
  }

  /**
   * Corresponds to VALUE(text)
   *
   * Converts a text string that represents a number to a number. The NUMBER argument type performs the
   * text-to-number coercion (and yields #VALUE! for non-numeric text), so this returns the coerced value.
   *
   * @param ast
   * @param state
   */
  public value(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(ast.args, state, this.metadata('VALUE'), (value: number) => value)
  }

  public numberValue(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('NUMBERVALUE'),
      (text: string, decimalSeparatorArg?: string, groupSeparatorArg?: string) => {
        const decimalSeparator = (decimalSeparatorArg ?? this.config.decimalSeparator).charAt(0) || '.'
        const groupSeparator = (groupSeparatorArg ?? this.config.thousandSeparator).charAt(0)
        if (groupSeparator !== '' && groupSeparator === decimalSeparator) {
          return new CellError(ErrorType.VALUE, ErrorMessage.NumberCoercion)
        }
        // Excel NUMBERVALUE ignores all whitespace, strips group separators, normalises the decimal
        // separator to '.', and divides by 100 for each trailing '%'. An empty string is 0.
        let normalized = text.replace(/\s+/g, '')
        if (normalized === '') {
          return 0
        }
        let percentDivisor = 1
        while (normalized.endsWith('%')) {
          percentDivisor *= 100
          normalized = normalized.slice(0, -1)
        }
        if (groupSeparator !== '') {
          normalized = normalized.split(groupSeparator).join('')
        }
        if (decimalSeparator !== '.') {
          if (normalized.includes('.')) {
            return new CellError(ErrorType.VALUE, ErrorMessage.NumberCoercion)
          }
          normalized = normalized.split(decimalSeparator).join('.')
        }
        // At most one decimal point, then a plain (optionally signed/exponent) number.
        if ((normalized.match(/\./g) ?? []).length > 1 || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
          return new CellError(ErrorType.VALUE, ErrorMessage.NumberCoercion)
        }
        return Number(normalized) / percentDivisor
      },
    )
  }

  private escapeRegExpSpecialCharacters(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
