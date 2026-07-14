import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function SINGLE (implicit intersection / @ operator)', () => {
  it('passes a scalar argument through unchanged', () => {
    const engine = HyperFormula.buildFromArray([['=SINGLE(5)', '=SINGLE("txt")', '=SINGLE(TRUE())']])
    expect(engine.getCellValue(adr('A1'))).toEqual(5)
    expect(engine.getCellValue(adr('B1'))).toEqual('txt')
    expect(engine.getCellValue(adr('C1'))).toEqual(true)
  })

  it('passes through the scalar result of a wrapped function (the =_xlfn.SINGLE(AVERAGE(...)) case)', () => {
    const engine = HyperFormula.buildFromArray([[2, 4, 6, '=SINGLE(AVERAGE(A1:C1))']])
    expect(engine.getCellValue(adr('D1'))).toEqual(4)
  })

  it('implicitly intersects a range argument to the cell on the formula row', () => {
    const engine = HyperFormula.buildFromArray([
      [10, '=SINGLE(A1:A3)'],
      [20, '=SINGLE(A1:A3)'],
      [30, '=SINGLE(A1:A3)'],
    ])
    expect(engine.getCellValue(adr('B1'))).toEqual(10)
    expect(engine.getCellValue(adr('B2'))).toEqual(20)
    expect(engine.getCellValue(adr('B3'))).toEqual(30)
  })

  it('column-intersects a horizontal range that shares the formula column', () => {
    const engine = HyperFormula.buildFromArray([[1, 2, 3], [], [], ['=SINGLE(A1:C1)']])
    expect(engine.getCellValue(adr('A4'))).toEqual(1)
  })

  it('returns #VALUE! when a range shares neither row nor column with the formula cell', () => {
    const engine = HyperFormula.buildFromArray([[null, 1, 2, 3], [], [], ['=SINGLE(B1:D1)']])
    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.WrongType))
  })

  it('propagates an error argument', () => {
    const engine = HyperFormula.buildFromArray([['=SINGLE(1/0)']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })
})
