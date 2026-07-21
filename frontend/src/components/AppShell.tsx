import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useMediaQuery } from '../hooks/useMediaQuery';
import logoImage from '../assets/manyorder-logo.png';

interface Store {
  id: string;
  name: string;
  color: string;
  logo?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  activeItem: string;
  onNavigate: (item: string) => void;
  stores: Store[];
  activeStoreId: string;
  onStoreChange: (storeId: string) => void;
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export function AppShell({
  children,
  activeItem,
  onNavigate,
  stores,
  activeStoreId,
  onStoreChange,
}: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeStore = stores.find((s) => s.id === activeStoreId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setIsMobileMenuOpen(false);
    }
  }, [isDesktop]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const openStorePreview = () => {
    const s = stores.find((x) => x.id === activeStoreId);
    if (!s) return;
    const slug = slugify(s.name);
    window.open(`https://manyorder.app/${slug}`, '_blank');
  };

  const copyStoreLink = () => {
    const s = stores.find((x) => x.id === activeStoreId);
    if (!s) return;

    const slug = slugify(s.name);
    const url = `https://manyorder.app/${slug}`;

    // try modern clipboard API first
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => alert('Store link copied to clipboard!'))
        .catch(() => {
          // fallback if permissions blocked
          const textarea = document.createElement('textarea');
          textarea.value = url;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            alert('Store link copied to clipboard!');
          } catch {
            alert(`Copy this link: ${url}`);
          }
          document.body.removeChild(textarea);
        });
      return;
    }

    // fallback method
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('Store link copied to clipboard!');
    } catch {
      alert(`Copy this link: ${url}`);
    }
    document.body.removeChild(textarea);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <Sidebar
          activeItem={activeItem}
          onNavigate={onNavigate}
          stores={stores}
          activeStoreId={activeStoreId}
          onStoreChange={onStoreChange}
          isOpen={isSidebarOpen}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {!isDesktop && isMobileMenuOpen && (
        <>
          <div
            onClick={toggleMobileMenu}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 50,
            }}
          >
            <Sidebar
              activeItem={activeItem}
              onNavigate={(item) => {
                onNavigate(item);
                setIsMobileMenuOpen(false);
              }}
              stores={stores}
              activeStoreId={activeStoreId}
              onStoreChange={onStoreChange}
              isOpen={true}
            />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top Bar */}
        <div
          style={{
            height: '56px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '16px',
          }}
        >
          {/* Mobile Menu Button */}
          {!isDesktop && (
            <button
              onClick={toggleMobileMenu}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
              }}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          {/* ManyOrder Logo and Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={logoImage}
              alt="ManyOrder"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
              }}
            />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>ManyOrder</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Preview and Copy Link Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={openStorePreview}
              style={{
                height: '36px',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-app)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {isDesktop ? 'Preview store page' : 'Preview'}
            </button>

            <button
              onClick={copyStoreLink}
              style={{
                height: '36px',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#000000',
                color: 'white',
                border: '1px solid #000000',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1a1a1a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#000000';
              }}
            >
              {isDesktop ? 'Copy store link' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--bg-app)',
            padding: '24px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
