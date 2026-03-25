export const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Anomalies', path: '/anomalies' },
];

export const chartData = [
  { name: 'Mar 01', cost: 12400, forecast: 11950 },
  { name: 'Mar 05', cost: 13120, forecast: 12640 },
  { name: 'Mar 10', cost: 12860, forecast: 12950 },
  { name: 'Mar 15', cost: 14480, forecast: 13420 },
  { name: 'Mar 20', cost: 15310, forecast: 13990 },
  { name: 'Mar 25', cost: 14990, forecast: 14550 },
  { name: 'Mar 30', cost: 16740, forecast: 15110 },
];

export const anomalyRows = [
  {
    id: 'anom-1',
    date: '2026-03-18',
    service: 'Amazon EC2',
    cost: '$4,980',
    anomalyScore: '0.92',
    explanation: 'Spike detected after a sudden compute scale-out.',
    severity: 'high',
  },
  {
    id: 'anom-2',
    date: '2026-03-21',
    service: 'Amazon RDS',
    cost: '$2,210',
    anomalyScore: '0.74',
    explanation: 'Database cost deviated from rolling baseline.',
    severity: 'medium',
  },
  {
    id: 'anom-3',
    date: '2026-03-24',
    service: 'AWS Lambda',
    cost: '$890',
    anomalyScore: '0.63',
    explanation: 'Invocation burst was higher than the prior 14-day trend.',
    severity: 'medium',
  },
  {
    id: 'anom-4',
    date: '2026-03-27',
    service: 'Amazon S3',
    cost: '$640',
    anomalyScore: '0.51',
    explanation: 'Storage growth crossed the expected utilization band.',
    severity: 'low',
  },
];

export const metricCards = [
  {
    label: 'Monthly Spend',
    value: '$58.7K',
    change: '+8.2%',
    trend: 'up',
  },
  {
    label: 'Potential Savings',
    value: '$9.4K',
    change: '+2.1%',
    trend: 'up',
  },
  {
    label: 'Active Alerts',
    value: '14',
    change: '-3 today',
    trend: 'down',
  },
  {
    label: 'Synced Accounts',
    value: '07',
    change: 'AWS primary connected',
    trend: 'neutral',
  },
];

export const anomalyInsights = [
  {
    title: 'Compute drift detected',
    body: 'EC2 workloads in production-east are sustaining an abnormal usage envelope.',
  },
  {
    title: 'Database cost baseline shifted',
    body: 'RDS storage and I/O climbed faster than the weekly forecast window.',
  },
  {
    title: 'Storage expansion under watch',
    body: 'S3 growth is still moderate, but it crossed the normal variance threshold.',
  },
];
