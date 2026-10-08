// CSS colors let charts follow the selected theme without rebuilding their data.
export const CHART_COLORS = {
  primary: 'rgb(var(--brand-rgb))',
  success: 'rgb(var(--success-rgb))',
  warning: 'rgb(var(--warning-rgb))',
  danger: 'rgb(var(--danger-rgb))',
  info: 'rgb(var(--info-rgb))',
  border: 'rgb(var(--border-rgb))',
  card: 'rgb(var(--card-rgb))'
};

export const READINESS_COLORS = {
  Ready: CHART_COLORS.success,
  'Retest Required': CHART_COLORS.warning,
  'Testing Pending': CHART_COLORS.info,
  'Action Required': CHART_COLORS.danger
};

export const CHART_PALETTE = [
  CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning,
  CHART_COLORS.danger, CHART_COLORS.info, '#a78bfa', '#fb923c'
];