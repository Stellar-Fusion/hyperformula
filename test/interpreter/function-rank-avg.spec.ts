import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function RANK.AVG', () => {
  const ref = [[10], [20], [20], [30]]

  it('ranks descending by default (largest = 1)', () => {
    const engine = HyperFormula.buildFromArray([...ref, ['=RANK.AVG(30,A1:A4)'], ['=RANK.AVG(10,A1:A4)']])
    expect(engine.getCellValue(adr('A5'))).toBe(1)
    expect(engine.getCellValue(adr('A6'))).toBe(4)
  })

  it('returns the average rank for ties', () => {
    const engine = HyperFormula.buildFromArray([...ref, ['=RANK.AVG(20,A1:A4)']])
    expect(engine.getCellValue(adr('A5'))).toBe(2.5)
  })

  it('ranks ascending when order is non-zero', () => {
    const engine = HyperFormula.buildFromArray([...ref, ['=RANK.AVG(10,A1:A4,1)'], ['=RANK.AVG(20,A1:A4,1)']])
    expect(engine.getCellValue(adr('A5'))).toBe(1)
    expect(engine.getCellValue(adr('A6'))).toBe(2.5)
  })

  it('ignores non-numeric cells in the reference', () => {
    const engine = HyperFormula.buildFromArray([[10], ['x'], [30], [20], ['=RANK.AVG(20,A1:A4)']])
    expect(engine.getCellValue(adr('A5'))).toBe(2)
  })

  it('returns #N/A when the number is not in the reference', () => {
    const engine = HyperFormula.buildFromArray([...ref, ['=RANK.AVG(99,A1:A4)']])
    expect(engine.getCellValue(adr('A5'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.ValueNotFound))
  })

  it('returns #NA! with the wrong number of arguments', () => {
    const engine = HyperFormula.buildFromArray([['=RANK.AVG(1)']])
    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })
})
