import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('function XMATCH', () => {
  it('validate arguments', () => {
    const engine = HyperFormula.buildFromArray([['=XMATCH(1)']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('exact match returns the 1-based position in a vertical range', () => {
    const engine = HyperFormula.buildFromArray([
      ['apple', '=XMATCH("cherry", A1:A3)'],
      ['banana'],
      ['cherry'],
    ])

    expect(engine.getCellValue(adr('B1'))).toEqual(3)
  })

  it('exact match returns the 1-based position in a horizontal range', () => {
    const engine = HyperFormula.buildFromArray([
      ['apple', 'banana', 'cherry', '=XMATCH("banana", A1:C1)'],
    ])

    expect(engine.getCellValue(adr('D1'))).toEqual(2)
  })

  it('returns NA when the value is not found (default exact mode)', () => {
    const engine = HyperFormula.buildFromArray([
      ['apple', '=XMATCH("kiwi", A1:A2)'],
      ['banana'],
    ])

    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.ValueNotFound))
  })

  it('search_mode -1 returns the last occurrence', () => {
    const engine = HyperFormula.buildFromArray([
      ['x', '=XMATCH("x", A1:A3, 0, -1)'],
      ['x'],
      ['x'],
    ])

    expect(engine.getCellValue(adr('B1'))).toEqual(3)
  })

  it('supports wildcard match mode (2)', () => {
    const engine = HyperFormula.buildFromArray([
      ['apple', '=XMATCH("ban*", A1:A3, 2)'],
      ['banana'],
      ['cherry'],
    ])

    expect(engine.getCellValue(adr('B1'))).toEqual(2)
  })

  it('rejects an invalid match_mode', () => {
    const engine = HyperFormula.buildFromArray([['=XMATCH(1, A2:A3, 5)'], [1], [2]])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.BadMode))
  })

  it('returns NA for a 2-D range', () => {
    const engine = HyperFormula.buildFromArray([
      ['a', 'b', '=XMATCH("a", A1:B2)'],
      ['c', 'd'],
    ])

    expect(engine.getCellValue(adr('C1'))).toEqualError(detailedError(ErrorType.NA))
  })
})
