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
})
