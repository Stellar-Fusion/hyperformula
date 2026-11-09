import {ErrorType, HyperFormula} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('Function N', () => {
  it('should take one argument', () => {
    const engine = HyperFormula.buildFromArray([
      ['=N()'],
      ['=N(1, 2)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('should return a number unchanged', () => {
    const engine = HyperFormula.buildFromArray([
      ['=N(42)'],
      ['=N(B2)', -3.5],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(42)
    expect(engine.getCellValue(adr('A2'))).toEqual(-3.5)
  })

  it('should return the serial number of a date, not a date-typed value', () => {
    const engine = HyperFormula.buildFromArray([['=N(B1)', '=DATE(2026, 1, 1)']])

    expect(engine.getCellValue(adr('A1'))).toEqual(46023)
    expect(engine.getCellValueDetailedType(adr('A1'))).toEqual('NUMBER_RAW')
  })

  it('should convert logical values to 1 and 0', () => {
    const engine = HyperFormula.buildFromArray([
      ['=N(TRUE())'],
      ['=N(B2)', '=FALSE()'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(1)
    expect(engine.getCellValue(adr('A2'))).toEqual(0)
  })

  it('should return 0 for text, including numeric text, and for an empty cell', () => {
    const engine = HyperFormula.buildFromArray([
      ['=N("foo")'],
      ['=N("123")'],
      ['=N(B3)', null],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqual(0)
    expect(engine.getCellValue(adr('A2'))).toEqual(0)
    expect(engine.getCellValue(adr('A3'))).toEqual(0)
  })

  it('should propagate errors', () => {
    const engine = HyperFormula.buildFromArray([['=N(B1)', '=1/0']])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })

  // HUM CenterWell Annual!L71 wraps a JV line in N() so stray text in that row (seen one period earlier) adds 0
  // instead of breaking the patient total with #VALUE!.
  it('should let a sum skip a text cell (the HUM case)', () => {
    const engine = HyperFormula.buildFromArray([[100, 'n/a', 50, '=A1+N(B1)+C1']])

    expect(engine.getCellValue(adr('D1'))).toEqual(150)
  })

  it('does not shadow a named expression called "N"', () => {
    const engine = HyperFormula.buildFromArray([[10], [20], ['=SUM(N)']])
    engine.addNamedExpression('N', '=Sheet1!$A$1:$A$2')

    expect(engine.getCellValue(adr('A3'))).toEqual(30)
  })
})
