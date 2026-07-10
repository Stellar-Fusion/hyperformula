import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function XNPV', () => {
  it('should return #NA! error with the wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1,1)', '=XNPV(1, 1, 1, 1)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  /**
   * Product #2 implements only Rate>0 (even though states in the documentation that Rate>-1).
   */
  it('should accept Rate values that are greater than -1.', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(-1, A2:D2, A3:D3)', '=XNPV(2, A2:D2, A3:D3)', '=XNPV(-0.9, A2:D2, A3:D3)'],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.ValueSmall))
    expect(engine.getCellValue(adr('B1'))).toBeCloseTo(9.94002794561453, 6)
    expect(engine.getCellValue(adr('C1'))).toBeCloseTo(10.1271695921145, 6)
  })

  it('should calculate the correct value', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(2%, 1, 1)'],
      ['=XNPV(1, B2:C2, D2:E2)', 1, 2, 3, 4],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(1)
    expect(engine.getCellValue(adr('A2'))).toBeCloseTo(2.99620553730319, 6)
  })

  it('unwraps ExtendedNumber (DATE-formatted) DATE cells, matching raw serials', () => {
    // Date cells (=DATE(...)) are ExtendedNumber objects, not primitive numbers. XNPV must unwrap them like
    // Excel — a real model's dates row is date-formatted. B1 (raw serials) is the oracle; A1 (DATE-formatted
    // dates) must equal it instead of erroring #VALUE!.
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(0.1, A2:B2, A3:B3)', '=XNPV(0.1, A2:B2, A4:B4)'],
      [100, 200],
      ['=DATE(2020,1,1)', '=DATE(2021,1,1)'],
      [43831, 44197],
    ])

    const b1 = engine.getCellValue(adr('B1'))
    expect(typeof b1).toBe('number')
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(b1 as number, 6)
  })

  it('unwraps ExtendedNumber VALUE cells (percent-formatted), matching plain numbers', () => {
    // Exercises the values-side unwrap specifically: A2:B2 = 100%/200% are ExtendedNumber wrapping 1/2.
    // A1 (formatted values) must equal B1 (plain 1/2) instead of erroring #VALUE!.
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(0.1, A2:B2, A4:B4)', '=XNPV(0.1, A3:B3, A4:B4)'],
      ['=100%', '=200%'],
      [1, 2],
      [43831, 44197],
    ])

    const b1 = engine.getCellValue(adr('B1'))
    expect(typeof b1).toBe('number')
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(b1 as number, 6)
  })

  it('propagates a real input error (#DIV/0!) instead of masking it as #VALUE!', () => {
    // A value cell that is itself an error must surface that error's own type, matching Excel — not a
    // generic NumberExpected #VALUE!.
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(0.1, A2:B2, A3:B3)'],
      ['=1/0', 200],
      [43831, 44197],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })

  it('should round dates', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:C1, D1:E1)', 1, 2, 3.1, 4],
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2.99620553730319, 6)
  })

  it('only first date needs to be earliest', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:E1, F1:I1)', 1, 2, 3, 4, 1, 4, 3, 2],
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(9.9696766801485, 6)
  })

  it('should evaluate to #NUM! if values in range are not numbers', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:C1, D1:E1)', 1, null, 3, null],
      ['=XNPV(1, B2:C2, D2:E2)', 1, 2, 3.1, true],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberExpected))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberExpected))
  })

  /**
   * Product #1 tries to match the values in ranges.
   */
  it('should evaluate to #NUM! if ranges are of different length', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:C1, D1:F1)', 1, 2, 3, 4, 5],
      ['=XNPV(1, B2:D2, E2:F2)', 1, 2, 3, 4, 5],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.EqualLength))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.EqualLength))
  })

  it('should evaluate to #NUM! if dates are in wrong order', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:C1, D1:E1)', 1, 2, 4, 3],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.ValueSmall))
  })

  it('should evaluate to #NUM! if dates are too small', () => {
    const engine = HyperFormula.buildFromArray([
      ['=XNPV(1, B1:C1, D1:E1)', 1, 2, -1, 4],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.ValueSmall))
  })
})
