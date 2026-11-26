import { Deck } from '../types/deck';

export const STARTER_DECK: Deck = {
  id: 'deck-starter-nexus-2027',
  title: 'Autonomous Edge Logistics Strategy',
  subtitle: '2027 Infrastructure & Operations Roadmap',
  themeId: 'swiss-ivory',
  createdAt: '2026-11-20T09:00:00.000Z',
  updatedAt: '2026-11-25T16:30:00.000Z',
  slides: [
    {
      id: 'slide-1',
      layout: 'title',
      kicker: 'Board Strategy Review · November 2026',
      title: 'Autonomous Edge Logistics',
      subtitle: 'Scaling deterministic warehouse telemetry and sub-50ms routing across 14 regional fulfillment hubs.',
      imageUrl: '/src/assets/images/slide_cover_architecture_1795677984303.jpg',
      callout: 'Prepared by Global Infrastructure & Operations',
      speakerNotes:
        'Welcome the board. Frame this briefing around three decisions: approving Phase 2 edge compute capex, standardizing telemetry contracts, and locking the Q3 regional rollout schedule.',
    },
    {
      id: 'slide-2',
      layout: 'metrics',
      kicker: 'Baseline Performance',
      title: 'FY26 Operational Benchmarks',
      subtitle: 'Pilot deployment across Frankfurt and Austin outperformed legacy cloud routing on every latency and unit-cost metric.',
      metrics: [
        { value: '38 ms', label: 'Median Dispatch Latency', delta: '-64% vs cloud' },
        { value: '99.94%', label: 'Edge Uptime SLA', delta: '+0.41 pts' },
        { value: '$1.82', label: 'Cost per 1k Events', delta: '-31% YoY' },
        { value: '14.2M', label: 'Daily Telemetry Signals', delta: '2.4x capacity' },
      ],
      callout: 'Pilot hubs maintained full routing continuity during two regional fiber outages in Q3.',
      speakerNotes:
        'Draw attention to the 38ms dispatch latency—this threshold unlocks real-time conveyor sorting without central cloud round-trips.',
    },
    {
      id: 'slide-3',
      layout: 'visual-split',
      kicker: 'Volume & Throughput',
      title: 'Quarterly Autonomous Sortation Growth',
      subtitle: 'Measured weekly parcel capacity across upgraded edge clusters.',
      bullets: [
        'Local inference eliminates cross-region queueing spikes during peak holiday windows',
        'Predictive motor telemetry reduced unplanned conveyor downtime by 47%',
        'Hardware footprint fits existing rack enclosures with zero floor expansion',
      ],
      chart: {
        type: 'bar',
        title: 'Processed Parcels (Millions)',
        unit: 'M',
        points: [
          { label: 'Q1 26', value: 4.2 },
          { label: 'Q2 26', value: 6.1 },
          { label: 'Q3 26', value: 8.9 },
          { label: 'Q4 26', value: 12.4 },
        ],
      },
      speakerNotes:
        'Walk through the Q3-to-Q4 step-up. Note that Q4 projections already incorporate confirmed retail partner volume.',
    },
    {
      id: 'slide-4',
      layout: 'visual-split',
      kicker: 'Hardware Architecture',
      title: 'Standardized Modular Edge Node',
      subtitle: 'Single-SKU industrial compute module engineered for rapid field replacement.',
      bullets: [
        'Machined aluminum passive thermal chassis rated for 55°C warehouse bays',
        'Hot-swappable dual NVMe telemetry buffer preserves 72 hours offline',
        'Zero-touch cryptographic provisioning cuts site installation from 4 days to 3 hours',
      ],
      imageUrl: '/src/assets/images/slide_visual_hardware_1795677984579.jpg',
      imageCaption: 'Rev-C Industrial Actuator & Telemetry Interface Unit',
      speakerNotes:
        'Emphasize maintainability: field technicians swap the entire module in under 10 minutes without specialized software training.',
    },
    {
      id: 'slide-5',
      layout: 'table',
      kicker: 'Architecture Trade-Offs',
      title: 'Deployment Model Comparison',
      subtitle: 'Evaluation of central cloud, hybrid edge, and fully air-gapped topologies.',
      table: {
        headers: ['Evaluation Criteria', 'Central Cloud', 'Hybrid Edge (Recommended)', 'Air-Gapped On-Prem'],
        rows: [
          ['Round-Trip Latency', '140–220 ms', '35–45 ms', '20–30 ms'],
          ['Outage Continuity', 'Degraded', '72h Full Local', 'Indefinite'],
          ['3-Year TCO (14 Hubs)', '$4.8M', '$3.1M', '$5.9M'],
          ['Fleet Firmware Sync', 'Instant', 'Automated Canary', 'Manual Site Visit'],
        ],
      },
      callout: 'Hybrid Edge delivers 90% of air-gapped resilience at 52% lower three-year total cost.',
      speakerNotes:
        'If finance asks why we skipped full air-gapped, point to the $2.8M delta in three-year TCO driven by manual firmware maintenance.',
    },
    {
      id: 'slide-6',
      layout: 'process',
      kicker: '2027 Execution Plan',
      title: 'Phased 14-Hub Rollout Schedule',
      subtitle: 'Controlled regional waves ensure zero disruption to peak fulfillment SLAs.',
      steps: [
        {
          number: '01',
          title: 'Q1 · Tooling Lock',
          description: 'Finalize Rev-C hardware procurement and automated canary telemetry pipeline.',
        },
        {
          number: '02',
          title: 'Q2 · Wave 1 (4 Hubs)',
          description: 'Deploy Chicago, Rotterdam, Singapore, and Dallas flagship facilities.',
        },
        {
          number: '03',
          title: 'Q3 · Wave 2 (6 Hubs)',
          description: 'Complete Tier-1 regional corridors ahead of Q4 seasonal surge.',
        },
        {
          number: '04',
          title: 'Q4 · Full Fleet',
          description: 'Cut over remaining 4 hubs and retire legacy cloud polling gateways.',
        },
      ],
      speakerNotes:
        'Confirm that Wave 1 completes before June so operational lessons feed directly into Wave 2.',
    },
    {
      id: 'slide-7',
      layout: 'quote',
      kicker: 'Closing Thesis',
      title: 'Deterministic Execution',
      quote: 'Moving intelligence to the physical edge turns network volatility from an operational crisis into a routine background event.',
      attribution: '2027 Infrastructure Steering Committee · Decision Requested: Approve $1.4M Wave 1 Capex',
      speakerNotes:
        'Close cleanly and open the floor for Wave 1 capital allocation questions.',
    },
  ],
};
