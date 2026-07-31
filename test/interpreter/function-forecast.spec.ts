import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('FORECAST', () => {
  it('validates number of arguments', () => {
    const engine = HyperFormula.buildFromArray([
      ['=FORECAST(1)'],
      ['=FORECAST(1, B1:B5)'],
      ['=FORECAST(1, B1:B5, C1:C5, D1:D5)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('ranges need to have same amount of elements', () => {
    const engine = HyperFormula.buildFromArray([
      ['=FORECAST(1, B1:B5, C1:C6)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.EqualLength))
  })

  it('works (simple)', () => {
    const engine = HyperFormula.buildFromArray([
      [1, 1],
      [2, 2],
      [3, 3],
      ['=FORECAST(10, A1:A3, B1:B3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqual(10)
  })

  it('at x = mean(known_xs) returns mean(known_ys)', () => {
    const engine = HyperFormula.buildFromArray([
      [2, 4],
      [5, 3],
      [7, 6],
      [1, 1],
      [8, 5],
      ['=FORECAST(3.8, A1:A5, B1:B5)'],
    ])

    expect(engine.getCellValue(adr('A6'))).toBeCloseTo(4.6, 9)
  })

  it('error when not enough data', () => {
    const engine = HyperFormula.buildFromArray([
      ['1', '10'],
      ['=FORECAST(1, A1:A1, B1:B1)'],
      ['=FORECAST(1, 42, 43)'],
      ['=FORECAST(1, "foo", "bar")'],
    ])

    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO, ErrorMessage.TwoValues))
    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO, ErrorMessage.TwoValues))
    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO, ErrorMessage.TwoValues))
  })

  it('doesnt do coercions, nonnumeric pairs are skipped', () => {
    const engine = HyperFormula.buildFromArray([
      [1, 1],
      ['="9"', '50'],
      [2, 2],
      [3, 3],
      ['=FORECAST(10, A1:A4, B1:B4)'],
    ])

    expect(engine.getCellValue(adr('A5'))).toEqual(10)
  })

  it('propagates errors', () => {
    const engine = HyperFormula.buildFromArray([
      ['1', '10'],
      ['=NA()', '50'],
      ['3', '30'],
      ['=FORECAST(1, A1:A3, B1:B3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.NA))
  })

  it('returns #DIV/0! when all known_x values are identical (zero x-variance)', () => {
    const engine = HyperFormula.buildFromArray([
      [1, 3],
      [2, 3],
      [4, 3],
      ['=FORECAST(1, A1:A3, B1:B3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
  })

  it('returns #VALUE! when x is not numeric', () => {
    const engine = HyperFormula.buildFromArray([
      [1, 1],
      [2, 2],
      [3, 3],
      ['=FORECAST("foo", A1:A3, B1:B3)'],
    ])

    expect(engine.getCellValue(adr('A4'))).toEqualError(detailedError(ErrorType.VALUE, ErrorMessage.NumberCoercion))
  })

  // 8 workbooks in the ingestion corpus define a named range literally called "forecast". Registering
  // a FORECAST function must not shadow them — the parser disambiguates on the trailing parenthesis.
  it('does not shadow a named expression called "forecast"', () => {
    const engine = HyperFormula.buildFromArray([[10], [20], ['=SUM(forecast)']])
    engine.addNamedExpression('forecast', '=Sheet1!$A$1:$A$2')

    expect(engine.getCellValue(adr('A3'))).toEqual(30)
  })

  it('FORECAST.LINEAR is an alias of FORECAST', () => {
    const engine = HyperFormula.buildFromArray([
      [2, 4],
      [5, 3],
      [7, 6],
      [1, 1],
      [8, 5],
      ['=FORECAST(7, A1:A5, B1:B5)', '=FORECAST.LINEAR(7, A1:A5, B1:B5)'],
    ])

    expect(engine.getCellValue(adr('B6'))).toEqual(engine.getCellValue(adr('A6')))
  })

  // Regression: AAMI_260731.xlsx, sheet AUM, shared formula si=55 spanning BJ52:BP52 —
  // IF(ISBLANK(BJ59),"NA",FORECAST(BJ59,$L52:$X52,$L59:$X59)). Before FORECAST existed these six
  // cells resolved to #NAME? and were reported as source errors. Expected values below are the
  // values Excel itself cached in the workbook.
  describe('Excel parity against real cached workbook values', () => {
    const aamiRows: (number | string)[][] = [
      [16.5, 16.226227552498223],
      [-3, -1.7190884587110986],
      [18.399999999999999, 16.33647430175612],
      [19.100000000000001, 15.813876107154391],
      [20, 16.991007607153602],
      [11.3, 5.3561050976878306],
      [13.5, 5.7352864092384497],
      [0.7, -0.50525768941269011],
      [-6.6, -4.685536004923887],
      [7.3, 15.244892935222941],
      [-3.4, -3.1396546923608666],
      [-7.5, -2.6927203133238948],
      [14.6, 13.453868591031901],
    ]

    // smartRounding off exposes the raw regression. This is not bit-identical to Excel — the jstat
    // covariance/sumsqerr accumulation order differs by ~1e-14 relative — and deliberately so: the
    // implementation stays consistent with SLOPE/INTERCEPT rather than hand-rolling the sums to
    // chase last-bit parity, which is unachievable for a separate engine and unobservable under
    // production's 10-digit smartRounding anyway.
    it('reproduces Excel to within floating-point accumulation error', () => {
      const engine = HyperFormula.buildFromArray([
        ...aamiRows,
        ['=FORECAST(0, A1:A13, B1:B13)', '=FORECAST(13.862204507696315, A1:A13, B1:B13)'],
      ], {smartRounding: false})

      const cases: [string, number][] = [
        ['A14', 0.07181360658347913],
        ['B14', 15.066649747424856],
      ]

      cases.forEach(([cell, excelCachedValue]) => {
        const calculated = engine.getCellValue(adr(cell)) as number
        expect(Math.abs((calculated - excelCachedValue) / excelCachedValue)).toBeLessThan(1e-12)
      })
    })

    // Production (EXCEL_LIKE_CONFIG in @stellar-fusion/common) leaves smartRounding at its default,
    // so results carry the engine's 10-digit rounding. That residual must stay well inside the
    // source-error detector's relative tolerance, otherwise these cells would still be reported.
    it('stays within the source-error relative tolerance under default rounding', () => {
      const engine = HyperFormula.buildFromArray([
        ...aamiRows,
        ['=FORECAST(0, A1:A13, B1:B13)', '=FORECAST(13.862204507696315, A1:A13, B1:B13)'],
      ])

      const sourceErrorRelativeTolerance = 1e-9
      const cases: [string, number][] = [
        ['A14', 0.07181360658347913],
        ['B14', 15.066649747424856],
      ]

      cases.forEach(([cell, excelCachedValue]) => {
        const calculated = engine.getCellValue(adr(cell)) as number
        expect(Math.abs((calculated - excelCachedValue) / excelCachedValue)).toBeLessThan(sourceErrorRelativeTolerance)
      })
    })
  })
})
