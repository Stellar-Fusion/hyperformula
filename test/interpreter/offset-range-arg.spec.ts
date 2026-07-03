import {HyperFormula} from '../../src'
import {adr} from '../testUtils'

const grid = () => [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]

describe('OFFSET with a range first argument', () => {
  it('takes the first row of a range via OFFSET(range,0,0,1,width)', () => {
    const engine = HyperFormula.buildFromArray([...grid(), ['=SUM(OFFSET(A1:C3,0,0,1,3))']], {licenseKey: 'gpl-v3'})

    expect(engine.getCellValue(adr('A4'))).toEqual(6)
  })

  it('resolves COLUMNS(literal range) as a static width', () => {
    const engine = HyperFormula.buildFromArray([...grid(), ['=SUM(OFFSET(A1:C3,0,0,1,COLUMNS(A1:C3)))']], {licenseKey: 'gpl-v3'})

    expect(engine.getCellValue(adr('A4'))).toEqual(6)
  })

  it('resolves ROWS(literal range) as a static height', () => {
    const engine = HyperFormula.buildFromArray([...grid(), ['=SUM(OFFSET(A1:A3,0,0,ROWS(A1:A3),1))']], {licenseKey: 'gpl-v3'})

    expect(engine.getCellValue(adr('A4'))).toEqual(12)
  })

  it('defaults omitted height/width to the source range dimensions', () => {
    const engine = HyperFormula.buildFromArray([...grid(), ['=SUM(OFFSET(A1:B2,0,0))'], ['=SUM(OFFSET(A1:B2,1,1))']], {licenseKey: 'gpl-v3'})

    expect(engine.getCellValue(adr('A4'))).toEqual(1 + 2 + 4 + 5)
    expect(engine.getCellValue(adr('A5'))).toEqual(5 + 6 + 8 + 9)
  })

  it('supports the MATCH-over-OFFSET-header-row idiom', () => {
    const engine = HyperFormula.buildFromArray(
      [
        ['id', 'colA', 'colB'],
        [1, 'a1', 'b1'],
        ['=INDEX(A2:C2,1,MATCH("colB",OFFSET(A1:C2,0,0,1,COLUMNS(A1:C2)),0))'],
      ],
      {licenseKey: 'gpl-v3'},
    )

    expect(engine.getCellValue(adr('A3'))).toEqual('b1')
  })

  it('still resolves a single-cell OFFSET (backward compatible)', () => {
    const engine = HyperFormula.buildFromArray([...grid(), ['=OFFSET(A1,1,1)']], {licenseKey: 'gpl-v3'})

    expect(engine.getCellValue(adr('A4'))).toEqual(5)
  })
})
