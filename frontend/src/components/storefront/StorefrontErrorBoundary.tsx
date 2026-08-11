import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onBackToShop: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors anywhere in the storefront so a bad response shape (or
 * any other render fault) shows a friendly message instead of a blank page.
 * React error boundaries must be class components.
 */
export class StorefrontErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surfaced to the console for debugging; the UI stays graceful.
    console.error('Storefront render error:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onBackToShop();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', gap: '12px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Something went wrong</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '320px' }}>
          We hit a snag displaying this page. Your order, if placed, was still received.
        </div>
        <button
          onClick={this.handleReset}
          style={{ marginTop: '4px', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: 'var(--primary-solid)', color: 'white', fontSize: '14px', fontWeight: 600 }}
        >
          Back to shop
        </button>
      </div>
    );
  }
}
