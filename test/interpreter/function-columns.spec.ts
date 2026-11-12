import {ErrorType, HyperFormula} from '../../src'
import {AbsoluteCellRange} from '../../src/AbsoluteCellRange'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function COLUMNS', () => {
  it('accepts exactly one argument', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS()', '=COLUMNS(A1:B1, A2:B2)']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('works for range', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS(A1:C2)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(3)
  })

  it('works for column range', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS(A:C)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(3)
  })

  it('works for row range', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS(1:2)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(engine.getConfig().maxColumns)
  })

  it('works for array', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS({1,2,3})']])

    expect(engine.getCellValue(adr('A1'))).toEqual(3)
  })

  it('works with cell reference', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS(A1)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(1)
  })

  it('error when nested cycle', () => {
    const engine = HyperFormula.buildFromArray([['=COLUMNS(A1+1)']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.CYCLE))
  })

  it('propagates only direct errors', () => {
    const engine = HyperFormula.buildFromArray([
      ['=4/0'],
      ['=COLUMNS(4/0)'],
      ['=COLUMNS(A1)'],
    ])

    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
    expect(engine.getCellValue(adr('A3'))).toEqual(1)
  })

  it('works with formulas', () => {
    const engine = HyperFormula.buildFromArray([
      ['1', '1'],
      ['1', '1'],
      ['=COLUMNS(MMULT(A1:B2, A1:B2))'],
    ])

    expect(engine.getCellValue(adr('A3'))).toEqual(2)
  })

  it('should work when adding column', () => {
    const engine = HyperFormula.buildFromArray([
      ['1', '1'],
      ['=COLUMNS(A1:B1)']
    ])

    engine.addColumns(0, [1, 1])

    expect(engine.getCellValue(adr('A2'))).toEqual(3)
  })

  // Debt schedules amortise a balance over COLUMNS(M$6:$U$6) remaining periods; miscounting it
  // drifts every balance, interest and total that depends on the schedule away from Excel.
  it('counts columns when one endpoint has a relative column and the other an absolute one', () => {
    const engine = HyperFormula.buildFromArray([
      [],
      [null, null, null, null, null, null, null, null, null, null, null, null,
        '=COLUMNS(M$1:$U$1)', '=COLUMNS(N$1:$U$1)', '=COLUMNS($M$1:U1)'],
    ])

    expect(engine.getCellValue(adr('M2'))).toEqual(9)
    expect(engine.getCellValue(adr('N2'))).toEqual(8)
    expect(engine.getCellValue(adr('O2'))).toEqual(9)
  })

  it('counts mixed-anchor columns relative to the cell the formula is copied to', () => {
    const engine = HyperFormula.buildFromArray([
      [],
      [null, '=COLUMNS(B$1:$E$1)'],
    ])

    engine.copy(AbsoluteCellRange.spanFrom(adr('B2'), 1, 1))
    engine.paste(adr('C2'))

    expect(engine.getCellValue(adr('B2'))).toEqual(4)
    expect(engine.getCellValue(adr('C2'))).toEqual(3)
  })
})
