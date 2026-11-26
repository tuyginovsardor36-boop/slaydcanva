import { Slide, SlideLayout, ThemeConfig, ThemeId } from '../types/deck';

export const PRESENTATION_THEMES: Record<ThemeId, ThemeConfig> = {
  'swiss-ivory': {
    id: 'swiss-ivory',
    name: 'Swiss Ivory',
    description: 'Clean studio white with deep slate ink and cobalt accents',
    isDark: false,
    bgHex: '#FFFFFF',
    surfaceHex: '#F4F5F7',
    borderHex: '#E2E5EA',
    inkHex: '#111827',
    mutedHex: '#5B6472',
    accentHex: '#1D4ED8',
    accentSoftHex: '#EFF6FF',
    accentInkHex: '#FFFFFF',
    titleFont: 'display',
    chartPalette: ['#1D4ED8', '#3B82F6', '#0F172A', '#64748B', '#94A3B8'],
  },
  'obsidian-slate': {
    id: 'obsidian-slate',
    name: 'Obsidian Slate',
    description: 'Architectural dark canvas with crisp chalk typography',
    isDark: true,
    bgHex: '#0F172A',
    surfaceHex: '#1E293B',
    borderHex: '#334155',
    inkHex: '#F8FAFC',
    mutedHex: '#94A3B8',
    accentHex: '#38BDF8',
    accentSoftHex: '#0C4A6E',
    accentInkHex: '#0F172A',
    titleFont: 'display',
    chartPalette: ['#38BDF8', '#60A5FA', '#E2E8F0', '#94A3B8', '#475569'],
  },
  'editorial-ink': {
    id: 'editorial-ink',
    name: 'Editorial Ink',
    description: 'Warm archival paper paired with serif display headlines',
    isDark: false,
    bgHex: '#FAF9F6',
    surfaceHex: '#F1EFEA',
    borderHex: '#DFDCD4',
    inkHex: '#1C1917',
    mutedHex: '#57534E',
    accentHex: '#9A3412',
    accentSoftHex: '#FFF7ED',
    accentInkHex: '#FFFFFF',
    titleFont: 'serif',
    chartPalette: ['#9A3412', '#C2410C', '#292524', '#78716C', '#A8A29E'],
  },
  'forest-monograph': {
    id: 'forest-monograph',
    name: 'Forest Monograph',
    description: 'Deep botanical green canvas with crisp ivory contrast',
    isDark: true,
    bgHex: '#0B1F19',
    surfaceHex: '#133128',
    borderHex: '#214D40',
    inkHex: '#F4F7F5',
    mutedHex: '#9EB8AE',
    accentHex: '#34D399',
    accentSoftHex: '#064E3B',
    accentInkHex: '#06281E',
    titleFont: 'serif',
    chartPalette: ['#34D399', '#6EE7B7', '#D1FAE5', '#4B7A6B', '#2B5B4D'],
  },
  'cobalt-blueprint': {
    id: 'cobalt-blueprint',
    name: 'Cobalt Blueprint',
    description: 'Executive cool steel surfaces with sharp azure emphasis',
    isDark: false,
    bgHex: '#F8FAFC',
    surfaceHex: '#EEF2F7',
    borderHex: '#CBD5E1',
    inkHex: '#0F172A',
    mutedHex: '#475569',
    accentHex: '#0369A1',
    accentSoftHex: '#E0F2FE',
    accentInkHex: '#FFFFFF',
    titleFont: 'display',
    chartPalette: ['#0369A1', '#0284C7', '#0F172A', '#64748B', '#94A3B8'],
  },
  'sandstone-warmth': {
    id: 'sandstone-warmth',
    name: 'Sandstone Warmth',
    description: 'Muted limestone ground with espresso ink and ochre accent',
    isDark: false,
    bgHex: '#F7F4EF',
    surfaceHex: '#EDE8DF',
    borderHex: '#DCD4C8',
    inkHex: '#231F20',
    mutedHex: '#635B55',
    accentHex: '#B45309',
    accentSoftHex: '#FEF3C7',
    accentInkHex: '#FFFFFF',
    titleFont: 'display',
    chartPalette: ['#B45309', '#D97706', '#292524', '#78716C', '#A8A29E'],
  },
};

export const LAYOUT_DEFINITIONS: Array<{
  id: SlideLayout;
  label: string;
  description: string;
}> = [
  { id: 'title', label: 'Title Hero', description: 'Cover or section divider with bold headline and backdrop' },
  { id: 'bullets', label: 'Key Points', description: 'Structured takeaway list with optional callout block' },
  { id: 'two-column', label: 'Two Columns', description: 'Side-by-side comparison or dual strategic pillars' },
  { id: 'metrics', label: 'Metrics Grid', description: '3–4 KPI cards with tabular figures and delta context' },
  { id: 'process', label: 'Roadmap / Steps', description: 'Sequential numbered milestones across a timeline' },
  { id: 'visual-split', label: 'Visual + Narrative', description: '50/50 split pairing key copy with chart or 1–3 topic photos' },
  { id: 'table', label: 'Data Table', description: 'Structured comparison matrix or operational ledger' },
  { id: 'quote', label: 'Editorial Quote', description: 'High-impact thesis statement or customer quote' },
  { id: 'ai-canvas', label: 'AI Custom Canvas', description: 'Custom 16:9 infographic, diagram, or editorial layout drawn by AI' },
];

export const BUILTIN_SLIDE_IMAGES = [
  {
    label: 'Glass & Concrete Atrium',
    url: '/src/assets/images/slide_cover_architecture_1795677984303.jpg',
  },
  {
    label: 'Precision Aluminum Hardware',
    url: '/src/assets/images/slide_visual_hardware_1795677984579.jpg',
  },
];

export function createBlankSlide(layout: SlideLayout): Slide {
  const id = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  switch (layout) {
    case 'title':
      return {
        id,
        layout: 'title',
        kicker: 'Strategic Briefing',
        title: 'Presentation Title Goes Here',
        subtitle: 'Clear one-line thesis summarizing the scope, audience, and decision required.',
        imageUrl: BUILTIN_SLIDE_IMAGES[0].url,
        speakerNotes: 'Open with the core strategic question and set expectations for the next 15 minutes.',
      };
    case 'metrics':
      return {
        id,
        layout: 'metrics',
        kicker: 'Performance Snapshot',
        title: 'Key Operating Metrics',
        subtitle: 'Year-over-year operational benchmarks across core business units.',
        metrics: [
          { value: '$14.8M', label: 'Annual Recurring Revenue', delta: '+34% YoY' },
          { value: '98.4%', label: 'Service Availability', delta: '+1.2 pts' },
          { value: '42 ms', label: 'Median Edge Latency', delta: '-18% QoQ' },
        ],
        callout: 'Enterprise expansion accounts for 68% of net-new ARR growth this quarter.',
        speakerNotes: 'Highlight the latency reduction alongside ARR expansion to reinforce unit economics.',
      };
    case 'two-column':
      return {
        id,
        layout: 'two-column',
        kicker: 'Strategic Trade-offs',
        title: 'Current State vs. Target Architecture',
        columns: [
          {
            title: 'Legacy Workflow',
            items: [
              'Manual spreadsheet reconciliation across regions',
              '48-hour reporting lag on inventory turns',
              'Fragmented vendor scorecards without audit trails',
            ],
          },
          {
            title: 'Unified Platform',
            items: [
              'Automated ledger sync every 15 minutes',
              'Real-time exception routing for regional leads',
              'Single source of truth for executive reviews',
            ],
          },
        ],
        speakerNotes: 'Walk from left to right, emphasizing how automation removes the 48-hour blind spot.',
      };
    case 'process':
      return {
        id,
        layout: 'process',
        kicker: 'Execution Plan',
        title: 'Four-Quarter Rollout Roadmap',
        steps: [
          { number: '01', title: 'Audit & Baseline', description: 'Map existing workflows and instrument telemetry.' },
          { number: '02', title: 'Pilot Cohort', description: 'Deploy across two flagship regional hubs.' },
          { number: '03', title: 'Core Integration', description: 'Connect ERP billing and automated alerts.' },
          { number: '04', title: 'Global Scale', description: 'Full rollout with quarterly governance reviews.' },
        ],
        speakerNotes: 'Confirm Phase 2 pilot criteria before requesting sign-off on Phase 3 headcount.',
      };
    case 'table':
      return {
        id,
        layout: 'table',
        kicker: 'Vendor Evaluation',
        title: 'Capability & Cost Comparison',
        table: {
          headers: ['Capability', 'Internal Build', 'Managed Cloud', 'Hybrid Edge'],
          rows: [
            ['Deployment Lead Time', '6 months', '3 weeks', '6 weeks'],
            ['Annual Operating Cost', '$420,000', '$185,000', '$240,000'],
            ['Data Sovereignty', 'Full', 'Regional', 'Full'],
            ['SLA Guarantee', 'Best Effort', '99.9%', '99.95%'],
          ],
        },
        speakerNotes: 'Point out that Hybrid Edge balances full data sovereignty with a 6-week launch window.',
      };
    case 'quote':
      return {
        id,
        layout: 'quote',
        kicker: 'Executive Principle',
        title: 'Design for Clarity',
        quote: 'Operational resilience is rarely achieved by adding more dashboards; it comes from shortening the path between signal and decision.',
        attribution: 'Elena Vance, VP of Platform Operations',
        speakerNotes: 'Pause for three seconds after reading the quote before transitioning to the roadmap.',
      };
    case 'visual-split':
      return {
        id,
        layout: 'visual-split',
        kicker: 'Growth Trajectory',
        title: 'Regional Throughput Expansion',
        subtitle: 'Sustained volume growth following automated routing deployment.',
        bullets: [
          'North America hubs achieved 1.8x throughput within 90 days',
          'Error rates fell below 0.4% across peak seasonal loads',
          'Capital payback realized inside two operating quarters',
        ],
        chart: {
          type: 'bar',
          title: 'Quarterly Throughput (k units)',
          unit: 'k',
          points: [
            { label: 'Q1', value: 120 },
            { label: 'Q2', value: 165 },
            { label: 'Q3', value: 218 },
            { label: 'Q4', value: 284 },
          ],
        },
        speakerNotes: 'Use Q3 inflection point to illustrate the impact of edge automation.',
      };
    case 'bullets':
    default:
      return {
        id,
        layout: 'bullets',
        kicker: 'Key Findings',
        title: 'Core Takeaways & Next Steps',
        subtitle: 'Priority initiatives selected for immediate execution.',
        bullets: [
          'Consolidate regional data pipelines under one unified schema',
          'Standardize quarterly executive KPIs across product and finance',
          'Automate anomaly alerts to cut incident triage time by half',
          'Establish monthly architecture review checkpoints',
        ],
        callout: 'Target completion: End of Q2 with zero downtime migration.',
        speakerNotes: 'Keep focus on the first two priorities if meeting time is constrained.',
      };
  }
}
