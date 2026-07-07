import {HyperFormula} from '../../src'
import {ErrorType} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('cross-sheet range reference in scalar context (implicit intersection)', () => {
  it('intersects a single-row cross-sheet range by the formula column', () => {
    const engine = HyperFormula.buildFromSheets({
      Data: [['m', 'HEADER', 'other']],
      Report: [[null, "='Data'!B1:C1"]],
    })

    expect(engine.getCellValue(adr('B1', 1))).toEqual('HEADER')
  })

  it('intersects a single-column cross-sheet range by the formula row', () => {
    const engine = HyperFormula.buildFromSheets({
      Data: [[10], [20], [30]],
      Report: [[null], ["='Data'!A1:A3"]],
    })

    expect(engine.getCellValue(adr('A2', 1))).toEqual(20)
  })

  it('errors when the formula falls outside the cross-sheet range span', () => {
    const engine = HyperFormula.buildFromSheets({
      Data: [[10], [20], [30]],
      Report: [[null], [null], [null], [null], ["='Data'!A1:A3"]],
    })

    expect(engine.getCellValue(adr('A5', 1))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.ScalarExpected))
  })

  it('errors for a two-dimensional cross-sheet range', () => {
    const engine = HyperFormula.buildFromSheets({
      Data: [[1, 2], [3, 4]],
      Report: [["='Data'!A1:B2"]],
    })

    expect(engine.getCellValue(adr('A1', 1))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.ScalarExpected))
  })

  it('leaves a same-sheet bare range reference as #VALUE! (existing behavior)', () => {
    const engine = HyperFormula.buildFromArray([
      [10, '=A1:A3'],
      [20],
      [30],
    ])

    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.ScalarExpected))
  })
})
