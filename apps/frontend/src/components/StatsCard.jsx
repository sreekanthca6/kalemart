const themes = {
  green:  { bg: '#f0faf4', num: '#1b8a5f', dot: '#34c759' },
  amber:  { bg: '#fff8ee', num: '#b45309', dot: '#ff9f0a' },
  red:    { bg: '#fff0ef', num: '#c0392b', dot: '#ff3b30' },
  indigo: { bg: '#f0f0ff', num: '#3730a3', dot: '#6366f1' },
};

export default function StatsCard({ label, value, sub, color = 'indigo', icon }) {
  const t = themes[color] || themes.indigo;
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200"
      style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8e8e93]">{label}</p>
        {icon && (
          <span className="text-lg" style={{ opacity: 0.5 }}>{icon}</span>
        )}
      </div>
      <p className="text-[38px] font-bold leading-none mt-3 tracking-tight" style={{ color: t.num }}>
        {value ?? '—'}
      </p>
      {sub && (
        <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: '#8e8e93' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: t.dot }} />
          {sub}
        </p>
      )}
    </div>
  );
}
