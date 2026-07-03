import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('function TEXTJOIN', () => {
  it('validate arguments', () => {
    const engine = HyperFormula.buildFromArray([['=TEXTJOIN(",")']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('joins values with a delimiter', () => {
    const engine = HyperFormula.buildFromArray([['a', 'b', 'c', '=TEXTJOIN("-", TRUE(), A1:C1)']])

    expect(engine.getCellValue(adr('D1'))).toEqual('a-b-c')
  })

  it('skips empty cells when ignore_empty is TRUE', () => {
    const engine = HyperFormula.buildFromArray([['a', '', 'c', '=TEXTJOIN("-", TRUE(), A1:C1)']])

    expect(engine.getCellValue(adr('D1'))).toEqual('a-c')
  })

  it('keeps empty cells when ignore_empty is FALSE', () => {
    const engine = HyperFormula.buildFromArray([['a', '', 'c', '=TEXTJOIN("-", FALSE(), A1:C1)']])

    expect(engine.getCellValue(adr('D1'))).toEqual('a--c')
  })

  it('propagates errors', () => {
    const engine = HyperFormula.buildFromArray([['=4/0', '=TEXTJOIN(",", TRUE(), A1)']])

    expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })
})
