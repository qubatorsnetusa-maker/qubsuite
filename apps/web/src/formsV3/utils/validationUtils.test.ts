import { describe, expect, it } from 'vitest'
import { testRegexPattern, validateFormStepValue } from './validationUtils'
import type { FormStep } from '../types'

function makeStep(overrides: Partial<FormStep> = {}): FormStep {
  return {
    id: 'step-1',
    type: 'short_text',
    title: 'Question',
    ...overrides,
  }
}

describe('validateFormStepValue', () => {
  it('passes welcome/thank_you/statement steps through regardless of value', () => {
    expect(validateFormStepValue(makeStep({ type: 'welcome' }), undefined).isValid).toBe(true)
    expect(validateFormStepValue(makeStep({ type: 'thank_you' }), undefined).isValid).toBe(true)
    expect(validateFormStepValue(makeStep({ type: 'statement' }), undefined).isValid).toBe(true)
  })

  it('fails a required field left blank', () => {
    const step = makeStep({ validation: { required: true } })
    const result = validateFormStepValue(step, '')
    expect(result.isValid).toBe(false)
    expect(result.ruleFailed).toBe('required')
  })

  it('passes an optional field left blank', () => {
    const step = makeStep()
    expect(validateFormStepValue(step, '').isValid).toBe(true)
  })

  it('enforces minLength', () => {
    const step = makeStep({ validation: { minLength: 5 } })
    expect(validateFormStepValue(step, 'abc').isValid).toBe(false)
    expect(validateFormStepValue(step, 'abcdef').isValid).toBe(true)
  })

  it('enforces maxLength', () => {
    const step = makeStep({ validation: { maxLength: 3 } })
    expect(validateFormStepValue(step, 'abcd').isValid).toBe(false)
    expect(validateFormStepValue(step, 'abc').isValid).toBe(true)
  })

  it('rejects a non-numeric value on a number step', () => {
    const step = makeStep({ type: 'number' })
    const result = validateFormStepValue(step, 'not-a-number')
    expect(result.isValid).toBe(false)
    expect(result.ruleFailed).toBe('numberNaN')
  })

  it('uses the custom error message when provided', () => {
    const step = makeStep({
      validation: { required: true, customRequiredMessage: 'You must answer this.' },
    })
    const result = validateFormStepValue(step, '')
    expect(result.message).toBe('You must answer this.')
  })
})

describe('testRegexPattern', () => {
  it('treats an empty pattern as always valid', () => {
    expect(testRegexPattern('', '', 'anything').isValid).toBe(true)
  })

  it('matches a valid pattern against a matching value', () => {
    expect(testRegexPattern('^[0-9]+$', '', '12345').isValid).toBe(true)
  })

  it('reports no match for a valid pattern against a non-matching value', () => {
    expect(testRegexPattern('^[0-9]+$', '', 'abc').isValid).toBe(false)
  })

  it('reports a compile error for invalid regex syntax', () => {
    const result = testRegexPattern('([unclosed', '', 'abc')
    expect(result.isValid).toBe(false)
    expect(result.compileError).toBeTruthy()
  })
})
