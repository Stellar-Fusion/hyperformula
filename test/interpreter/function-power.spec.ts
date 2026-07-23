import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function POWER', () => {
  it('should not work for wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(101)'],
      ['=POWER(1, 2, 3)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('should not work for arguments of wrong type', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(1, "foo")'],
      ['=POWER("bar", 4)'],
      ['=POWER("foo", "baz")'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })

  it('should return #NUM! for 0^0 (Excel returns #NUM!, not 1)', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(0, 0)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
  })

  it('returns the real odd root of a negative base; even/non-unit roots #NUM! (Excel parity)', () => {
    // POWER shares realPow with the ^ operator: (-8)^(1/3) = -2, but (-8)^(2/3) and (-8)^(1/2) are #NUM!.
    const engine = HyperFormula.buildFromArray([
      ['=POWER(-8, 1/3)', '=POWER(-8, 2/3)', '=POWER(-8, 1/2)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(-2, 6)
    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
    expect(engine.getCellValue(adr('C1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
  })

  it('should return error for 0^N where N<0', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(0, -2)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
  })

  it('should return error when result too large or too small', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(2, 1023)'],
      ['=POWER(2, 1024)'],
      ['=POWER(-2, 1023)'],
      ['=POWER(-2, 1024)'],
    ], {smartRounding: false})

    expect(engine.getCellValue(adr('A1'))).toEqual(8.98846567431158e+307)
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
    expect(engine.getCellValue(adr('A3'))).toEqual(-8.98846567431158e+307)
    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.NUM, ErrorMessage.NaN))
  })

  it('should work', () => {
    const engine = HyperFormula.buildFromArray([
      ['=POWER(0, 1)'],
      ['=POWER(2, 0)'],
      ['=POWER(2.4, 2.5)'],
      ['=POWER(3, -2.5)'],
    ], {smartRounding: false})

    expect(engine.getCellValue(adr('A1'))).toEqual(0)
    expect(engine.getCellValue(adr('A2'))).toEqual(1)
    expect(engine.getCellValue(adr('A3'))).toEqual(8.923353629661888)
    expect(engine.getCellValue(adr('A4'))).toEqual(0.06415002990995841)
  })
})
