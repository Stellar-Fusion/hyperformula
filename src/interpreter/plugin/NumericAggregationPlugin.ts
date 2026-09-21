/**
 * @license
 * Copyright (c) 2025 Handsoncode. All rights reserved.
 */

import {AbsoluteCellRange} from '../../AbsoluteCellRange'
import {CellError, ErrorType, SimpleCellAddress} from '../../Cell'
import {ErrorMessage} from '../../error-message'
import {SheetsNotEqual} from '../../errors'
import {Maybe} from '../../Maybe'
import {Ast, AstNodeType, CellRangeAst, ProcedureAst} from '../../parser'
import {ColumnRangeAst, RowRangeAst} from '../../parser/Ast'
import {coerceBooleanToNumber} from '../ArithmeticHelper'
import {InterpreterState} from '../InterpreterState'
import {EmptyValue, ExtendedNumber, getRawValue, InternalScalarValue, isExtendedNumber} from '../InterpreterValue'
import {SimpleRangeValue} from '../../SimpleRangeValue'
import {FunctionArgumentType, FunctionPlugin, FunctionPluginTypecheck, ImplementedFunctions} from './FunctionPlugin'
import {ArrayVertex, FormulaCellVertex, RangeVertex} from '../../DependencyGraph'

export type BinaryOperation<T> = (left: T, right: T) => T

export type MapOperation<T> = (arg: ExtendedNumber) => T

type coercionOperation = (arg: InternalScalarValue) => Maybe<ExtendedNumber | CellError>

function zeroForInfinite(value: InternalScalarValue) {
  if (isExtendedNumber(value) && !Number.isFinite(getRawValue(value))) {
    return 0
  } else {
    return value
  }
}

/**
 * Functions whose cells Excel skips when they sit inside a SUBTOTAL's references.
 */
const NESTED_SUBTOTAL_FUNCTIONS = new Set(['SUBTOTAL', 'AGGREGATE'])

/**
 * Prefix for the range cache of a SUBTOTAL-style reduction. It skips cells a plain reduction counts, so
 * the two must never share a cached value for the same range.
 */
const NESTED_SUBTOTALS_IGNORED_CACHE_PREFIX = 'SUBTOTAL_'

const containsSubtotalCache = new WeakMap<Ast, boolean>()

/**
 * Whether a formula calls SUBTOTAL or AGGREGATE anywhere in it. Excel, LibreOffice and the ODFF standard
 * treat any such cell as a subtotal, not only one whose whole formula is the call.
 */
function containsSubtotal(ast: Ast): boolean {
  const cached = containsSubtotalCache.get(ast)
  if (cached !== undefined) {
    return cached
  }

  let result = false
  switch (ast.type) {
    case AstNodeType.FUNCTION_CALL:
      result = NESTED_SUBTOTAL_FUNCTIONS.has(ast.procedureName) || ast.args.some(containsSubtotal)
      break
    case AstNodeType.ARRAY:
      result = ast.args.some(row => row.some(containsSubtotal))
      break
    case AstNodeType.PARENTHESIS:
      result = containsSubtotal(ast.expression)
      break
    case AstNodeType.MINUS_UNARY_OP:
    case AstNodeType.PLUS_UNARY_OP:
    case AstNodeType.PERCENT_OP:
      result = containsSubtotal(ast.value)
      break
    case AstNodeType.CONCATENATE_OP:
    case AstNodeType.EQUALS_OP:
    case AstNodeType.NOT_EQUAL_OP:
    case AstNodeType.GREATER_THAN_OP:
    case AstNodeType.LESS_THAN_OP:
    case AstNodeType.GREATER_THAN_OR_EQUAL_OP:
    case AstNodeType.LESS_THAN_OR_EQUAL_OP:
    case AstNodeType.PLUS_OP:
    case AstNodeType.MINUS_OP:
    case AstNodeType.TIMES_OP:
    case AstNodeType.DIV_OP:
    case AstNodeType.POWER_OP:
      result = containsSubtotal(ast.left) || containsSubtotal(ast.right)
      break
  }

  containsSubtotalCache.set(ast, result)
  return result
}

class MomentsAggregate {

  public static empty = new MomentsAggregate(0, 0, 0)

  constructor(
    public readonly sumsq: number,
    public readonly sum: number,
    public readonly count: number,
  ) {
  }

  public static single(arg: number): MomentsAggregate {
    return new MomentsAggregate(arg * arg, arg, 1)
  }

  public compose(other: MomentsAggregate) {
    return new MomentsAggregate(this.sumsq + other.sumsq, this.sum + other.sum, this.count + other.count)
  }

  public averageValue(): Maybe<number> {
    if (this.count > 0) {
      return this.sum / this.count
    } else {
      return undefined
    }
  }

  public varSValue(): Maybe<number> {
    if (this.count > 1) {
      return (this.sumsq - (this.sum * this.sum) / this.count) / (this.count - 1)
    } else {
      return undefined
    }
  }

  public varPValue(): Maybe<number> {
    if (this.count > 0) {
      return (this.sumsq - (this.sum * this.sum) / this.count) / this.count
    } else {
      return undefined
    }
  }
}

export class NumericAggregationPlugin extends FunctionPlugin implements FunctionPluginTypecheck<NumericAggregationPlugin> {
  public static implementedFunctions: ImplementedFunctions = {
    'SUM': {
      method: 'sum',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'SUMSQ': {
      method: 'sumsq',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'MAX': {
      method: 'max',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'MIN': {
      method: 'min',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'MAXA': {
      method: 'maxa',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'MINA': {
      method: 'mina',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'COUNT': {
      method: 'count',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'COUNTA': {
      method: 'counta',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'AVERAGE': {
      method: 'average',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'AVERAGEA': {
      method: 'averagea',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'PRODUCT': {
      method: 'product',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'VAR.S': {
      method: 'vars',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'VAR.P': {
      method: 'varp',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'VARA': {
      method: 'vara',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'VARPA': {
      method: 'varpa',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'STDEV.S': {
      method: 'stdevs',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'STDEV.P': {
      method: 'stdevp',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'STDEVA': {
      method: 'stdeva',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'STDEVPA': {
      method: 'stdevpa',
      parameters: [
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    },
    'SUBTOTAL': {
      method: 'subtotal',
      parameters: [
        {argumentType: FunctionArgumentType.NUMBER},
        {argumentType: FunctionArgumentType.ANY}
      ],
      repeatLastArgs: 1,
    }
  }

  public static aliases = {
    VAR: 'VAR.S',
    VARP: 'VAR.P',
    STDEV: 'STDEV.S',
    STDEVP: 'STDEV.P',
    VARS: 'VAR.S',
    STDEVS: 'STDEV.S',
  }

  /**
   * Corresponds to SUM(Number1, Number2, ...).
   *
   * Returns a sum of given numbers.
   *
   * @param ast
   * @param state
   */
  public sum(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doSum(ast.args, state)
  }

  public sumsq(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.reduce(ast.args, state, 0, 'SUMSQ', this.addWithEpsilonRaw, (arg: ExtendedNumber) => Math.pow(getRawValue(arg), 2), strictlyNumbers)
  }

  /**
   * Corresponds to MAX(Number1, Number2, ...).
   *
   * Returns a max of given numbers.
   *
   * @param ast
   * @param state
   */
  public max(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doMax(ast.args, state)
  }

  public maxa(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const value = this.reduce(ast.args, state, Number.NEGATIVE_INFINITY, 'MAXA',
      (left: number, right: number) => Math.max(left, right),
      getRawValue, numbersBooleans)

    return zeroForInfinite(value)
  }

  /**
   * Corresponds to MIN(Number1, Number2, ...).
   *
   * Returns a min of given numbers.
   *
   * @param ast
   * @param state
   */
  public min(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doMin(ast.args, state)
  }

  public mina(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const value = this.reduce(ast.args, state, Number.POSITIVE_INFINITY, 'MINA',
      (left: number, right: number) => Math.min(left, right),
      getRawValue, numbersBooleans)

    return zeroForInfinite(value)
  }

  public count(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doCount(ast.args, state)
  }

  public counta(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doCounta(ast.args, state)
  }

  public average(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doAverage(ast.args, state)
  }

  public averagea(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const result = this.reduce<MomentsAggregate>(ast.args, state, MomentsAggregate.empty, '_AGGREGATE_A',
      (left, right) => left.compose(right),
      (arg): MomentsAggregate => MomentsAggregate.single(getRawValue(arg)),
      numbersBooleans
    )

    if (result instanceof CellError) {
      return result
    } else {
      return result.averageValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  public vars(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doVarS(ast.args, state)
  }

  public varp(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doVarP(ast.args, state)
  }

  public vara(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const result = this.reduceAggregateA(ast.args, state)

    if (result instanceof CellError) {
      return result
    } else {
      return result.varSValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  public varpa(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const result = this.reduceAggregateA(ast.args, state)

    if (result instanceof CellError) {
      return result
    } else {
      return result.varPValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  public stdevs(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doStdevS(ast.args, state)
  }

  public stdevp(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doStdevP(ast.args, state)
  }

  public stdeva(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const result = this.reduceAggregateA(ast.args, state)

    if (result instanceof CellError) {
      return result
    } else {
      const val = result.varSValue()
      return val === undefined ? new CellError(ErrorType.DIV_BY_ZERO) : Math.sqrt(val)
    }
  }

  public stdevpa(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    const result = this.reduceAggregateA(ast.args, state)

    if (result instanceof CellError) {
      return result
    } else {
      const val = result.varPValue()
      return val === undefined ? new CellError(ErrorType.DIV_BY_ZERO) : Math.sqrt(val)
    }
  }

  public product(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    return this.doProduct(ast.args, state)
  }

  /**
   * Corresponds to SUBTOTAL(function_num, ref1, [ref2], ...)
   *
   * Cells that themselves contain SUBTOTAL or AGGREGATE are skipped, so a grand total over a column that
   * already holds section subtotals does not count them twice. Codes 101-111 behave like 1-11: the engine
   * has no notion of hidden rows.
   */
  public subtotal(ast: ProcedureAst, state: InterpreterState): InternalScalarValue {
    if (ast.args.length < 2) {
      return new CellError(ErrorType.NA, ErrorMessage.WrongArgNumber)
    }
    const functionType = this.coerceToType(this.evaluateAst(ast.args[0], state), {argumentType: FunctionArgumentType.NUMBER}, state)
    const args = ast.args.slice(1)
    switch (functionType) {
      case 1:
      case 101:
        return this.doAverage(args, state, true)
      case 2:
      case 102:
        return this.doCount(args, state, true)
      case 3:
      case 103:
        return this.doCounta(args, state, true)
      case 4:
      case 104:
        return this.doMax(args, state, true)
      case 5:
      case 105:
        return this.doMin(args, state, true)
      case 6:
      case 106:
        return this.doProduct(args, state, true)
      case 7:
      case 107:
        return this.doStdevS(args, state, true)
      case 8:
      case 108:
        return this.doStdevP(args, state, true)
      case 9:
      case 109:
        return this.doSum(args, state, true)
      case 10:
      case 110:
        return this.doVarS(args, state, true)
      case 11:
      case 111:
        return this.doVarP(args, state, true)
      default:
        return new CellError(ErrorType.VALUE, ErrorMessage.BadMode)
    }
  }

  private reduceAggregate(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): MomentsAggregate | CellError {
    return this.reduce<MomentsAggregate>(args, state, MomentsAggregate.empty, '_AGGREGATE', (left, right) => {
        return left.compose(right)
      }, (arg): MomentsAggregate => {
        return MomentsAggregate.single(getRawValue(arg))
      },
      strictlyNumbers,
      ignoreNestedSubtotals
    )
  }

  private reduceAggregateA(args: Ast[], state: InterpreterState): MomentsAggregate | CellError {
    return this.reduce<MomentsAggregate>(args, state, MomentsAggregate.empty, '_AGGREGATE_A', (left, right) => {
        return left.compose(right)
      }, (arg): MomentsAggregate => {
        return MomentsAggregate.single(getRawValue(arg))
      },
      numbersBooleans
    )
  }

  private doAverage(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const result = this.reduceAggregate(args, state, ignoreNestedSubtotals)

    if (result instanceof CellError) {
      return result
    } else {
      return result.averageValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  private doVarS(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const result = this.reduceAggregate(args, state, ignoreNestedSubtotals)

    if (result instanceof CellError) {
      return result
    } else {
      return result.varSValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  private doVarP(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const result = this.reduceAggregate(args, state, ignoreNestedSubtotals)

    if (result instanceof CellError) {
      return result
    } else {
      return result.varPValue() ?? new CellError(ErrorType.DIV_BY_ZERO)
    }
  }

  private doStdevS(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const result = this.reduceAggregate(args, state, ignoreNestedSubtotals)

    if (result instanceof CellError) {
      return result
    } else {
      const val = result.varSValue()
      return val === undefined ? new CellError(ErrorType.DIV_BY_ZERO) : Math.sqrt(val)
    }
  }

  private doStdevP(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const result = this.reduceAggregate(args, state, ignoreNestedSubtotals)

    if (result instanceof CellError) {
      return result
    } else {
      const val = result.varPValue()
      return val === undefined ? new CellError(ErrorType.DIV_BY_ZERO) : Math.sqrt(val)
    }
  }

  private doCount(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    return this.reduce(args, state, 0, 'COUNT',
      (left: number, right: number) => left + right,
      getRawValue,
      (arg) => (isExtendedNumber(arg)) ? 1 : 0,
      ignoreNestedSubtotals
    )
  }

  private doCounta(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    return this.reduce(args, state, 0, 'COUNTA', (left: number, right: number) => left + right,
      getRawValue,
      (arg) => (arg === EmptyValue) ? 0 : 1,
      ignoreNestedSubtotals
    )
  }

  private doMax(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const value = this.reduce(args, state, Number.NEGATIVE_INFINITY, 'MAX',
      (left: number, right: number) => Math.max(left, right),
      getRawValue, strictlyNumbers, ignoreNestedSubtotals
    )

    return zeroForInfinite(value)
  }

  private doMin(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    const value = this.reduce(args, state, Number.POSITIVE_INFINITY, 'MIN',
      (left: number, right: number) => Math.min(left, right),
      getRawValue, strictlyNumbers, ignoreNestedSubtotals
    )

    return zeroForInfinite(value)
  }

  private doSum(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    return this.reduce(args, state, 0, 'SUM', this.addWithEpsilonRaw, getRawValue, strictlyNumbers, ignoreNestedSubtotals)
  }

  private doProduct(args: Ast[], state: InterpreterState, ignoreNestedSubtotals: boolean = false): InternalScalarValue {
    return this.reduce(args, state, 1, 'PRODUCT', (left, right) => left * right, getRawValue, strictlyNumbers, ignoreNestedSubtotals)
  }

  private addWithEpsilonRaw = (left: number, right: number) => this.arithmeticHelper.addWithEpsilonRaw(left, right)

  /**
   * Reduces procedure arguments with given reducing function
   *
   * @param args
   * @param state
   * @param initialAccValue - "neutral" value (equivalent of 0)
   * @param functionName - function name to use as cache key
   * @param reducingFunction - reducing function
   * @param mapFunction
   * @param coercionFunction
   * @param ignoreNestedSubtotals - skip referenced cells that contain SUBTOTAL or AGGREGATE
   */
  private reduce<T>(args: Ast[], state: InterpreterState, initialAccValue: T, functionName: string, reducingFunction: BinaryOperation<T>, mapFunction: MapOperation<T>, coercionFunction: coercionOperation, ignoreNestedSubtotals: boolean = false): CellError | T {
    if (args.length < 1) {
      return new CellError(ErrorType.NA, ErrorMessage.WrongArgNumber)
    }
    return args.reduce((acc: T | CellError, arg) => {
      if (acc instanceof CellError) {
        return acc
      }

      if (arg.type === AstNodeType.CELL_RANGE || arg.type === AstNodeType.COLUMN_RANGE || arg.type === AstNodeType.ROW_RANGE) {
        const val = this.evaluateRange(arg, state, initialAccValue, functionName, reducingFunction, mapFunction, coercionFunction, ignoreNestedSubtotals)
        if (val instanceof CellError) {
          return val
        }
        return reducingFunction(val, acc)
      }

      if (ignoreNestedSubtotals && arg.type === AstNodeType.CELL_REFERENCE && this.isSubtotalCell(arg.reference.toSimpleCellAddress(state.formulaAddress))) {
        return acc
      }

      let value
      value = this.evaluateAst(arg, state)
      if (value instanceof SimpleRangeValue) {
        const coercedRangeValues = Array.from(value.valuesFromTopLeftCorner())
          .map(coercionFunction)
          .filter((arg) => (arg !== undefined)) as (CellError | number)[]

        return coercedRangeValues
          .map((arg) => {
            if (arg instanceof CellError) {
              return arg
            } else {
              return mapFunction(arg)
            }
          })
          .reduce((left, right) => {
            if (left instanceof CellError) {
              return left
            } else if (right instanceof CellError) {
              return right
            } else {
              return reducingFunction(left, right)
            }
          }, acc)
      } else if (arg.type === AstNodeType.CELL_REFERENCE) {
        value = coercionFunction(value)
        if (value === undefined) {
          return acc
        }
      } else {
        value = this.coerceScalarToNumberOrError(value)
        value = coercionFunction(value)
        if (value === undefined) {
          return acc
        }
      }

      if (value instanceof CellError) {
        return value
      }

      return reducingFunction(acc, mapFunction(value))
    }, initialAccValue)
  }

  /**
   * Performs range operation on given range
   *
   * @param ast - cell range ast
   * @param state
   * @param initialAccValue - initial accumulator value for reducing function
   * @param functionName - function name to use as cache key
   * @param reducingFunction - reducing function
   * @param mapFunction
   * @param coercionFunction
   * @param ignoreNestedSubtotals - skip cells that contain SUBTOTAL or AGGREGATE
   */
  private evaluateRange<T>(ast: CellRangeAst | ColumnRangeAst | RowRangeAst, state: InterpreterState, initialAccValue: T, functionName: string, reducingFunction: BinaryOperation<T>, mapFunction: MapOperation<T>, coercionFunction: coercionOperation, ignoreNestedSubtotals: boolean = false): T | CellError {
    let range
    try {
      range = AbsoluteCellRange.fromAst(ast, state.formulaAddress)
    } catch (err) {
      if (err instanceof SheetsNotEqual) {
        return new CellError(ErrorType.REF, ErrorMessage.RangeManySheets)
      } else {
        throw err
      }
    }

    const rangeVertex = this.dependencyGraph.getRange(range.start, range.end)

    if (rangeVertex === undefined) {
      throw new Error('Range does not exists in graph')
    }

    const cacheKey = ignoreNestedSubtotals ? NESTED_SUBTOTALS_IGNORED_CACHE_PREFIX + functionName : functionName
    let value = rangeVertex.getFunctionValue(cacheKey) as (T | CellError | undefined)
    if (value === undefined) {
      const rangeValues = this.getRangeValues(cacheKey, range, rangeVertex, mapFunction, coercionFunction, ignoreNestedSubtotals)
      value = rangeValues.reduce((arg1, arg2) => {
        if (arg1 instanceof CellError) {
          return arg1
        } else if (arg2 instanceof CellError) {
          return arg2
        } else {
          return reducingFunction(arg1, arg2)
        }
      }, initialAccValue)
      rangeVertex.setFunctionValue(cacheKey, value)
    }

    return value
  }

  /**
   * Returns list of values for given range and function name
   *
   * If range is dependent on smaller range, list will contain value of smaller range for this function
   * and values of cells that are not present in smaller range
   *
   * @param functionName - function name (e.g., SUM)
   * @param range - cell range
   * @param rangeVertex
   * @param mapFunction
   * @param coercionFunction
   * @param ignoreNestedSubtotals - skip cells that contain SUBTOTAL or AGGREGATE
   */
  private getRangeValues<T>(functionName: string, range: AbsoluteCellRange, rangeVertex: RangeVertex, mapFunction: MapOperation<T>, coercionFunction: coercionOperation, ignoreNestedSubtotals: boolean = false): (T | CellError)[] {
    const rangeResult: (T | CellError)[] = []
    const {smallerRangeVertex, restRange} = this.dependencyGraph.rangeMapping.findSmallerRange(range)
    let actualRange: AbsoluteCellRange
    if (smallerRangeVertex !== undefined && this.dependencyGraph.existsEdge(smallerRangeVertex, rangeVertex)) {
      const cachedValue: Maybe<T> = smallerRangeVertex.getFunctionValue(functionName)
      if (cachedValue !== undefined) {
        rangeResult.push(cachedValue)
      } else {
        for (const cellFromRange of smallerRangeVertex.range.addresses(this.dependencyGraph)) {
          if (ignoreNestedSubtotals && this.isSubtotalCell(cellFromRange)) {
            continue
          }
          const val = coercionFunction(this.dependencyGraph.getScalarValue(cellFromRange))
          if (val instanceof CellError) {
            rangeResult.push(val)
          } else if (val !== undefined) {
            rangeResult.push(mapFunction(val))
          }
        }
      }
      actualRange = restRange
    } else {
      actualRange = range
    }
    for (const cellFromRange of actualRange.addresses(this.dependencyGraph)) {
      if (ignoreNestedSubtotals && this.isSubtotalCell(cellFromRange)) {
        continue
      }
      const val = coercionFunction(this.dependencyGraph.getScalarValue(cellFromRange))
      if (val instanceof CellError) {
        rangeResult.push(val)
      } else if (val !== undefined) {
        rangeResult.push(mapFunction(val))
      }
    }

    return rangeResult
  }

  /**
   * Whether the cell at the given address holds a formula that calls SUBTOTAL or AGGREGATE.
   *
   * @param address - cell address
   */
  private isSubtotalCell(address: SimpleCellAddress): boolean {
    const vertex = this.dependencyGraph.getCell(address)
    if (!(vertex instanceof FormulaCellVertex) && !(vertex instanceof ArrayVertex)) {
      return false
    }

    return containsSubtotal(vertex.getFormula(this.dependencyGraph.lazilyTransformingAstService))
  }
}

function strictlyNumbers(arg: InternalScalarValue): Maybe<CellError | ExtendedNumber> {
  if (isExtendedNumber(arg) || arg instanceof CellError) {
    return arg
  } else {
    return undefined
  }
}

function numbersBooleans(arg: InternalScalarValue): Maybe<CellError | ExtendedNumber> {
  if (typeof arg === 'boolean') {
    return coerceBooleanToNumber(arg)
  } else if (isExtendedNumber(arg) || arg instanceof CellError) {
    return arg
  } else if (typeof arg === 'string') {
    return 0
  } else {
    return undefined
  }
}
