import { TimeField } from './TimeField';

interface PreorderScheduleFieldsProps {
  date: string;
  onDateChange: (v: string) => void;
  timeStart: string;
  onTimeStartChange: (v: string) => void;
  timeEnd: string;
  onTimeEndChange: (v: string) => void;
}

const fieldLabel: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px',
};
const miniLabel: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px',
};
const dateInput: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', fontSize: '13px',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

/**
 * The pre-order "ready" schedule (date + optional From/Until time range) as one
 * grouped, aligned block — shared by Add and Edit Product so both read the same.
 * Times are 12-hour (TimeField); a single Clear resets both, and the whole group
 * sits in a subtle panel instead of a deep indent.
 */
export function PreorderScheduleFields({
  date, onDateChange, timeStart, onTimeStartChange, timeEnd, onTimeEndChange,
}: PreorderScheduleFieldsProps) {
  const hasTime = !!(timeStart || timeEnd);
  return (
    <div style={{
      background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-medium)', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div>
        <label style={fieldLabel}>Ready date</label>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} style={dateInput} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ ...fieldLabel, marginBottom: 0 }}>
            Ready time <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· optional</span>
          </label>
          {hasTime && (
            <button type="button" onClick={() => { onTimeStartChange(''); onTimeEndChange(''); }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
              Clear
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div>
            <div style={miniLabel}>From</div>
            <TimeField value={timeStart} onChange={onTimeStartChange} ariaLabel="Ready from time" />
          </div>
          <div>
            <div style={miniLabel}>Until</div>
            <TimeField value={timeEnd} onChange={onTimeEndChange} ariaLabel="Ready until time" />
          </div>
        </div>
      </div>
    </div>
  );
}
