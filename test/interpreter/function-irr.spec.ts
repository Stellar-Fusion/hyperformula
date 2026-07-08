import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function IRR', () => {
  it('should return #NA! with the wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([['=IRR()']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it("computes the internal rate of return (Microsoft's documented example)", () => {
    const engine = HyperFormula.buildFromArray([
      [-70000], [12000], [15000], [18000], [21000], [26000], ['=IRR(A1:A6)'],
    ])
    expect(engine.getCellValue(adr('A7')) as number).toBeCloseTo(0.086631, 5)
  })

  it('converges from an explicit guess to the same rate', () => {
    const engine = HyperFormula.buildFromArray([
      [-70000], [12000], [15000], [18000], [21000], [26000], ['=IRR(A1:A6,-0.1)'],
    ])
    expect(engine.getCellValue(adr('A7')) as number).toBeCloseTo(0.086631, 5)
  })

  it('handles a simple two-flow investment', () => {
    const engine = HyperFormula.buildFromArray([[-100], [110], ['=IRR(A1:A2)']])
    expect(engine.getCellValue(adr('A3')) as number).toBeCloseTo(0.1, 6)
  })

  it('returns #NUM! when all cash flows have the same sign (no root)', () => {
    const engine = HyperFormula.buildFromArray([[100], [200], [300], ['=IRR(A1:A3)']])
    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NoConvergence))
  })

  it('ignores text and blank cells in the range', () => {
    const engine = HyperFormula.buildFromArray([
      [-100], ['text'], [60], [null], [60], ['=IRR(A1:A5)'],
    ])
    expect(engine.getCellValue(adr('A6')) as number).toBeCloseTo(0.13066, 4)
  })

  it('returns #NUM! for a range with only one numeric flow', () => {
    const engine = HyperFormula.buildFromArray([[-100], ['=IRR(A1:A1)']])
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NoConvergence))
  })

  it('returns #NUM! for a degenerate series whose Newton step converges to a non-root / out-of-domain rate', () => {
    const engine = HyperFormula.buildFromArray([[1], [-1e-12], ['=IRR(A1:A2)']])
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NoConvergence))
  })
})
