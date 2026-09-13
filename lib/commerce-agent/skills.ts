/**
 * Skill registry — each flow is defined ONCE here (name, role, tools,
 * enable-switch) and every runtime (Messages API, SDK consoles, MCP servers,
 * manifests) reads from it. A skill whose switch is OFF is parked under
 * `skills/_staged/` and never reaches a tool registry or prompt.
 */

import { assistantConfig } from '../assistant/config'
import { merchantConfig } from '../assistant/merchant/config'

export type AgentRole = 'shopping' | 'merchant'

export interface SkillDefinition {
  /** Directory name under skills/<role>/, e.g. 'search-discovery'. */
  name: string
  role: AgentRole
  /** Tool names this flow may call (presentation tool included when used). */
  tools: string[]
  /** True when the backing system switch is ON. */
  isEnabled: () => boolean
}

const shoppingTools = {
  searchDiscovery: ['search_products', 'get_product_details'],
  purchaseResearch: ['compare_products', 'get_product_details'],
  planningGoals: [
    'create_shopping_plan',
    'get_cart',
    'add_to_cart',
    'update_cart_item',
    'remove_from_cart',
    'start_checkout',
    'get_fulfillment_options',
  ],
  customerCare: ['track_order', 'get_order_history', 'search_policies', 'get_fulfillment_options'],
  memoryPersonalization: ['update_memory'],
} as const

const merchantTools = {
  performanceInsights: ['get_business_snapshot', 'run_analysis', 'get_latest_digest'],
  catalogListings: ['search_listings', 'get_listing', 'stage_publish_change', 'get_pending_changes'],
  inventoryOperations: ['get_inventory_alerts', 'get_order_issues', 'stage_stock_change'],
  pricingPromotions: ['get_pricing_context', 'stage_price_change'],
  marketingCampaigns: ['draft_campaign_brief', 'list_campaign_briefs'],
} as const

export const SHOPPING_SKILLS: SkillDefinition[] = [
  {
    name: 'search-discovery',
    role: 'shopping',
    tools: [...shoppingTools.searchDiscovery],
    isEnabled: () => true,
  },
  {
    name: 'purchase-research',
    role: 'shopping',
    tools: [...shoppingTools.purchaseResearch],
    isEnabled: () => true,
  },
  {
    name: 'planning-goals',
    role: 'shopping',
    tools: [...shoppingTools.planningGoals],
    isEnabled: () => assistantConfig.enableCart || assistantConfig.enableFulfillment,
  },
  {
    name: 'customer-care',
    role: 'shopping',
    tools: [...shoppingTools.customerCare],
    isEnabled: () => assistantConfig.enableOrders || assistantConfig.enablePolicies,
  },
  {
    name: 'memory-personalization',
    role: 'shopping',
    tools: [...shoppingTools.memoryPersonalization],
    isEnabled: () => assistantConfig.enableMemoryExtraction,
  },
]

export const MERCHANT_SKILLS: SkillDefinition[] = [
  {
    name: 'performance-insights',
    role: 'merchant',
    tools: [...merchantTools.performanceInsights],
    isEnabled: () => merchantConfig.enableAnalysis,
  },
  {
    name: 'catalog-listings',
    role: 'merchant',
    tools: [...merchantTools.catalogListings],
    isEnabled: () => merchantConfig.enableListingReads,
  },
  {
    name: 'inventory-operations',
    role: 'merchant',
    tools: [...merchantTools.inventoryOperations],
    isEnabled: () => merchantConfig.enableInventory,
  },
  {
    name: 'pricing-promotions',
    role: 'merchant',
    tools: [...merchantTools.pricingPromotions],
    isEnabled: () => merchantConfig.enablePricing,
  },
  {
    name: 'marketing-campaigns',
    role: 'merchant',
    tools: [...merchantTools.marketingCampaigns],
    isEnabled: () => merchantConfig.enableCampaigns,
  },
]

export const ALL_SKILLS: SkillDefinition[] = [...SHOPPING_SKILLS, ...MERCHANT_SKILLS]

/** Tool names any enabled skill may call, plus the shared presentation tool. */
export function enabledToolNames(role: AgentRole): string[] {
  const names = new Set<string>()
  for (const skill of ALL_SKILLS) {
    if (skill.role !== role || !skill.isEnabled()) continue
    for (const tool of skill.tools) names.add(tool)
  }
  names.add('present_suggestions')
  return [...names]
}

/** Skills currently parked (switch OFF) — must live under skills/_staged/. */
export function stagedSkills(): SkillDefinition[] {
  return ALL_SKILLS.filter((skill) => !skill.isEnabled())
}
