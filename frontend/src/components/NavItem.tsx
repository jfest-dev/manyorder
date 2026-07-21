import { useState } from 'react';
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

  const handleMainClick = () => {
    if (subItems) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  const isAnySubItemActive = subItems?.some(item => item.id === activeSubItem);

  return (
    <div>
      <button
        onClick={handleMainClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          background: active || isAnySubItemActive
            ? 'var(--primary-solid)' 
            : isHovered 
              ? 'var(--bg-card-subtle)' 
              : 'transparent',
          color: active || isAnySubItemActive ? 'var(--text-on-dark)' : 'var(--text-primary)',
          transition: 'all 0.15s ease',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <Icon size={18} />
        <span style={{ flex: 1 }}>{label}</span>
        {subItems && (
          <ChevronDown 
            size={16} 
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }} 
          />
        )}
      </button>

      {/* Sub Items */}
      {subItems && isExpanded && (
        <div style={{ marginTop: '4px', marginLeft: '30px' }}>
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
        padding: '8px 12px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        background: active 
          ? 'var(--bg-card-subtle)' 
          : isHovered 
            ? 'var(--bg-card-subtle)' 
            : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.15s ease',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
    </button>
  );
}