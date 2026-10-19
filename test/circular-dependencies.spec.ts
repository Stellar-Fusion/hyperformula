import {ErrorType, HyperFormula, Sheets} from '../src'
import {Config} from '../src/Config'
import {adr, detailedError} from './testUtils'
import TestFinancialModel from './financial-model.json'

describe('Circular Dependencies', () => {
  describe('with allowCircularReferences disabled (default)', () => {
    it('simple cycle should return CYCLE error', () => {
      const engine = HyperFormula.buildFromArray([['=B1', '=A1']])

      expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.CYCLE))
      expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.CYCLE))
    })

    it('three-cell cycle should return CYCLE error', () => {
      const engine = HyperFormula.buildFromArray([['=B1', '=C1', '=A1']])

      expect(engine.getCellValue(adr('A1'))).toEqualError(detailedError(ErrorType.CYCLE))
      expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.CYCLE))
      expect(engine.getCellValue(adr('C1'))).toEqualError(detailedError(ErrorType.CYCLE))
    })

    it('cycle with formula should return CYCLE error', () => {
      const engine = HyperFormula.buildFromArray([['5', '=A1+B1']])
      expect(engine.getCellValue(adr('B1'))).toEqualError(detailedError(ErrorType.CYCLE))
    })
  })

  describe('with allowCircularReferences enabled', () => {
    it('should handle simple two-cell cycle', () => {
      const engine = HyperFormula.buildFromArray([['=B1+1', '=A1+1']], {
        allowCircularReferences: true,
        initialComputedValues: {'Sheet1': [[200, 199]]},
      })

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))
      
      expect(valueA).toBe(200)
      expect(valueB).toBe(199)
    })

    it('should handle three-cell cycle', () => {
      const engine = HyperFormula.buildFromArray([['=B1+1', '=C1+1', '=A1+1']], {
        allowCircularReferences: true
        , initialComputedValues: {'Sheet1': [[300, 299, 298]]}
      })

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))
      const valueC = engine.getCellValue(adr('C1'))
      
      expect(valueA).toBe(300)
      expect(valueB).toBe(299)
      expect(valueC).toBe(298)
    })

    it('should handle self-cycles', () => {
      const engine = HyperFormula.buildFromArray([['5']], {
        allowCircularReferences: true
      })

      engine.setCellContents(adr('A1'), [['=A1*2']])
      
      const value = engine.getCellValue(adr('A1'))
      expect(value).toBe(0)
    })

    it('should handle complex formula cycles', () => {
      const engine = HyperFormula.buildFromArray([
        ['=SUM(B1:C1)', '=A1/2', '=A1/3']
      ], {
        allowCircularReferences: true
      })

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))
      const valueC = engine.getCellValue(adr('C1'))
      
      expect(valueA).toBe(0)
      expect(valueB).toBe(0)
      expect(valueC).toBe(0)
    })


    describe('dynamic recalculation with initialComputedValues', () => {
      it('should use initial computed values for circular references', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1+C1', '=A1+1', '10']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[1199, 1200, 10]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(1199)
        expect(engine.getCellValue(adr('B1'))).toBe(1200)
        expect(engine.getCellValue(adr('C1'))).toBe(10)

        engine.setCellContents(adr('C1'), [['20']])

        const newA1 = engine.getCellValue(adr('A1'))
        const newB1 = engine.getCellValue(adr('B1'))
        const newC1 = engine.getCellValue(adr('C1'))

        expect(newC1).toBe(20)
        expect(typeof newA1).toBe('number')
        expect(typeof newB1).toBe('number')
        expect(newA1).toBe(3299)
        expect(newB1).toBe(3300)
      })

      it('should handle stable circular references with exact solutions', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1', '=A1']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[10, 10]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(10)
        expect(engine.getCellValue(adr('B1'))).toBe(10)

        engine.setCellContents(adr('B1'), [['15']])

        expect(engine.getCellValue(adr('A1'))).toBe(15)
        expect(engine.getCellValue(adr('B1'))).toBe(15)
      })

      it('should handle breaking cycles by changing to constant values', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1+1', '=A1+1']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[51, 50]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(51)
        expect(engine.getCellValue(adr('B1'))).toBe(50)

        engine.setCellContents(adr('B1'), [['75']])

        expect(engine.getCellValue(adr('A1'))).toBe(76)
        expect(engine.getCellValue(adr('B1'))).toBe(75)
      })

      it('should handle breaking cycles by setting constants', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1+1', '=A1+1']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[51, 50]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(51)
        expect(engine.getCellValue(adr('B1'))).toBe(50)

        engine.setCellContents(adr('B1'), [['75']])

        expect(engine.getCellValue(adr('A1'))).toBe(76)
        expect(engine.getCellValue(adr('B1'))).toBe(75)
      })

      it('should handle adding external references to cycles', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1', '=A1', '']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[100, 100, 0]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(100)
        expect(engine.getCellValue(adr('B1'))).toBe(100)

        engine.setCellContents(adr('C1'), [['25']])
        engine.setCellContents(adr('A1'), [['=B1+C1']])

        const newA1 = engine.getCellValue(adr('A1'))
        const newB1 = engine.getCellValue(adr('B1'))
        const newC1 = engine.getCellValue(adr('C1'))

        expect(newC1).toBe(25)
        expect(typeof newA1).toBe('number')
        expect(typeof newB1).toBe('number')
        expect(newA1).toBeGreaterThan(100)
      })

      it('should handle cycles with external constants', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1+D1', '=A1', '', '5']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[15, 10, 0, 5]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(15)
        expect(engine.getCellValue(adr('B1'))).toBe(10)
        expect(engine.getCellValue(adr('D1'))).toBe(5)

        engine.setCellContents(adr('D1'), [['10']])

        const newA1 = engine.getCellValue(adr('A1'))
        const newB1 = engine.getCellValue(adr('B1'))
        const newD1 = engine.getCellValue(adr('D1'))

        expect(newD1).toBe(10)
        expect(typeof newA1).toBe('number')
        expect(typeof newB1).toBe('number')
        expect(newA1).toBeGreaterThan(15)
      })

      it('should preserve unaffected cells when changing external references', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1', '=A1', '=D1*2', '5']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[50, 50, 10, 5]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(50)
        expect(engine.getCellValue(adr('B1'))).toBe(50)
        expect(engine.getCellValue(adr('C1'))).toBe(10)
        expect(engine.getCellValue(adr('D1'))).toBe(5)

        engine.setCellContents(adr('D1'), [['8']])

        expect(engine.getCellValue(adr('C1'))).toBe(16)
        expect(engine.getCellValue(adr('D1'))).toBe(8)
        expect(engine.getCellValue(adr('A1'))).toBe(50)
        expect(engine.getCellValue(adr('B1'))).toBe(50)
      })

      it('should handle complete replacement of circular formulas', () => {
        const engine = HyperFormula.buildFromArray([
          ['=B1+1', '=A1+1']
        ], {
          allowCircularReferences: true,
          initialComputedValues: {'Sheet1': [[51, 50]]}
        })

        expect(engine.getCellValue(adr('A1'))).toBe(51)
        expect(engine.getCellValue(adr('B1'))).toBe(50)

        engine.setCellContents(adr('A1'), [['100']])
        engine.setCellContents(adr('B1'), [['200']])

        expect(engine.getCellValue(adr('A1'))).toBe(100)
        expect(engine.getCellValue(adr('B1'))).toBe(200)
      })
    })
  })

  describe('configuration validation', () => {
    it('should validate allowCircularReferences as boolean', () => {
      // eslint-disable-next-line
      // @ts-ignore
      expect(() => new Config({allowCircularReferences: 'true'}))
        .toThrowError('Expected value of type: boolean for config parameter: allowCircularReferences')
      
      // eslint-disable-next-line
      // @ts-ignore
      expect(() => new Config({allowCircularReferences: 1}))
        .toThrowError('Expected value of type: boolean for config parameter: allowCircularReferences')
      
      // eslint-disable-next-line
      // @ts-ignore
      expect(() => new Config({allowCircularReferences: {}}))
        .toThrowError('Expected value of type: boolean for config parameter: allowCircularReferences')
    })

    it('should accept valid boolean values', () => {
      expect(() => new Config({allowCircularReferences: true})).not.toThrow()
      expect(() => new Config({allowCircularReferences: false})).not.toThrow()
    })

    it('should default to false', () => {
      const config = new Config()
      expect(config.allowCircularReferences).toBe(false)
    })

    it('should preserve configured value', () => {
      const configTrue = new Config({allowCircularReferences: true})
      const configFalse = new Config({allowCircularReferences: false})
      
      expect(configTrue.allowCircularReferences).toBe(true)
      expect(configFalse.allowCircularReferences).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty cells in cycles', () => {
      const engine = HyperFormula.buildFromArray([['=B1', '']], {
        allowCircularReferences: true
      })

      engine.setCellContents(adr('B1'), [['=A1']])
      
      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))
      
      expect(valueA).toBe('')
      expect(valueB).toBe('')
    })

    it('should handle error values in cycles', () => {
      const engine = HyperFormula.buildFromArray([['=B1+1', '=1/0']], {
        allowCircularReferences: true
      })

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))
      
      expect(valueB).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
      expect(valueA).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
    })

    it('Should handle a financial model with circular data', () => {
      const hfInstance = HyperFormula.buildFromSheets(TestFinancialModel as Sheets, {
          allowCircularReferences: true,
          licenseKey: 'gpl-v3',
          dateFormats: ['MM/DD/YYYY', 'MM/DD/YY', 'YYYY/MM/DD'],
          currencySymbol: ['$', 'USD'],
          localeLang: 'en-US',
          accentSensitive: true,
          useArrayArithmetic: true,
          ignoreWhiteSpace: 'any' as const,
          evaluateNullToZero: true,
          leapYear1900: true,
          nullDate: { year: 1899, month: 12, day: 31 },
      })

      expect(hfInstance).toBeDefined()
    })
  })

  describe('convergence detection', () => {
    it('damped system converges early', () => {
      // A=0.5*B+1, B=0.5*A+1 → converges to 2
      const engine = HyperFormula.buildFromArray([['=0.5*B1+1', '1']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      // Introduce cycle via setCellContents (triggers partialRun with iteration)
      engine.setCellContents(adr('B1'), [['=0.5*A1+1']])

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))

      expect(valueA).toBeCloseTo(2, 8)
      expect(valueB).toBeCloseTo(2, 8)
    })

    it('config defaults are correct', () => {
      const config = new Config()
      expect(config.maxIterations).toBe(100)
      expect(config.convergenceThreshold).toBe(1e-10)
    })

    it('config validation rejects invalid maxIterations', () => {
      expect(() => new Config({maxIterations: 0}))
        .toThrowError('Config parameter maxIterations should be at least 1')

      // eslint-disable-next-line
      // @ts-ignore
      expect(() => new Config({maxIterations: 'abc'}))
        .toThrowError('Expected value of type: number for config parameter: maxIterations')
    })

    it('config validation rejects invalid convergenceThreshold', () => {
      expect(() => new Config({convergenceThreshold: -1}))
        .toThrowError('Config parameter convergenceThreshold should be at least 0')

      // eslint-disable-next-line
      // @ts-ignore
      expect(() => new Config({convergenceThreshold: 'abc'}))
        .toThrowError('Expected value of type: number for config parameter: convergenceThreshold')
    })

    it('non-converging system runs all iterations', () => {
      // A=B+1, B=A+1 diverges — values grow each iteration
      const engine = HyperFormula.buildFromArray([['=B1+1', '1']], {
        allowCircularReferences: true,
        maxIterations: 50,
      })

      // Introduce cycle via setCellContents (triggers partialRun with iteration)
      engine.setCellContents(adr('B1'), [['=A1+1']])

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))

      expect(typeof valueA).toBe('number')
      expect(typeof valueB).toBe('number')
      // With 50 iterations starting from 0, values grow substantially
      expect(valueA as number).toBeGreaterThan(10)
    })

    it('threshold 0 requires exact match', () => {
      // A=B, B=A — trivially converges from 0 on first iteration
      const engine = HyperFormula.buildFromArray([['=B1', '1']], {
        allowCircularReferences: true,
        convergenceThreshold: 0,
        maxIterations: 1000,
      })

      engine.setCellContents(adr('B1'), [['=A1']])

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))

      // After cycle introduction, both stabilize to same value
      expect(valueA).toBe(valueB)
    })

    it('error values converge', () => {
      // Both cells produce DIV_BY_ZERO — stable error should converge
      const engine = HyperFormula.buildFromArray([['=B1/0', '1']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      // Introduce cycle via setCellContents (triggers partialRun with iteration)
      engine.setCellContents(adr('B1'), [['=A1/0']])

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))

      expect(valueA).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
      expect(valueB).toEqualError(detailedError(ErrorType.DIV_BY_ZERO))
    })

    it('partialRun convergence via setCellContents', () => {
      // A=0.5*B+1, B=0.5*A+1 → converges to 2
      const engine = HyperFormula.buildFromArray([['=0.5*B1+1', '10']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      // Introduce a cycle via setCellContents (triggers partialRun)
      engine.setCellContents(adr('B1'), [['=0.5*A1+1']])

      const valueA = engine.getCellValue(adr('A1'))
      const valueB = engine.getCellValue(adr('B1'))

      expect(valueA).toBeCloseTo(2, 8)
      expect(valueB).toBeCloseTo(2, 8)
    })

    it('updates non-cyclic dependents after cycle convergence', () => {
      const engine = HyperFormula.buildFromArray([['=0.5*B1+1', '1', '=A1+B1', '=C1*2']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      engine.setCellContents(adr('B1'), [['=0.5*A1+1']])

      expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('B1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('C1'))).toBeCloseTo(4, 8)
      expect(engine.getCellValue(adr('D1'))).toBeCloseTo(8, 8)
    })

    it('updates cascading non-cyclic dependents after cycle convergence', () => {
      const engine = HyperFormula.buildFromArray([['=0.5*B1+1', '1', '=A1+B1', '=C1*2', '=D1+3']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      engine.setCellContents(adr('B1'), [['=0.5*A1+1']])

      expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('B1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('C1'))).toBeCloseTo(4, 8)
      expect(engine.getCellValue(adr('D1'))).toBeCloseTo(8, 8)
      expect(engine.getCellValue(adr('E1'))).toBeCloseTo(11, 8)
    })

    it('updates range dependents after cycle convergence', () => {
      const engine = HyperFormula.buildFromArray([['=0.5*B1+1', '1', '=SUM(A1:B1)', '=C1*2']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })

      engine.setCellContents(adr('B1'), [['=0.5*A1+1']])

      expect(engine.getCellValue(adr('A1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('B1'))).toBeCloseTo(2, 8)
      expect(engine.getCellValue(adr('C1'))).toBeCloseTo(4, 8)
      expect(engine.getCellValue(adr('D1'))).toBeCloseTo(8, 8)
    })

    it('converging model with low maxIterations produces same result as higher count', () => {
      // A=0.5*B+1, B=0.5*A+1 → converges to 2
      // With contraction factor 0.5, 20 iterations is more than enough
      const engineLow = HyperFormula.buildFromArray([['=0.5*B1+1', '1']], {
        allowCircularReferences: true,
        maxIterations: 20,
      })
      engineLow.setCellContents(adr('B1'), [['=0.5*A1+1']])

      const engineHigh = HyperFormula.buildFromArray([['=0.5*B1+1', '1']], {
        allowCircularReferences: true,
        maxIterations: 1000,
      })
      engineHigh.setCellContents(adr('B1'), [['=0.5*A1+1']])

      expect(engineLow.getCellValue(adr('A1'))).toBeCloseTo(engineHigh.getCellValue(adr('A1')) as number, 8)
      expect(engineLow.getCellValue(adr('B1'))).toBeCloseTo(engineHigh.getCellValue(adr('B1')) as number, 8)
    })
  })

  // Analyst cash roll-forwards with interest on cash (or a debt sweep) have one cycle per period,
  // chained through a non-cyclic "opening balance = previous closing balance" cell. After an edit,
  // every downstream cycle must be re-solved against its final opening balance; otherwise the
  // closing balance no longer equals opening + flow + interest and the model stops tying to Excel.
  describe('chained cycles linked through non-cyclic cells', () => {
    const INTEREST_RATE = 0.05
    const OPENING_BALANCE = 1000
    const SWEEP_SHARE = 0.5
    const SWEEP_THRESHOLD = 1300

    // Rows: 1 flow, 2 opening, 3 interest, 4 debt sweep, 5 closing. One column per period.
    const buildRollForward = (flows: number[], withSweep: boolean) => {
      const cols = flows.map((_, i) => String.fromCharCode(65 + i))
      return [
        flows,
        cols.map((col, i) => (i === 0 ? OPENING_BALANCE : `=${cols[i - 1]}5`)),
        cols.map((col) => `=${INTEREST_RATE}*${col}5`),
        cols.map((col) => (withSweep ? `=IF(${col}2>${SWEEP_THRESHOLD},${SWEEP_SHARE}*(${col}1+${col}3),0)` : 0)),
        cols.map((col) => `=${col}2+${col}1+${col}3-${col}4`),
      ]
    }

    // Closed-form fixed point of each period's cycle, used both as the converged seed and as the oracle.
    const solveRollForward = (flows: number[], withSweep: boolean) => {
      const rows: number[][] = [flows, [], [], [], []]
      let opening = OPENING_BALANCE
      flows.forEach((flow) => {
        const share = withSweep && opening > SWEEP_THRESHOLD ? SWEEP_SHARE : 0
        const closing = (opening + flow * (1 - share)) / (1 - INTEREST_RATE * (1 - share))
        const interest = INTEREST_RATE * closing
        rows[1].push(opening)
        rows[2].push(interest)
        rows[3].push(share * (flow + interest))
        rows[4].push(closing)
        opening = closing
      })
      return rows
    }

    const buildConvergedEngine = (flows: number[], withSweep: boolean) => HyperFormula.buildFromArray(
      buildRollForward(flows, withSweep),
      {
        allowCircularReferences: true,
        initialComputedValues: {'Sheet1': solveRollForward(flows, withSweep)},
      },
    )

    const expectRollForwardToMatch = (engine: HyperFormula, expected: number[][]) => {
      expected[4].forEach((closing, col) => {
        const value = (row: number) => engine.getCellValue({sheet: 0, row, col}) as number
        expect(value(1)).toBeCloseTo(expected[1][col], 6)
        expect(value(4)).toBeCloseTo(closing, 6)
        expect(value(4)).toBeCloseTo(value(1) + value(0) + value(2) - value(3), 6)
      })
    }

    it('re-solves every downstream cycle after an edit upstream of the chain', () => {
      const engine = buildConvergedEngine([100, 50, 50, 50, 50, 50], false)

      engine.setCellContents(adr('A1'), [[200]])

      expectRollForwardToMatch(engine, solveRollForward([200, 50, 50, 50, 50, 50], false))
    })

    it('re-solves downstream cycles when the edit flips a branch inside a later cycle', () => {
      const engine = buildConvergedEngine([100, 50, 50, 50], true)

      engine.setCellContents(adr('A1'), [[200]])

      expectRollForwardToMatch(engine, solveRollForward([200, 50, 50, 50], true))
    })

    it('leaves upstream periods untouched when the edit is in the middle of the chain', () => {
      const engine = buildConvergedEngine([100, 50, 50, 50, 50], false)

      engine.setCellContents(adr('C1'), [[150]])

      expectRollForwardToMatch(engine, solveRollForward([100, 50, 150, 50, 50], false))
    })
  })
})
