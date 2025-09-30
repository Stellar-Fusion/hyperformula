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
})
