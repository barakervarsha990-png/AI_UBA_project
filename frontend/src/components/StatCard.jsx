const StatCard = ({ label, value, accent, icon: Icon }) => (
  <div className="card stat-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span className="label">{label}</span>
      {Icon && <Icon size={16} color={accent || 'var(--text-mid)'} />}
    </div>
    <span className="value mono" style={{ color: accent || 'var(--text-hi)' }}>{value}</span>
  </div>
);

export default StatCard;
