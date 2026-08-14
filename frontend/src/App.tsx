import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { Dashboard } from './components/screens/Dashboard';
import { Orders } from './components/screens/Orders';
import { AddOrder } from './components/screens/AddOrder';
import { EditOrder } from './components/screens/EditOrder';
import { AllStores } from './components/screens/AllStores';
import { CreateStore } from './components/screens/CreateStore';
import { ProductsList } from './components/screens/ProductsList';
import { AddProducts } from './components/screens/AddProducts';
import { EditProduct } from './components/screens/EditProduct';
import { Categories } from './components/screens/Categories';
import { Inventory } from './components/screens/Inventory';
import { Customers } from './components/screens/Customers';
import { Marketing } from './components/screens/Marketing';
import { Delivery } from './components/screens/Delivery';
import { Settings } from './components/screens/Settings';
import { OnboardingStep1 } from './components/screens/OnboardingStep1';
import { OnboardingStep2 } from './components/screens/OnboardingStep2';
import { SignIn } from './components/screens/SignIn';
import { CreateAccount } from './components/screens/CreateAccount';
import { ForgotPassword } from './components/screens/ForgotPassword';
import { ResetPassword } from './components/screens/ResetPassword';
import { StorefrontApp } from './components/storefront/StorefrontApp';

import { useAuth } from './context/AuthContext';
import { ApiError, storesApi, uploadsApi, StoreResponse } from './lib/api';

type Screen =
  | 'dashboard'
  | 'onboarding-1'
  | 'onboarding-2'
  | 'orders-all'
  | 'orders-pending'
  | 'orders-completed'
  | 'orders-add'
  | 'orders-edit'
  | 'stores-all'
  | 'stores-create'
  | 'products-all'
  | 'products-add'
  | 'products-edit'
  | 'products-categories'
  | 'products-inventory'
  | 'customers'
  | 'marketing'
  | 'delivery'
  | 'settings';

export interface Store {
  id: string;
  name: string;
  slug: string;
  color: string;
  logo?: string;
  currency: string;
  businessType?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
}

type DraftStore = {
  name: string;
  category: string;
  color: string;
  currency?: string;
  phone?: string;
  storeLink?: string;
  storeLinkTouched?: boolean;
};

type Draft = {
  store: DraftStore;
  products: any[];
};

const DRAFT_KEY = 'manyorder_draft_v1';

/** Screens a STAFF account must not reach (Module 1 RBAC). The API enforces this too. */
const STAFF_BLOCKED_SCREENS: Screen[] = [
  'stores-create',
  'settings',
  'delivery',
  'marketing',
  'customers',
  'products-add',
  'products-edit',
  'orders-add',
  'orders-edit',
];

/** The `?screen=` value for a screen, or null when it carries none (keeps `/app`
 *  clean for the default, and onboarding is store-state-driven, not URL-restored). */
function paramForScreen(screen: Screen): string | null {
  return screen === 'dashboard' || screen === 'onboarding-1' || screen === 'onboarding-2'
    ? null
    : screen;
}

/**
 * Map a `?screen=` value (from a refresh, deep-link, or Back/Forward) to the
 * screen to actually show. The switch-based screens live under one route, so
 * this restores the current screen from the URL — with a few values deliberately
 * not restored as-is:
 *   - onboarding is driven by store state, not the URL;
 *   - orders-edit / products-edit need a selected record id the URL doesn't
 *     carry, so with no id in state they fall back to their list;
 *   - a staff account can never land on an owner-only screen via a stale/hand-
 *     crafted URL.
 * Anything unknown falls through to the dashboard (renderScreen's default too).
 */
function resolveScreen(
  raw: string | null,
  isStaff: boolean,
  editingOrderId: number | null,
  editingProductId: number | null,
): Screen {
  if (!raw) return 'dashboard';
  if (raw === 'onboarding-1' || raw === 'onboarding-2') return 'dashboard';
  if (isStaff && STAFF_BLOCKED_SCREENS.includes(raw as Screen)) return 'dashboard';
  if (raw === 'orders-edit' && editingOrderId == null) return 'orders-all';
  if (raw === 'products-edit' && editingProductId == null) return 'products-all';
  return raw as Screen;
}

function getDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function setDraft(d: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function toStore(s: StoreResponse): Store {
  return {
    id: String(s.id),
    name: s.name,
    slug: s.slug,
    color: s.themeColor || '#000000',
    logo: s.logoUrl || undefined,
    currency: (s.currency || 'SGD').toLowerCase(),
    businessType: s.businessType,
    contactEmail: s.email,
    phone: s.phone,
  };
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/** The authenticated merchant/staff dashboard (legacy screen-switcher, now JWT + REST). */
function MerchantApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaff = user?.role === 'STAFF';

  const handleSignOut = () => {
    logout();
    navigate('/signin');
  };

  // The active screen is mirrored into `?screen=` so a refresh/Back restores it
  // (the two effects below keep URL and state in sync). Restore it here on first
  // load — editingOrderId is always null at mount, so an orders-edit URL falls
  // back to its list.
  const [activeScreen, setActiveScreen] = useState<Screen>(() =>
    resolveScreen(searchParams.get('screen'), isStaff, null, null),
  );

  const [stores, setStores] = useState<Store[]>([]);
  const [storeLimit, setStoreLimit] = useState(3);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeUnavailable, setStoreUnavailable] = useState(false);
  // The onboarding logo pick, held here (not in the localStorage draft — a File
  // can't be serialized) so it survives the step 1 → step 2 transition and is
  // uploaded only when the store is actually created.
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  // The store is created for real when step 1 completes (so step 2 saves real
  // products against a real store, the same flow as the dashboard). Its id is
  // held here so a Back to step 1 updates that store instead of creating a
  // second one, and so step 2 can render against it.
  const [onboardingStoreId, setOnboardingStoreId] = useState<string | null>(null);

  // --- Screen <-> URL sync (single-route screen-switcher) ---
  // State is the source of truth for what's rendered; the URL mirrors it so a
  // refresh restores the screen and Back/Forward walk screen-to-screen.
  const firstUrlSync = useRef(true);

  // State -> URL. New screens PUSH a history entry (so Back returns to the prior
  // screen); the initial mount only normalises the URL with REPLACE (e.g. an
  // orders-edit reload rewritten to orders-all) so we don't seed junk history.
  useEffect(() => {
    const desired = paramForScreen(activeScreen);
    const current = searchParams.get('screen');
    const replace = firstUrlSync.current;
    firstUrlSync.current = false;
    if ((desired ?? null) === (current ?? null)) return; // already in sync
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (desired) next.set('screen', desired);
        else next.delete('screen');
        return next;
      },
      { replace },
    );
    // Only react to activeScreen changes; reading searchParams here must not
    // re-trigger this effect or a Back would be pushed straight back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen]);

  // URL -> state, for Back/Forward only (the initial URL is already applied by
  // the initializer above). Skips onboarding, which is store-state-driven.
  const mountedUrlSync = useRef(false);
  useEffect(() => {
    if (!mountedUrlSync.current) {
      mountedUrlSync.current = true;
      return;
    }
    if (activeScreen === 'onboarding-1' || activeScreen === 'onboarding-2') return;
    const target = resolveScreen(searchParams.get('screen'), isStaff, editingOrderId, editingProductId);
    setActiveScreen((current) => (current === target ? current : target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const refreshStores = async (silent = false) => {
    if (!user) return;
    // A silent refresh (e.g. after saving a Settings card) keeps the current
    // screen mounted so inline confirmations survive; it just re-syncs the
    // store list. A normal refresh shows the full-screen loading state.
    if (!silent) setLoading(true);
    setStoreUnavailable(false);
    try {
      let mapped: Store[] = [];
      if (isStaff) {
        if (user.staffStoreId != null) {
          try {
            const store = await storesApi.get(user.staffStoreId);
            mapped = [toStore(store)];
            setStoreLimit(1);
          } catch (e) {
            // Store archived (or access revoked): lock the staff account out
            // gracefully instead of erroring on a store that no longer exists.
            if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
              setStoreUnavailable(true);
            } else {
              throw e;
            }
          }
        }
      } else {
        const response = await storesApi.list();
        mapped = response.stores.map(toStore);
        setStoreLimit(response.limit);
      }

      setStores(mapped);

      setActiveStoreId((current) =>
        current && mapped.some((s) => s.id === current) ? current : mapped[0]?.id ?? null,
      );

      // Merchant with no stores yet -> onboarding wizard (account first, store second).
      if (!isStaff && mapped.length === 0) {
        setActiveScreen('onboarding-1');
      } else {
        setActiveScreen((current) =>
          current === 'onboarding-1' || current === 'onboarding-2' ? 'dashboard' : current,
        );
      }
    } catch (e: any) {
      // A 401 already triggered a sign-out redirect in the API layer. For any
      // other failure, surface it as an inline state instead of a native alert()
      // and don't leave a half-rendered shell with no stores.
      if (!(e instanceof ApiError && e.status === 401)) {
        console.error('LOAD STORES ERROR:', e);
        setStoreUnavailable(true);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const activeStore = useMemo(
    () => stores.find((s) => s.id === activeStoreId) || null,
    [stores, activeStoreId],
  );

  const createStoreOnServer = async (draft: DraftStore, logoFile?: File | null): Promise<Store> => {
    // Deferred logo upload: the file only reaches the image host now, as part of
    // creating the store, so an abandoned onboarding never leaves an orphan.
    let logoUrl: string | undefined;
    if (logoFile) {
      logoUrl = (await uploadsApi.logo(logoFile)).url;
    }
    const created = await storesApi.create({
      // No silent default: Create Store now requires a non-empty business name
      // client-side, and the backend enforces @NotBlank as the final guard.
      storeName: draft.name?.trim() || '',
      slug: draft.storeLink?.trim() ? slugify(draft.storeLink) : undefined,
      businessType: draft.category || undefined,
      currency: (draft.currency || 'sgd').toUpperCase(),
      themeColor: draft.color || '#000000',
      logoUrl,
      storePhone: draft.phone || undefined,
    });
    return toStore(created);
  };

  // Re-entry from step 2 -> step 1 -> Continue: update the store we already
  // created rather than creating a second one. The logo is only re-uploaded when
  // a genuinely new file was picked (CreateStore re-emits the same File reference
  // when the logo is untouched, so reference-equality detects a real change).
  const updateStoreOnServer = async (storeId: string, draft: DraftStore, logoFile?: File | null): Promise<Store> => {
    let logoUrl: string | undefined;
    if (logoFile && logoFile !== pendingLogoFile) {
      logoUrl = (await uploadsApi.logo(logoFile)).url;
    }
    const updated = await storesApi.update(Number(storeId), {
      storeName: draft.name?.trim() || '',
      slug: draft.storeLink?.trim() ? slugify(draft.storeLink) : undefined,
      businessType: draft.category || undefined,
      currency: (draft.currency || 'sgd').toUpperCase(),
      themeColor: draft.color || '#000000',
      storePhone: draft.phone || undefined,
      logoUrl, // undefined leaves the existing logo unchanged
    });
    return toStore(updated);
  };

  // Onboarding step 1 -> create the store for real now, then continue to the
  // products step so it saves real products against a real store (the same flow
  // as the dashboard). A Back + Continue updates that store, never duplicating it.
  const handleOnboardingStoreDraft = async (data: DraftStore & { logoFile?: File | null }) => {
    const { logoFile, ...store } = data;
    // Persist the store fields locally so a Back to step 1 repopulates the form.
    setDraft({ store, products: [] });
    try {
      if (onboardingStoreId) {
        const updated = await updateStoreOnServer(onboardingStoreId, store, logoFile);
        setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setActiveStoreId(updated.id);
        if (logoFile) setPendingLogoFile(logoFile);
      } else {
        const created = await createStoreOnServer(store, logoFile);
        setOnboardingStoreId(created.id);
        setStores((prev) => [...prev, created]);
        setActiveStoreId(created.id);
        setPendingLogoFile(logoFile ?? null);
      }
      setActiveScreen('onboarding-2');
    } catch (e: any) {
      // Stay on step 1 and surface the error (e.g. 409 slug already taken).
      alert(e instanceof ApiError ? e.message : 'Store create failed. Check console.');
    }
  };

  // Onboarding done (Skip or Finish): the store and any products are already
  // persisted, so this just clears the draft state and lands on the dashboard.
  const finalizeOnboarding = () => {
    clearDraft();
    setPendingLogoFile(null);
    setOnboardingStoreId(null);
    setActiveScreen('dashboard');
  };

  // In-dashboard Create Store (stores 2-3) -> no products step, create directly.
  const handleDirectStoreCreate = async (data: DraftStore & { logoFile?: File | null }) => {
    if (stores.length >= storeLimit) {
      alert(`Store limit reached (${stores.length} of ${storeLimit}).`);
      setActiveScreen('stores-all');
      return;
    }
    const { logoFile, ...store } = data;
    try {
      const newStore = await createStoreOnServer(store, logoFile);
      setStores((prev) => [...prev, newStore]);
      setActiveStoreId(newStore.id);
      setActiveScreen('dashboard');
    } catch (e: any) {
      alert(e instanceof ApiError ? e.message : 'Store create failed. Check console.');
    }
  };

  const handleStoreUpdate = (updated: Partial<Store> & { id: string }) => {
    setStores((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  };

  // After archiving: leave Settings, then reload. refreshStores re-selects a
  // remaining store, or drops to onboarding if that was the owner's last one.
  const handleStoreArchived = () => {
    setActiveScreen('dashboard');
    void refreshStores();
  };

  const navigateScreen = (screen: string) => {
    if (isStaff && STAFF_BLOCKED_SCREENS.includes(screen as Screen)) {
      alert('Staff accounts can view orders and products only.');
      return;
    }
    setActiveScreen(screen as Screen);
  };

  const renderScreen = () => {
    if (loading) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading your stores…</p>
        </div>
      );
    }

    if (isStaff && storeUnavailable) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', padding: '24px' }}>
          <h2>This store is no longer available</h2>
          <p className="text-small" style={{ color: 'var(--text-secondary)', maxWidth: '420px' }}>
            The store you're assigned to has been closed by its owner. Please contact them if you
            think this is a mistake.
          </p>
        </div>
      );
    }

    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard />;

      case 'onboarding-1':
        return (
          <OnboardingStep1 canExit={false} onExit={() => setActiveScreen('dashboard')}>
            <CreateStore
              onComplete={handleOnboardingStoreDraft}
              onNavigate={navigateScreen as any}
              onSignOut={handleSignOut}
              initialLogoFile={pendingLogoFile}
              initialData={getDraft()?.store}
            />
          </OnboardingStep1>
        );

      case 'onboarding-2':
        return activeStore ? (
          <OnboardingStep2 onSkip={finalizeOnboarding} onBack={() => setActiveScreen('onboarding-1')}>
            <AddProducts
              storeId={Number(activeStore.id)}
              storeName={activeStore.name}
              storeLink={activeStore.slug}
              storeColor={activeStore.color}
              currency={activeStore.currency}
              showHeader={false}
              onNavigate={navigateScreen as any}
              onFinish={finalizeOnboarding}
            />
          </OnboardingStep2>
        ) : (
          <Dashboard />
        );

      case 'orders-all':
      case 'orders-pending':
      case 'orders-completed':
        return activeStore ? (
          <Orders
            store={activeStore}
            onNavigate={navigateScreen as any}
            initialStatus={
              activeScreen === 'orders-pending' ? 'PENDING'
              : activeScreen === 'orders-completed' ? 'COMPLETED'
              : 'ALL'
            }
            canEdit={!isStaff}
            onEditOrder={(orderId) => {
              setEditingOrderId(orderId);
              setActiveScreen('orders-edit');
            }}
          />
        ) : (
          <Dashboard />
        );
      case 'orders-add':
        return activeStore ? (
          <AddOrder store={activeStore} onNavigate={navigateScreen as any} />
        ) : (
          <Dashboard />
        );
      case 'orders-edit':
        return activeStore && editingOrderId != null ? (
          <EditOrder store={activeStore} orderId={editingOrderId} onNavigate={navigateScreen as any} />
        ) : (
          <Dashboard />
        );

      case 'stores-all':
        return (
          <AllStores
            stores={stores}
            activeStoreId={activeStoreId || ''}
            onStoreChange={setActiveStoreId as any}
            onNavigate={navigateScreen as any}
            storeLimit={storeLimit}
          />
        );

      case 'stores-create':
        return <CreateStore onComplete={handleDirectStoreCreate} onNavigate={navigateScreen as any} />;

      case 'products-all':
        return activeStore ? (
          <ProductsList
            storeId={Number(activeStore.id)}
            currency={activeStore.currency}
            onNavigate={navigateScreen as any}
            onEditProduct={(productId) => {
              setEditingProductId(productId);
              setActiveScreen('products-edit');
            }}
          />
        ) : (
          <Dashboard />
        );
      case 'products-add':
        return activeStore ? (
          <AddProducts
            storeId={Number(activeStore.id)}
            storeName={activeStore.name}
            storeColor={activeStore.color}
            currency={activeStore.currency}
            onNavigate={navigateScreen as any}
          />
        ) : (
          <Dashboard />
        );
      case 'products-edit':
        return activeStore && editingProductId != null ? (
          <EditProduct
            storeId={Number(activeStore.id)}
            productId={editingProductId}
            storeName={activeStore.name}
            storeSlug={activeStore.slug}
            storeColor={activeStore.color}
            currency={activeStore.currency}
            onNavigate={navigateScreen as any}
          />
        ) : (
          <Dashboard />
        );
      case 'products-categories':
        return activeStore ? <Categories storeId={Number(activeStore.id)} /> : <Dashboard />;
      case 'products-inventory':
        return <Inventory />;

      case 'customers':
        return <Customers />;
      case 'marketing':
        return <Marketing currency={activeStore?.currency} />;

      case 'delivery':
        return activeStore ? (
          <Delivery
            storeId={Number(activeStore.id)}
            currency={activeStore.currency}
            onSaved={() => refreshStores(true)}
          />
        ) : (
          <Dashboard />
        );

      case 'settings':
        return activeStore ? (
          <Settings
            storeId={Number(activeStore.id)}
            onSaved={() => refreshStores(true)}
            onArchived={handleStoreArchived}
          />
        ) : (
          <Dashboard />
        );

      default:
        return <Dashboard />;
    }
  };

  const content = renderScreen();

  const isOnboarding = activeScreen === 'onboarding-1' || activeScreen === 'onboarding-2';
  if (isOnboarding) return content;

  return (
    <AppShell
      activeItem={activeScreen}
      onNavigate={navigateScreen}
      stores={stores}
      activeStoreId={activeStoreId || ''}
      onStoreChange={setActiveStoreId as any}
    >
      {content}
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/signin"
        element={
          <RedirectIfAuthed>
            <SignIn />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <CreateAccount />
          </RedirectIfAuthed>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <MerchantApp />
          </RequireAuth>
        }
      />
      {/* Public storefront — customer-facing, no auth, no dashboard chrome.
          Matched after the static routes above; a reserved-slug guard keeps
          store links from shadowing them. */}
      <Route path="/:slug/*" element={<StorefrontApp />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
