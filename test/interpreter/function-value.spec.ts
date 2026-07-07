import {HyperFormula} from '../../src'
import {ErrorType} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('VALUE()', () => {
  it('converts numeric text to a number', () => {
    const engine = HyperFormula.buildFromArray([['=VALUE("123")']])

    expect(engine.getCellValue(adr('A1'))).toEqual(123)
  })

  it('converts a decimal string', () => {
    const engine = HyperFormula.buildFromArray([['=VALUE("3.14")']])

    expect(engine.getCellValue(adr('A1'))).toEqual(3.14)
  })

  it('extracts a leading number via LEFT (the NBIX case)', () => {
    const engine = HyperFormula.buildFromArray([['2026 Guidance', '=VALUE(LEFT(A1, 4))']])

    expect(engine.getCellValue(adr('B1'))).toEqual(2026)
  })

  it('passes a number through unchanged', () => {
    const engine = HyperFormula.buildFromArray([['=VALUE(42)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(42)
  })

  it('returns #VALUE! for non-numeric text', () => {
    const engine = HyperFormula.buildFromArray([['=VALUE("hello")']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })

  it('wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([['=VALUE()']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })
})
