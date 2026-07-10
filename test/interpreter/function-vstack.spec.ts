import {ErrorType, HyperFormula} from '../../src'
import {adr, detailedError} from '../testUtils'

describe('Function VSTACK', () => {
  it('stacks two vertical ranges into one column', () => {
    const engine = HyperFormula.buildFromArray(
      [[1, 10], [2, 20], [3, 30], ['=VSTACK(A1:A3,B1:B3)']],
      { licenseKey: 'gpl-v3', useArrayArithmetic: true },
    )
    // spills A4:A6 = 1,2,3 then A7:A9 = 10,20,30
    expect(engine.getCellValue(adr('A4'))).toBe(1)
    expect(engine.getCellValue(adr('A6'))).toBe(3)
    expect(engine.getCellValue(adr('A7'))).toBe(10)
    expect(engine.getCellValue(adr('A9'))).toBe(30)
  })

  it('returns the top-left element via INDEX (the neutralized-anchor path)', () => {
    const engine = HyperFormula.buildFromArray(
      [[5], [6], [7], ['=INDEX(VSTACK(A1:A3,B1:B3),1,1)'], ['x'], ['y'], ['z']],
      { licenseKey: 'gpl-v3', useArrayArithmetic: true },
    )
    expect(engine.getCellValue(adr('A4'))).toBe(5)
  })

  it('stacks arrays of differing widths, padding short rows with #N/A', () => {
    const engine = HyperFormula.buildFromArray(
      [[1, 2], [9], ['=VSTACK(A1:B1,A2:A2)']],
      { licenseKey: 'gpl-v3', useArrayArithmetic: true },
    )
    expect(engine.getCellValue(adr('A3'))).toBe(1)
    expect(engine.getCellValue(adr('B3'))).toBe(2)
    expect(engine.getCellValue(adr('A4'))).toBe(9)
    expect(engine.getCellValue(adr('B4'))).toEqualError(detailedError(ErrorType.NA))
  })

})

describe('Function HSTACK', () => {
  it('stacks two horizontal ranges into one row', () => {
    const engine = HyperFormula.buildFromArray(
      [[1, 2, 100, 200], ['=HSTACK(A1:B1,C1:D1)']],
      { licenseKey: 'gpl-v3', useArrayArithmetic: true },
    )
    expect(engine.getCellValue(adr('A2'))).toBe(1)
    expect(engine.getCellValue(adr('B2'))).toBe(2)
    expect(engine.getCellValue(adr('C2'))).toBe(100)
    expect(engine.getCellValue(adr('D2'))).toBe(200)
  })
})
