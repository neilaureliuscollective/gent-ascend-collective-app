/** Reviewed job briefs. Selecting a brief never sends a message or grants tool authority. */
export const companyJobs = [
  {
    id: 'company-brief',
    title: 'Understand a company',
    detail: 'Define the customer, offer, economics and goal before recommending work.',
    draft:
      'Help me prepare a company brief. First ask for the company name, what it sells, its customer, current stage, main problem and desired outcome. Ask only the essential questions. Separate supplied facts from assumptions and unknowns. Then produce a reviewable brief with sources, constraints, priorities and one next step. Do not claim to create a saved company workspace or share this with a client.',
  },
  {
    id: 'positioning',
    title: 'Sharpen the positioning',
    detail: 'Make the customer, promise and reason to choose the company clear.',
    draft:
      'Help me improve a company’s positioning. Ask for the company, current offer, target customer, alternatives and evidence of demand. Challenge weak assumptions. Produce a positioning recommendation, supporting evidence, offer direction and a small validation experiment. Label proposed copy and unknowns.',
  },
  {
    id: 'launch',
    title: 'Plan a launch',
    detail: 'Connect the offer, distribution, economics and execution sequence.',
    draft:
      'Help me build a company launch plan. Ask for the company, offer, audience, budget, capacity, timing and existing assets. Produce a staged plan with deliverables, owners, dependencies, assumptions, acceptance criteria and approval points. Separate draft preparation from external execution. Do not claim anything is published or scheduled.',
  },
  {
    id: 'economics',
    title: 'Analyze the economics',
    detail: 'Pressure-test price, cost, capacity and cash requirements.',
    draft:
      'Help me analyze a company’s economics. Ask for the company, prices, direct costs, sales volume, overhead, available cash and capacity. Distinguish actuals, estimates and missing information. Show calculations and a sensitivity range. Identify the decision the numbers support. Do not invent financial records or treat this as professional financial certification.',
  },
  {
    id: 'product-development',
    title: 'Develop a product',
    detail: 'Move from concept to research, sourcing and commercial feasibility.',
    draft:
      'Help me develop a product for my company. Ask about the company, customer, product concept, constraints and target economics. Prepare a research and development brief covering requirements, differentiation, sourcing, testing, claims, unit economics and launch dependencies. Identify where a qualified scientist or other professional must verify conclusions. Do not recommend shopping from Aethelios or claim lab testing occurred.',
  },
  {
    id: 'client-engagement',
    title: 'Scope a client engagement',
    detail: 'Define what the client receives and what success means.',
    draft:
      'Help me scope an Ascend Architects engagement delivered using Aethelios. Ask for the client company, problem, desired outcome, budget range, constraints and available evidence. Prepare a discovery brief, bounded scope, deliverables, exclusions, timeline assumptions, revision allowance, acceptance criteria and proposed payment milestones. Keep internal delivery costs and margins in a separate internal section; do not put them in client-facing copy. No proposal is sent, engagement created or price finalized through this draft.',
  },
  {
    id: 'investor-deck',
    title: 'Prepare an investor presentation',
    detail: 'Build a clear narrative supported by actual company evidence.',
    draft:
      'Help me prepare an investor presentation. Ask for the company, audience, stage, traction, economics and funding objective. Draft a slide-by-slide narrative, required evidence, financial assumptions and design brief. Mark missing facts; never invent traction or investors. Do not claim a downloadable slide deck exists unless an actual export is produced.',
  },
  {
    id: 'build-brief',
    title: 'Specify a website or app',
    detail: 'Turn a business problem into a bounded, testable build brief.',
    draft:
      'Help me prepare a website or app build brief for a company. Ask for the company, users, business outcome, existing system and constraints. Define user flows, scope, data boundaries, integrations, acceptance checks and release approvals. Preserve working infrastructure. Label this a proposed specification; do not claim repository access, code execution or deployment.',
  },
] as const;
export function companyJob(id: string | undefined) {
  return companyJobs.find((job) => job.id === id);
}
