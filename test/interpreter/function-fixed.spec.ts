import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function FIXED', () => {
  it('should return #NA! with the wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED()']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('defaults to 2 decimals and groups thousands', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1234.567)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,234.57')
  })

  it('rounds to the requested number of decimals', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1234.567,1)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,234.6')
  })

  it('rounds left of the decimal point for negative decimals', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1234.567,-2)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,200')
  })

  it('omits the thousands separator when no_commas is TRUE', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1234.567,1,TRUE())']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1234.6')
  })

  it('handles negative numbers', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(-1234.567,1)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('-1,234.6')
  })

  it('formats a small value with no integer grouping (the BDN percent case)', () => {
    const engine = HyperFormula.buildFromArray([['="rate of "&FIXED(10.9,1)&"%"']])
    expect(engine.getCellValue(adr('A1'))).toEqual('rate of 10.9%')
  })

  it('coerces a numeric string argument', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED("1234.5",0)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,235')
  })

  it('returns #VALUE! for a non-numeric argument', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED("abc",1)']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })

  it('zero decimals rounds to an integer', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1234.567,0)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,235')
  })

  it('rounds half away from zero at an IEEE half-boundary (1.005 -> 1.01)', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1.005,2)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1.01')
  })

  it('does not throw for decimals > 100 (toFixed range guard)', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(1.5,150)']])
    expect(typeof engine.getCellValue(adr('A1'))).toBe('string')
  })

  it('expands a magnitude >= 1e21 without exponent notation', () => {
    const engine = HyperFormula.buildFromArray([['=FIXED(10^21,0)']])
    expect(engine.getCellValue(adr('A1'))).toEqual('1,000,000,000,000,000,000,000')
  })
})
