import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('function CONCAT', () => {
  it('validate arguments', () => {
    const engine = HyperFormula.buildFromArray([['=CONCAT()']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('concatenates scalar arguments', () => {
    const engine = HyperFormula.buildFromArray([['John', 'Smith', '=CONCAT(A1, B1)']])

    expect(engine.getCellValue(adr('C1'))).toEqual('JohnSmith')
  })

  it('expands ranges', () => {
    const engine = HyperFormula.buildFromArray([['a', 'b', 'c', '=CONCAT(A1:C1)']])

    expect(engine.getCellValue(adr('D1'))).toEqual('abc')
  })

  it('propagates errors', () => {
    const engine = HyperFormula.buildFromArray([['=4/0', '=CONCAT(A1)']])

    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })
})
