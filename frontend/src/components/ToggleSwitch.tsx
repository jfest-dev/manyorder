interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * A labelled on/off switch — the standard control for a binary setting (product
 * visibility, pre-order, etc.). The whole row is clickable; the track+knob is a
 * real `role="switch"` button so it stays keyboard- and screen-reader-accessible.
 */
export function ToggleSwitch({ checked, onChange, label, description, disabled }: ToggleSwitchProps) {
  const toggle = () => { if (!disabled) onChange(!checked); };
  return (
    <div
      onClick={toggle}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: disabled ? 'default' : 'pointer' }}
    >
      <span>
        <span className="text-small" style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>{label}</span>
        {description && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        style={{
          flexShrink: 0, width: '44px', height: '26px', borderRadius: '999px', border: 'none', padding: 0,
          background: checked ? 'var(--primary-solid)' : '#D1D5DB',
          position: 'relative', transition: 'background .15s ease',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%', background: 'white',
            transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </div>
  );
}
