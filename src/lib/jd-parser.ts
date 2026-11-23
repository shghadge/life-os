import type { ExtractedMetadata } from '../types/job.ts'

const KNOWN_TECH_STACK = [
  'React', 'TypeScript', 'JavaScript', 'Next.js', 'Node.js', 'Python', 'Go', 'Golang',
  'Rust', 'Java', 'C++', 'GraphQL', 'REST', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'TailwindCSS', 'CSS', 'HTML', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'CI/CD', 'GitHub Actions', 'Terraform', 'Kafka', 'Elasticsearch', 'Spark',
  'PyTorch', 'TensorFlow', 'LLM', 'LangChain', 'OpenAI', 'FastAPI', 'Django',
  'Flask', 'Ruby', 'Rails', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Figma',
  'Webpack', 'Vite', 'Turborepo', 'Microservices', 'System Design'
]

/** Names that are also everyday words ("go", "rest", "react"): only matched with exact capitals. */
const CASE_SENSITIVE_TECH: Record<string, true> = {
  Go: true, REST: true, React: true, Rust: true, Spark: true, Swift: true, Ruby: true, Rails: true, Flask: true,
}

export function parseRawJobDescription(text: string): {
  detectedCompany?: string
  detectedRole?: string
  salaryMin?: number
  salaryMax?: number
  extractedMetadata: ExtractedMetadata
} {
  const clean = text.trim()
  if (!clean) {
    return {
      extractedMetadata: {
        techStack: [],
        keyRequirements: [],
        responsibilities: [],
      }
    }
  }

  // Detect tech stack. Edges exclude letters, digits and "+", so "Go" skips "Golang" and "C++" is found.
  const detectedTech = KNOWN_TECH_STACK.filter(tech => {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\w+])${escaped}(?![\\w+])`, CASE_SENSITIVE_TECH[tech] ? '' : 'i').test(clean)
  })

  // Detect Salary Range: the upper bound must be written in thousands (",000" or "k"), which
  // skips hourly rates ("$45 - $65 per hour") and plain counts ("50 - 120 engineers").
  // e.g. $150,000 - $210,000 or $160k - $220k or 150-200k USD
  let salaryMin: number | undefined = undefined
  let salaryMax: number | undefined = undefined
  let salaryMentioned: string | undefined = undefined

  const salaryRegex = /(?<![\d,.])(?:\$|USD\s*)?(\d{2,3})(?:,\d{3}|k)?\s*(?:-|–|to)\s*(?:\$|USD\s*)?(\d{2,3})(?:,\d{3}|k)(?!\d)\s*(?:USD|\/yr|per year|annually)?/i
  const match = clean.match(salaryRegex)
  if (match) {
    salaryMentioned = match[0]
    let min = parseInt(match[1], 10)
    let max = parseInt(match[2], 10)
    if (min < 1000) min *= 1000
    if (max < 1000) max *= 1000
    if (min > 30000 && min < 1000000) salaryMin = min
    if (max > 30000 && max < 1000000) salaryMax = max
  }

  // Detect Experience Level
  let experienceLevel: string | undefined = undefined
  const expMatch = clean.match(/\b(\d+\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)(?:\s+of)?\s+experience)\b/i)
  if (expMatch) {
    experienceLevel = expMatch[1]
  } else if (/\b(staff|principal|lead)\b/i.test(clean)) {
    experienceLevel = 'Staff / Principal'
  } else if (/\b(senior|sr\.)\b/i.test(clean)) {
    experienceLevel = 'Senior'
  } else if (/\b(junior|jr\.|entry-level)\b/i.test(clean)) {
    experienceLevel = 'Junior'
  } else if (/\b(mid-level|intermediate)\b/i.test(clean)) {
    experienceLevel = 'Mid-level'
  }

  // Extract bullets for requirements and responsibilities
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)
  const keyRequirements: string[] = []
  const responsibilities: string[] = []

  let currentSection: 'none' | 'req' | 'resp' = 'none'

  for (const line of lines) {
    if (/(requirements|qualifications|what you('ll| will) need|what we are looking for|who you are)/i.test(line)) {
      currentSection = 'req'
      continue
    }
    if (/(responsibilities|what you('ll| will) do|role overview|the role|your impact)/i.test(line)) {
      currentSection = 'resp'
      continue
    }
    if (/(benefits|perks|about us|about the company|compensation)/i.test(line)) {
      currentSection = 'none'
      continue
    }

    const isBullet = /^[-*•–—►]\s+/.test(line) || /^\d+\.\s+/.test(line)
    if (isBullet) {
      const content = line.replace(/^[-*•–—►\d.]+\s*/, '')
      if (content.length > 8) {
        if (currentSection === 'req' && keyRequirements.length < 6) {
          keyRequirements.push(content)
        } else if (currentSection === 'resp' && responsibilities.length < 6) {
          responsibilities.push(content)
        } else if (keyRequirements.length < 4) {
          keyRequirements.push(content)
        }
      }
    }
  }

  // Auto detect potential title & company from line 1 & 2 if short
  let detectedRole: string | undefined = undefined
  let detectedCompany: string | undefined = undefined

  if (lines.length > 0 && lines[0].length < 60 && !lines[0].includes(':')) {
    if (lines[0].includes(' at ')) {
      const parts = lines[0].split(' at ')
      detectedRole = parts[0].trim()
      detectedCompany = parts[1].trim()
    } else if (lines[0].includes(' - ')) {
      const parts = lines[0].split(' - ')
      detectedCompany = parts[0].trim()
      detectedRole = parts[1].trim()
    }
  }

  return {
    detectedCompany,
    detectedRole,
    salaryMin,
    salaryMax,
    extractedMetadata: {
      techStack: Array.from(new Set(detectedTech)),
      salaryMentioned,
      experienceLevel,
      keyRequirements,
      responsibilities,
    }
  }
}
