/**
 * Presentation extensions — domain UI rendered by the host, never by the
 * model. A flow returns data; the extension shapes it into a typed payload
 * the widget draws. Verticals add their own entries here.
 */

export interface PresentationPayload {
  extension: string
  data: Record<string, unknown>
}

export interface PresentationExtension {
  name: string
  render: (input: Record<string, unknown>) => PresentationPayload | null
}

function payload(extension: string, data: Record<string, unknown>): PresentationPayload {
  return { extension, data }
}

const suggestions: PresentationExtension = {
  name: 'suggestions',
  render: (input) => {
    const raw = Array.isArray(input.suggestions) ? input.suggestions : []
    const chips = raw.filter((s): s is string => typeof s === 'string').slice(0, 4)
    return chips.length > 0 ? payload('suggestions', { chips }) : null
  },
}

const comparison: PresentationExtension = {
  name: 'comparison',
  render: (input) => {
    const rows = Array.isArray(input.rows) ? input.rows : []
    if (rows.length < 2) return null
    return payload('comparison', { rows: rows.slice(0, 4), summary: input.summary ?? null })
  },
}

const shoppingPlan: PresentationExtension = {
  name: 'shopping-plan',
  render: (input) => {
    if (!Array.isArray(input.lines)) return null
    return payload('shopping-plan', {
      title: typeof input.title === 'string' ? input.title : 'Kế hoạch mua sắm',
      lines: input.lines,
      total: typeof input.total === 'number' ? input.total : 0,
      budget: typeof input.budget === 'number' ? input.budget : null,
      overBudget: input.overBudget === true,
    })
  },
}

const itinerary: PresentationExtension = {
  name: 'itinerary',
  render: (input) => {
    if (!Array.isArray(input.segments) || input.segments.length === 0) return null
    return payload('itinerary', {
      title: typeof input.title === 'string' ? input.title : 'Lịch trình',
      segments: input.segments,
      total: typeof input.total === 'number' ? input.total : 0,
    })
  },
}

const planMatrix: PresentationExtension = {
  name: 'plan-matrix',
  render: (input) => {
    if (!Array.isArray(input.plans) || input.plans.length === 0) return null
    return payload('plan-matrix', { plans: input.plans, disclosure: input.disclosure ?? null })
  },
}

const feeDisclosure: PresentationExtension = {
  name: 'fee-disclosure',
  render: (input) => {
    if (!Array.isArray(input.fees)) return null
    return payload('fee-disclosure', {
      fees: input.fees,
      total: typeof input.total === 'number' ? input.total : 0,
      allIn: input.allIn === true,
    })
  },
}

const holdStatus: PresentationExtension = {
  name: 'hold-status',
  render: (input) => {
    if (typeof input.hold_id !== 'string' || typeof input.expires_at !== 'string') return null
    return payload('hold-status', {
      hold_id: input.hold_id,
      status: input.status ?? 'held',
      expires_at: input.expires_at,
      position: typeof input.position === 'number' ? input.position : null,
    })
  },
}

const EXTENSIONS: PresentationExtension[] = [
  suggestions,
  comparison,
  shoppingPlan,
  itinerary,
  planMatrix,
  feeDisclosure,
  holdStatus,
]

export function presentationExtensions(): string[] {
  return EXTENSIONS.map((ext) => ext.name)
}

/** Render a named extension; null when the name is unknown or input invalid. */
export function renderPresentation(
  name: string,
  input: Record<string, unknown>,
): PresentationPayload | null {
  return EXTENSIONS.find((ext) => ext.name === name)?.render(input) ?? null
}
