import { useEffect, useRef, useState } from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  subItems?: { label: string; id: string }[];
  activeSubItem?: string;
  onSubItemClick?: (id: string) => void;
}

export function NavItem({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  subItems,
  activeSubItem,
  onSubItemClick 
}: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Keep the latest expanded state in a ref so the always-on listener below
  // reads it without needing to re-subscribe on every toggle.
  const expandedRef = useRef(isExpanded);
  expandedRef.current = isExpanded;

  const handleMainClick = () => {
    if (subItems) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  // Collapse the submenu when the user clicks anywhere outside this item. The
  // listener is registered once and always on (guarded by the ref), so it can
  // never miss a menu that was already open — this is what keeps the behavior
  // consistent across every expandable nav item.
  useEffect(() => {
    const onDocPointerDown = (e: MouseEvent) => {
      if (expandedRef.current && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, []);

  const isAnySubItemActive = subItems?.some(item => item.id === activeSubItem);
  const isActive = active || isAnySubItemActive;

  // Active → solid black fill with white text/icon (the primary "you are here"
  // marker). Hover → subtle fill + primary text. Idle → transparent + secondary.
  const background = isActive
    ? 'var(--primary-solid)'
    : isHovered
      ? 'var(--bg-card-subtle)'
      : 'transparent';
  const color = isActive
    ? 'var(--text-on-dark)'
    : isHovered
      ? 'var(--text-primary)'
      : 'var(--text-secondary)';

  return (
    <div ref={rootRef}>
      <button
        onClick={handleMainClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px',
          border: 'none',
          borderRadius: 'var(--radius-field)',
          cursor: 'pointer',
          background,
          color,
          transition: 'all 0.15s ease',
          fontSize: '13px',
          fontWeight: isActive ? 600 : 500,
          textAlign: 'left',
        }}
      >
        <Icon size={18} color="currentColor" />
        <span style={{ flex: 1 }}>{label}</span>
        {subItems && (
          <ChevronDown
            size={16}
            style={{
              color: isActive ? 'var(--text-on-dark)' : 'var(--text-muted)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        )}
      </button>

      {/* Sub Items — indented past a vertical guide line so the nesting reads
          at a glance; children use smaller, lighter text than the parent. */}
      {subItems && isExpanded && (
        <div
          style={{
            marginTop: '8px',
            marginBottom: '6px',
            marginLeft: '20px',
            paddingLeft: '12px',
            borderLeft: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {subItems.map((subItem) => (
            <SubNavItem
              key={subItem.id}
              label={subItem.label}
              active={activeSubItem === subItem.id}
              onClick={() => onSubItemClick?.(subItem.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Sub Navigation Item Component
interface SubNavItemProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SubNavItem({ label, active, onClick }: SubNavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '9px 10px',
        border: 'none',
        borderRadius: 'var(--radius-field)',
        cursor: 'pointer',
        background: active || isHovered ? 'var(--bg-card-subtle)' : 'transparent',
        color: active || isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.15s ease',
        fontSize: '12.5px',
        fontWeight: active ? 500 : 400,
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
    </button>
  );
}