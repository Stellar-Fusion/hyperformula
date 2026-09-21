import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function SUBTOTAL', () => {
  it('should calculate AVERAGE', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(1, A2:A4, A5)', '=SUBTOTAL(101, A2:A4, A5)'],
      [2],
      [3],
      [4],
      [5]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(3.5)
    expect(engine.getCellValue(adr('B1'))).toEqual(3.5)
  })

  it('should calculate COUNT', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(2, A2:A4, A5)', '=SUBTOTAL(102, A2:A4, A5)'],
      [2],
      ['foo'],
      [4],
      [5]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(3)
    expect(engine.getCellValue(adr('B1'))).toEqual(3)
  })

  it('should calculate COUNTA', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(3, A2:A4, A5)', '=SUBTOTAL(103, A2:A4, A5)'],
      [2],
      ['foo'],
      [4],
      [5]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(4)
    expect(engine.getCellValue(adr('B1'))).toEqual(4)
  })

  it('should calcuate MAX', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(4, A2:A4, A5)', '=SUBTOTAL(104, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(5)
    expect(engine.getCellValue(adr('B1'))).toEqual(5)
  })

  it('should calculate MIN', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(5, A2:A4, A5)', '=SUBTOTAL(105, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(2)
    expect(engine.getCellValue(adr('B1'))).toEqual(2)
  })

  it('should calculate PRODUCT', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(6, A2:A4, A5)', '=SUBTOTAL(106, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(120)
    expect(engine.getCellValue(adr('B1'))).toEqual(120)
  })

  it('should calculate STDEV.S', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(7, A2:A4, A5)', '=SUBTOTAL(107, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(1.29099444873581, 6)
    expect(engine.getCellValue(adr('B1'))).toBeCloseTo(1.29099444873581, 6)
  })

  it('should calculate STDEV.P', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(8, A2:A4, A5)', '=SUBTOTAL(108, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(1.11803398875, 6)
    expect(engine.getCellValue(adr('B1'))).toBeCloseTo(1.11803398875, 6)
  })

  it('should calculate SUM', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(9, A2:A4, A5)', '=SUBTOTAL(109, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(14)
    expect(engine.getCellValue(adr('B1'))).toEqual(14)
  })

  it('should calculate VAR.S', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(10, A2:A4, A5)', '=SUBTOTAL(110, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toBeCloseTo(5 / 3, 6)
    expect(engine.getCellValue(adr('B1'))).toBeCloseTo(5 / 3, 6)
  })

  it('should calculate VAR.P', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(11, A2:A4, A5)', '=SUBTOTAL(111, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(5 / 4)
    expect(engine.getCellValue(adr('B1'))).toEqual(5 / 4)
  })

  it('should return correct error', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(12345, A2:A4, A5)'],
      [3],
      [5],
      [2],
      [4]
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.BadMode))
  })

  /*
   * Excel, LibreOffice and the ODFF standard all skip cells that themselves contain SUBTOTAL, so a
   * grand total over a column that already holds section subtotals does not count them twice.
   */
  it('ignores other SUBTOTALs inside the range', () => {
    const engine = HyperFormula.buildFromArray([
      ['=SUBTOTAL(9, A2:A4)'],
      ['=SUBTOTAL(9, B2:C2)', 1, 1],
      ['=SUBTOTAL(9, B3:C3)', 1, 1],
      ['=SUBTOTAL(9, B4:C4)', 1, 1],
    ])
    expect(engine.getCellValue(adr('A1'))).toEqual(0)
  })

  it('totals a statement column without double counting its section subtotal', () => {
    const engine = HyperFormula.buildFromArray([
      [21632],
      [708],
      [24082],
      ['=SUBTOTAL(9, A1:A3)'],
      [93272],
      [119701],
      ['=SUBTOTAL(9, A1:A6)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqual(46422)
    expect(engine.getCellValue(adr('A7'))).toEqual(259395)
  })

  it('still counts a plain SUM cell inside the range', () => {
    const engine = HyperFormula.buildFromArray([
      [1],
      [2],
      ['=SUM(A1:A2)'],
      ['=SUBTOTAL(9, A1:A3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqual(6)
  })

  it('ignores a cell whose formula only contains a SUBTOTAL somewhere inside it', () => {
    const engine = HyperFormula.buildFromArray([
      [1],
      [2],
      ['=-(SUBTOTAL(9, A1:A2)*2)+100'],
      ['=SUBTOTAL(9, A1:A3)'],
    ])

    expect(engine.getCellValue(adr('A3'))).toEqual(94)
    expect(engine.getCellValue(adr('A4'))).toEqual(3)
  })

  it('ignores a nested SUBTOTAL referenced as a single cell', () => {
    const engine = HyperFormula.buildFromArray([
      [1],
      [2],
      ['=SUBTOTAL(9, A1:A2)'],
      ['=SUBTOTAL(9, A1, A2, A3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqual(3)
  })

  it('applies to every function code, not just SUM', () => {
    const engine = HyperFormula.buildFromArray([
      [2],
      [4],
      ['=SUBTOTAL(9, A1:A2)'],
      ['=SUBTOTAL(1, A1:A3)', '=SUBTOTAL(2, A1:A3)', '=SUBTOTAL(3, A1:A3)', '=SUBTOTAL(4, A1:A3)', '=SUBTOTAL(106, A1:A3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqual(3)
    expect(engine.getCellValue(adr('B4'))).toEqual(2)
    expect(engine.getCellValue(adr('C4'))).toEqual(2)
    expect(engine.getCellValue(adr('D4'))).toEqual(4)
    expect(engine.getCellValue(adr('E4'))).toEqual(8)
  })

  it('does not share a cached range result with SUM over the same range, in either order', () => {
    const sumFirst = HyperFormula.buildFromArray([
      [1, '=SUM(A1:A3)', '=SUBTOTAL(9, A1:A3)'],
      [2],
      ['=SUBTOTAL(9, A1:A2)'],
    ])
    const subtotalFirst = HyperFormula.buildFromArray([
      [1, '=SUBTOTAL(9, A1:A3)', '=SUM(A1:A3)'],
      [2],
      ['=SUBTOTAL(9, A1:A2)'],
    ])

    expect(sumFirst.getCellValue(adr('B1'))).toEqual(6)
    expect(sumFirst.getCellValue(adr('C1'))).toEqual(3)
    expect(subtotalFirst.getCellValue(adr('B1'))).toEqual(3)
    expect(subtotalFirst.getCellValue(adr('C1'))).toEqual(6)
  })

  it('reuses a smaller range correctly when ranges grow row by row', () => {
    const engine = HyperFormula.buildFromArray([
      [1, '=SUBTOTAL(9, A$1:A1)'],
      [2, '=SUBTOTAL(9, A$1:A2)'],
      ['=SUBTOTAL(9, A1:A2)', '=SUBTOTAL(9, A$1:A3)'],
      [4, '=SUBTOTAL(9, A$1:A4)'],
    ])

    expect(engine.getCellValue(adr('B3'))).toEqual(3)
    expect(engine.getCellValue(adr('B4'))).toEqual(7)
  })

  it('recomputes when a cell inside the range becomes, or stops being, a SUBTOTAL', () => {
    const engine = HyperFormula.buildFromArray([
      [1],
      [2],
      ['=SUBTOTAL(9, A1:A2)'],
      ['=SUBTOTAL(9, A1:A3)'],
    ])

    engine.setCellContents(adr('A3'), '=SUM(A1:A2)')
    expect(engine.getCellValue(adr('A4'))).toEqual(6)

    engine.setCellContents(adr('A3'), '=SUBTOTAL(9, A1:A2)')
    expect(engine.getCellValue(adr('A4'))).toEqual(3)
  })
})
