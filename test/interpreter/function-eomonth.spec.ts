import {HyperFormula} from '../../src'
import {CellValueDetailedType, ErrorType} from '../../src'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError, expectCellValueToEqualDate} from '../testUtils'

describe('Function EOMONTH', () => {
  it('validate arguments', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 3, 31)'],
      ['=EOMONTH("foo", 0)'],
      ['=EOMONTH(A1, "bar")'],
      ['=EOMONTH(A1)'],
      ['=EOMONTH(A1, "bar", "baz")'],
    ])

    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A5'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('should return NUMBER_DATE', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 7, 31)'],
      ['=EOMONTH(A1, 1)'],
    ])

    expect(engine.getCellValueDetailedType(adr('A2'))).toBe(CellValueDetailedType.NUMBER_DATE)
  })

  it('works for 0', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 3, 10)'],
      ['=EOMONTH(A1, 0)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/03/2019')
    expect(engine.getCellValueDetailedType(adr('A2'))).toBe(CellValueDetailedType.NUMBER_DATE)
  })

  it('works for exact end of month', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 3, 31)'],
      ['=EOMONTH(A1, 0)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/03/2019')
  })

  it('works for positive numbers', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 7, 31)'],
      ['=EOMONTH(A1, 1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/08/2019')
  })

  it('works for negative numbers', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 8, 31)'],
      ['=EOMONTH(A1, -1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/07/2019')
  })

  it('works when next date will have more days', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 6, 30)'],
      ['=EOMONTH(A1, 1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/07/2019')
  })

  it('works when next date will have less days', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 1, 31)'],
      ['=EOMONTH(A1, 1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '28/02/2019')
  })

  it('works when previous date will have more days', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 2, 28)'],
      ['=EOMONTH(A1, -1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '31/01/2019')
  })

  it('works when previous date will have less days', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 3, 31)'],
      ['=EOMONTH(A1, -1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '28/02/2019')
  })

  it('works for leap years', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2020, 2, 28)'],
      ['=EOMONTH(A1, 0)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '29/02/2020')
  })

  it('works for non-leap years', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 2, 28)'],
      ['=EOMONTH(A1, 0)'],
    ])

    expectCellValueToEqualDate(engine, adr('A2'), '28/02/2019')
  })

  it('use number coercion for 1st argument', () => {
    const engine = HyperFormula.buildFromArray([
      ['=EOMONTH(TRUE(), 1)'],
      ['=EOMONTH(1, 1)'],
    ])

    expectCellValueToEqualDate(engine, adr('A1'), '31/01/1900')
    expectCellValueToEqualDate(engine, adr('A2'), '31/01/1900')
  })

  it('use number coercion for 2nd argument', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2019, 3, 31)'],
      ['="1"', '=EOMONTH(A1, A2)'],
      ['=TRUE()', '=EOMONTH(A1, A3)'],
    ])

    expectCellValueToEqualDate(engine, adr('B2'), '30/04/2019')
    expectCellValueToEqualDate(engine, adr('B3'), '30/04/2019')
  })

  it('propagate errors', () => {
    const engine = HyperFormula.buildFromArray([
      ['=EOMONTH(4/0, 0)'],
      ['=EOMONTH(0, 4/0)'],
      ['=EOMONTH(4/0, FOOBAR())'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })
})

describe('Function EOMONTH, 31 December serials', () => {
  // JMKE (Evercore, prod): Model!DW5 holds 2036-12-31 (serial 50040) and Model!DV5 = EOMONTH(DW5, -3).
  // Excel caches 2036-09-30 = serial 49948; the year-estimation overshoot in numberToSimpleDate decoded
  // 50040 as the impossible 2037-01-00, so we walked back from January and returned 2036-10-31 = 49979,
  // a month late, which then skewed every quarter derived from it.
  const excelConfig = {leapYear1900: true, nullDate: {year: 1899, month: 12, day: 31}}

  it('walks back from December, not January, for 2036-12-31', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2036, 12, 31)'],
      ['=EOMONTH(A1, -3)'],
    ], excelConfig)

    expect(engine.getCellValue(adr('A1'))).toEqual(50040)
    expect(engine.getCellValue(adr('A2'))).toEqual(49948)
  })

  it('is correct for the other 31 December serials the year estimate overshoots', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2040, 12, 31)', '=EOMONTH(A1, -3)'],
      ['=DATE(2044, 12, 31)', '=EOMONTH(A2, -3)'],
      ['=DATE(2069, 12, 31)', '=EOMONTH(A3, -3)'],
    ], excelConfig)

    expect(engine.getCellValue(adr('B1'))).toEqual(51409)
    expect(engine.getCellValue(adr('B2'))).toEqual(52870)
    expect(engine.getCellValue(adr('B3'))).toEqual(62001)
  })

  it('leaves EOMONTH on an unaffected serial alone', () => {
    const engine = HyperFormula.buildFromArray([
      ['=DATE(2035, 12, 31)'],
      ['=EOMONTH(A1, -3)'],
    ], excelConfig)

    expect(engine.getCellValue(adr('A2'))).toEqual(49582)
  })
})
