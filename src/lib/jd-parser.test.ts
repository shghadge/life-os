import { describe, expect, it } from 'vitest'
import { parseRawJobDescription } from './jd-parser.ts'

const salary = (text: string) => {
  const { salaryMin, salaryMax } = parseRawJobDescription(text)
  return [salaryMin, salaryMax]
}
const tech = (text: string) => parseRawJobDescription(text).extractedMetadata.techStack

describe('parseRawJobDescription', () => {
  it('reads yearly salary ranges', () => {
    expect(salary('Base: $150,000 - $180,000 per year')).toEqual([150000, 180000])
    expect(salary('Pay 150-180k USD')).toEqual([150000, 180000])
  })

  it('ignores hourly rates and plain number ranges', () => {
    expect(salary('Pay: $45 - $65 per hour')).toEqual([undefined, undefined])
    expect(salary('You will join a team of 50 - 120 engineers.')).toEqual([undefined, undefined])
  })

  it('finds C++ and skips tech names used as ordinary words', () => {
    expect(tech('Requirements: C++ and CUDA')).toEqual(['C++'])
    expect(tech('Where we go from here, the rest is up to you.')).toEqual([])
    expect(tech('We use Go and REST APIs.')).toEqual(['Go', 'REST'])
  })
})
