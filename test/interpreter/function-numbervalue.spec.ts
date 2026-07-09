import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function NUMBERVALUE', () => {
  it('should return #NA! with the wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE()']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('parses a plain decimal string', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("2026.1")']])
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2026.1, 6)
  })

  it('ignores whitespace anywhere in the text', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE(" 1 234.5 ")']])
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(1234.5, 6)
  })

  it('divides by 100 for each trailing percent sign', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("3.5%")'], ['=NUMBERVALUE("50%%")']])
    expect(engine.getCellValue(adr('A1')) as number).toBeCloseTo(0.035, 8)
    expect(engine.getCellValue(adr('A2')) as number).toBeCloseTo(0.005, 8)
  })

  it('honours an explicit decimal and group separator', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("2.500,50", ",", ".")']])
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2500.5, 6)
  })

  it('returns 0 for an empty string', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("")']])
    expect(engine.getCellValue(adr('A1'))).toBe(0)
  })

  it('coerces a numeric argument to text and back', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE(2026.2)']])
    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2026.2, 6)
  })

  it('returns #VALUE! when the decimal separator appears more than once', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("1.2.3")']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })

  it('returns #VALUE! for non-numeric text', () => {
    const engine = HyperFormula.buildFromArray([['=NUMBERVALUE("abc")']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })
})
