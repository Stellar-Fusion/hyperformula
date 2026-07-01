import {HyperFormula} from '../../src'
import {ErrorType} from '../../src/Cell'
import {Config} from '../../src/Config'
import {SheetMapping} from '../../src/DependencyGraph'
import {buildTranslationPackage} from '../../src/i18n'
import {enGB, plPL} from '../../src/i18n/languages'
import {AstNodeType, ErrorAst, ParsingErrorType} from '../../src/parser'
import {adr} from '../testUtils'
import {buildEmptyParserWithCaching} from './common'

describe('Parsing error literals', () => {
  it('should parse error literals', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse('=#VALUE!', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.VALUE)
  })

  it('should not parse #LIC! as license error', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse('=#LIC!', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.ERROR)
  })

  it('should parse error literals with ?', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse('=#NAME?', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.NAME)
  })

  it('should parse error literals with slashes', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse('=#N/A', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.NA)
  })

  it('should parse error in other languages', () => {
    HyperFormula.registerLanguage('plPL', plPL)
    const parser = buildEmptyParserWithCaching(new Config({language: 'plPL'}), new SheetMapping(buildTranslationPackage(plPL)))
    const ast = parser.parse('=#ARG!', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.VALUE)
  })

  it('should parse #DIV/0!', () => {
    const parser = buildEmptyParserWithCaching(new Config({language: 'enGB'}), new SheetMapping(buildTranslationPackage(enGB)))
    const ast = parser.parse('=#DIV/0!', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.DIV_BY_ZERO)
  })

  it('should return parser error', () => {
    const parser = buildEmptyParserWithCaching(new Config({language: 'enGB'}), new SheetMapping(buildTranslationPackage(enGB)))
    const {ast, errors} = parser.parse('=#UNKNOWN!', adr('A1'))
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(errors[0].type).toBe(ParsingErrorType.ParserError)
    expect(errors[0].message).toBe('Unknown error literal')
  })

  it('should parse a sheet-qualified reference error (Excel writes Sheet!#REF! when a cross-sheet reference is deleted)', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse('=Income!#REF!', adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.REF)
  })

  it('should parse a quoted sheet-qualified reference error', () => {
    const parser = buildEmptyParserWithCaching(new Config())
    const ast = parser.parse("='Income Statement'!#REF!", adr('A1')).ast as ErrorAst
    expect(ast.type).toBe(AstNodeType.ERROR)
    expect(ast.error.type).toEqual(ErrorType.REF)
  })
})

describe('Evaluating sheet-qualified error literals', () => {
  it('ISNUMBER traps a sheet-qualified #REF! as FALSE, matching Excel', () => {
    const hf = HyperFormula.buildFromSheets(
      {Income: [[1]], Stats: [['=ISNUMBER(Income!#REF!)']]},
      {licenseKey: 'gpl-v3'},
    )
    expect(hf.getCellValue(adr('A1', 1))).toBe(false)
  })

  it('a defensive IF(ISNUMBER(Sheet!#REF!), Sheet!#REF!, "") resolves to empty string, not a parse error', () => {
    const hf = HyperFormula.buildFromSheets(
      {Income: [[1]], Stats: [['=IF(ISNUMBER(Income!#REF!), Income!#REF!, "")']]},
      {licenseKey: 'gpl-v3'},
    )
    expect(hf.getCellValue(adr('A1', 1))).toBe('')
  })
})
