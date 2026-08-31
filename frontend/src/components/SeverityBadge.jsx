const SeverityBadge = ({ level }) => {
  const cls = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  }[level] || 'badge-low';

  return <span className={`badge ${cls}`}>{level}</span>;
};

export default SeverityBadge;
