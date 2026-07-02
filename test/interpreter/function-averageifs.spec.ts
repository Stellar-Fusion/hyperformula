import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function AVERAGEIFS', () => {
  it('averages the values whose single criterion matches', () => {
    const engine = HyperFormula.buildFromArray([
      ['=AVERAGEIFS(C1:C4, B1:B4, ">0")', 1, 10],
      [null, 2, 20],
      [null, -1, 30],
      [null, 3, 40],
    ])

    // C where B>0 -> (10+20+40)/3
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(70 / 3, 6)
  })

  it('averages only the values matching all criteria (multi-criteria)', () => {
    const engine = HyperFormula.buildFromArray([
      ['=AVERAGEIFS(D1:D4, B1:B4, ">0", C1:C4, "x")', 1, 'x', 10],
      [null, 2, 'y', 20],
      [null, 3, 'x', 40],
      [null, -5, 'x', 80],
    ])

    // D where B>0 AND C="x" -> rows 1 & 3 -> (10+40)/2
    expect(engine.getCellValue(adr('A1'))).toBe(25)
  })

  it('returns #DIV/0! when no cell matches', () => {
    const engine = HyperFormula.buildFromArray([
      ['=AVERAGEIFS(C1:C2, B1:B2, ">100")', 1, 10],
      [null, 2, 20],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })

  it('requires an odd number of arguments (avg range + criteria pairs)', () => {
    const engine = HyperFormula.buildFromArray([
      ['=AVERAGEIFS(C1:C2)'],
      ['=AVERAGEIFS(C1:C2, B1:B2)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('errors when the average range and a criteria range differ in size', () => {
    const engine = HyperFormula.buildFromArray([
      ['=AVERAGEIFS(C1:C3, B1:B2, ">0")', 1, 10],
      [null, 2, 20],
      [null, 3, 30],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.EqualLength))
  })
})
