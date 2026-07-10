import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {ErrorMessage} from '../../src/error-message'
import {adr, detailedError} from '../testUtils'

describe('INTERCEPT', () => {
  it('validates number of arguments', () => {
    const engine = HyperFormula.buildFromArray([
      ['=INTERCEPT(B1:B5)'],
      ['=INTERCEPT(B1:B5, C1:C5, D1:D5)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
    expect(engine.getCellValue(adr('A2'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.WrongArgNumber))
  })

  it('ranges need to have the same number of elements', () => {
    const engine = HyperFormula.buildFromArray([
      ['=INTERCEPT(B1:B5, C1:C6)'],
    ])

    expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.NA, ErrorMessage.EqualLength))
  })

  it('computes the regression y-intercept', () => {
    // y = 2x + 1 exactly -> intercept 1
    const engine = HyperFormula.buildFromArray([
      [3, 5, 7, 9], // known_y's  (=2x+1 for x=1,2,3,4)
      [1, 2, 3, 4], // known_x's
      ['=INTERCEPT(A1:D1, A2:D2)'],
    ])

    expect(engine.getCellValue(adr('A3'))).toBeCloseTo(1, 9)
  })

  it('matches Excel on a non-trivial series', () => {
    // known_y's {2,3,9,1,8}, known_x's {6,5,11,7,5}; slope=16.6/24.8, intercept=4.6-slope*6.8
    const engine = HyperFormula.buildFromArray([
      [2, 3, 9, 1, 8],
      [6, 5, 11, 7, 5],
      ['=INTERCEPT(A1:E1, A2:E2)'],
    ])

    expect(engine.getCellValue(adr('A3'))).toBeCloseTo(0.048387, 5)
  })

  it('needs at least two points', () => {
    const engine = HyperFormula.buildFromArray([
      [5],
      [2],
      ['=INTERCEPT(A1:A1, A2:A2)'],
    ])

    expect(engine.getCellValue(adr('A3'))).toEqualError(detailedError(ErrorType.DIV_BY_ZERO, ErrorMessage.TwoValues))
  })
})
