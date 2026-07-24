import {Config} from '../../src/Config'
import {DateTimeHelper} from '../../src/DateTimeHelper'
import {format} from '../../src/format/format'

describe('FormatInterpreter', () => {
  const config = new Config()
  const dateHelper = new DateTimeHelper(config)
  it('works for expression without significant tokens', () => {
    expect(format(2, 'Foo', config, dateHelper)).toEqual('Foo')
  })

  it('works for simple date expression', () => {
    expect(format(2, 'dd-mm-yyyy', config, dateHelper)).toEqual('01-01-1900')
  })

  it('renders the abbreviated month name for mmm', () => {
    expect(format(2, 'mmm', config, dateHelper)).toEqual('Jan')
  })

  it('renders the full month name for mmmm', () => {
    expect(format(2, 'mmmm', config, dateHelper)).toEqual('January')
  })

  it('renders the single-letter month for mmmmm', () => {
    expect(format(2, 'mmmmm', config, dateHelper)).toEqual('J')
  })

  it('renders a full-month-name date expression (mmmm d, yyyy)', () => {
    expect(format(2, 'mmmm d, yyyy', config, dateHelper)).toEqual('January 1, 1900')
  })

  it('selects the date section of a multi-section format and formats it as a date', () => {
    expect(format(2, 'dd-mm-yyyy;@', config, dateHelper)).toEqual('01-01-1900')
  })

  it('renders a pure-text section as stripped display text, not the raw quoted pattern', () => {
    expect(format(0, '#,##0;(#,##0);"-"', config, dateHelper)).toEqual('-')
  })

  it('renders an explicitly empty section as an empty string (Excel display-nothing)', () => {
    expect(format(5, '0;;', config, dateHelper)).toEqual('5')
    expect(format(-5, '0;;', config, dateHelper)).toEqual('')
    expect(format(0, '0;;', config, dateHelper)).toEqual('')
  })

  it('treats escaped/quoted percent as a display literal (no scaling), but scales a real percent token', () => {
    expect(format(3, '0\\%', config, dateHelper)).toEqual('3%')
    expect(format(0.5, '0.0"%"', config, dateHelper)).toEqual('0.5%')
    expect(format(0.05, '0%', config, dateHelper)).toEqual('5%')
  })

  it('rounds tiny (exponent-notation) magnitudes without producing NaN', () => {
    expect(format(0.0000001, '0.00', config, dateHelper)).toEqual('0.00')
    expect(format(-0.0000001, '0.00', config, dateHelper)).toEqual('0.00')
  })

  it('works with # without decimal separator', () => {
    expect(format(1, '###', config, dateHelper)).toEqual('1')
    expect(format(12, '###', config, dateHelper)).toEqual('12')
    expect(format(123, '###', config, dateHelper)).toEqual('123')
    expect(format(123.4, '###', config, dateHelper)).toEqual('123')
    expect(format(1234, '###', config, dateHelper)).toEqual('1234')
  })

  it('works with # number format with decimal separator', () => {
    expect(format(1, '#.##', config, dateHelper)).toEqual('1.')
    expect(format(12, '#.##', config, dateHelper)).toEqual('12.')
    expect(format(12.34, '#.##', config, dateHelper)).toEqual('12.34')
    expect(format(12.345, '#.##', config, dateHelper)).toEqual('12.35')
  })

  it('works with 0 without decimal separator', () => {
    expect(format(1, '000', config, dateHelper)).toEqual('001')
    expect(format(12, '000', config, dateHelper)).toEqual('012')
    expect(format(123, '000', config, dateHelper)).toEqual('123')
    expect(format(123.4, '000', config, dateHelper)).toEqual('123')
    expect(format(1234, '000', config, dateHelper)).toEqual('1234')
  })

  it('works with 0 number format', () => {
    expect(format(1, '00.00', config, dateHelper)).toEqual('01.00')
    expect(format(12, '00.00', config, dateHelper)).toEqual('12.00')
    expect(format(12.3, '00.00', config, dateHelper)).toEqual('12.30')
    expect(format(12.34, '00.00', config, dateHelper)).toEqual('12.34')
    expect(format(12.345, '00.00', config, dateHelper)).toEqual('12.35')
  })

  it('number formatting with additional chars', () => {
    expect(format(1, '$0.00', config, dateHelper)).toEqual('$1.00')
  })

  it('scales by 100 for the percent format token', () => {
    expect(format(0.032, '0.0%', config, dateHelper)).toEqual('3.2%')
    expect(format(0.1, '0.0%', config, dateHelper)).toEqual('10.0%')
    expect(format(0.032, '0.00%', config, dateHelper)).toEqual('3.20%')
    expect(format(0.5, '0%', config, dateHelper)).toEqual('50%')
  })

  it('scales by 100 once per percent sign', () => {
    expect(format(0.5, '0%%', config, dateHelper)).toEqual('5000%%')
  })

  it('rounds the percent like Excel despite binary floating-point noise', () => {
    // 0.0295 * 100 === 2.9499999999999997, which naively rounds down to "2.9%".
    // Excel normalises to 15 significant digits first, so it shows "3.0%".
    expect(format(0.0295, '0.0%', config, dateHelper)).toEqual('3.0%')
  })

  it('rounds halves away from zero like Excel', () => {
    // 3.15 rounds half-to-even (toFixed) to "3.1"; Excel rounds half away from zero to "3.2".
    expect(format(0.0315, '0.0%', config, dateHelper)).toEqual('3.2%')
    expect(format(-0.0315, '0.0%', config, dateHelper)).toEqual('-3.2%')
    expect(format(2.5, '0', config, dateHelper)).toEqual('3')
    expect(format(-2.5, '0', config, dateHelper)).toEqual('-3')
  })

  it('leaves non-percent formats unscaled', () => {
    expect(format(12.34, '0.00', config, dateHelper)).toEqual('12.34')
    expect(format(2, 'dd-mm-yyyy', config, dateHelper)).toEqual('01-01-1900')
  })

  it('applies thousands grouping for the #,##0 comma (Excel parity)', () => {
    // The comma between digit placeholders is a thousands separator. Before the fix the parser
    // stopped the number token at the comma, leaking ",##0.0" as literal text and dropping the
    // grouping (the CMG EVRvCons commentary case: "$2,471.9" rendered as "$2472,##0.0").
    expect(format(2471.9, '#,##0.0', config, dateHelper)).toEqual('2,471.9')
    expect(format(2471.9, '$#,##0.0', config, dateHelper)).toEqual('$2,471.9')
    expect(format(2471.9, '#,##0', config, dateHelper)).toEqual('2,472')
    expect(format(1234567.89, '#,##0.00', config, dateHelper)).toEqual('1,234,567.89')
    expect(format(11.36, '$#,##0.00', config, dateHelper)).toEqual('$11.36')
    expect(format(-2471.9, '#,##0.0', config, dateHelper)).toEqual('-2,471.9')
  })

  it('leaves a comma-free format ungrouped (no regression)', () => {
    expect(format(2471.9, '0.0', config, dateHelper)).toEqual('2471.9')
    expect(format(1234, '000', config, dateHelper)).toEqual('1234')
  })

  it('scales by 1000 for each trailing comma (Excel $-thousands/$-millions display)', () => {
    // A comma AFTER the last digit placeholder divides the displayed value by 1000 per comma.
    // Distinct from the grouping comma between digits. Common in models showing "$ in thousands".
    expect(format(1234567, '#,##0,', config, dateHelper)).toEqual('1,235')
    expect(format(1234567, '#,##0,,', config, dateHelper)).toEqual('1')
    expect(format(1500000, '0.0,,', config, dateHelper)).toEqual('1.5')
    expect(format(2500, '0,', config, dateHelper)).toEqual('3')
    expect(format(1234567, '#,##0.0,', config, dateHelper)).toEqual('1,234.6')
  })

  it('strips colour / condition brackets and renders embedded currency symbols', () => {
    // [Red]/[Blue] colour codes and [>100] conditions are display directives, not part of the number
    // pattern; unstripped they leak into the output (and [Red]'s "d" gets mangled by the date parser).
    // [$symbol-locale] renders its currency symbol.
    expect(format(-5, '[Red]0', config, dateHelper)).toEqual('-5')
    expect(format(1234, '[Blue]#,##0', config, dateHelper)).toEqual('1,234')
    expect(format(5, '[Green]0.0', config, dateHelper)).toEqual('5.0')
    expect(format(5, '[$$-409]#,##0', config, dateHelper)).toEqual('$5')
    expect(format(5, '[$£-809]#,##0', config, dateHelper)).toEqual('£5')
  })

  it('does NOT strip elapsed-time duration brackets (regression)', () => {
    // [hh]/[mm]/[ss] are duration tokens consumed by the date/duration formatter — must survive.
    expect(format(0.1, '[hh]:mm:ss', config, dateHelper)).toEqual('02:24:00')
    expect(format(0.1, '[mm]:ss', config, dateHelper)).toEqual('144:00')
  })
})
