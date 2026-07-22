import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { Dashboard } from './components/screens/Dashboard';
import { Orders } from './components/screens/Orders';
import { AddOrder } from './components/screens/AddOrder';
import { AllStores } from './components/screens/AllStores';
import { CreateStore } from './components/screens/CreateStore';
import { ProductsList } from './components/screens/ProductsList';
import { AddProducts } from './components/screens/AddProducts';
import { EditProduct } from './components/screens/EditProduct';
import { Categories } from './components/screens/Categories';
import { Inventory } from './components/screens/Inventory';
import { Customers } from './components/screens/Customers';
import { Marketing } from './components/screens/Marketing';
import { Settings } from './components/screens/Settings';
import { OnboardingStep1 } from './components/screens/OnboardingStep1';
import { OnboardingStep2 } from './components/screens/OnboardingStep2';
import { SignIn } from './components/screens/SignIn';
import { CreateAccount } from './components/screens/CreateAccount';
import { SignInToStore } from './components/screens/SignInToStore';

import { useAuth } from './context/AuthContext';
import { ApiError, storesApi, StoreResponse } from './lib/api';

type Screen =
  | 'dashboard'
  | 'onboarding-1'
  | 'onboarding-2'
  | 'orders-all'
  | 'orders-pending'
  | 'orders-completed'
  | 'orders-add'
  | 'stores-all'
  | 'stores-create'
  | 'products-all'
  | 'products-add'
  | 'products-edit'
  | 'products-categories'
  | 'products-inventory'
  | 'customers'
  | 'marketing'
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
  logo?: string;
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
const PREFER_STORE_KEY = 'manyorder_prefer_store';

/** Screens a STAFF account must not reach (Module 1 RBAC). The API enforces this too. */
const STAFF_BLOCKED_SCREENS: Screen[] = [
  'stores-create',
  'settings',
  'marketing',
  'customers',
  'products-add',
  'products-edit',
  'orders-add',
];

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
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isStaff = user?.role === 'STAFF';

  const [activeScreen, setActiveScreen] = useState<Screen>(() => {
    const screen = new URLSearchParams(location.search).get('screen') as Screen | null;
    return screen && screen !== 'onboarding-1' && screen !== 'onboarding-2' ? screen : 'dashboard';
  });

  const [stores, setStores] = useState<Store[]>([]);
  const [storeLimit, setStoreLimit] = useState(3);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStores = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let mapped: Store[] = [];
      if (isStaff) {
        if (user.staffStoreId != null) {
          const store = await storesApi.get(user.staffStoreId);
          mapped = [toStore(store)];
          setStoreLimit(1);
        }
      } else {
        const response = await storesApi.list();
        mapped = response.stores.map(toStore);
        setStoreLimit(response.limit);
      }

      setStores(mapped);

      const preferred = sessionStorage.getItem(PREFER_STORE_KEY);
      const preferredStore = preferred ? mapped.find((s) => s.slug === preferred) : null;
      if (preferredStore) {
        sessionStorage.removeItem(PREFER_STORE_KEY);
        setActiveStoreId(preferredStore.id);
      } else {
        setActiveStoreId((current) =>
          current && mapped.some((s) => s.id === current) ? current : mapped[0]?.id ?? null,
        );
      }

      // Merchant with no stores yet -> onboarding wizard (account first, store second).
      if (!isStaff && mapped.length === 0) {
        setActiveScreen('onboarding-1');
      } else {
        setActiveScreen((current) =>
          current === 'onboarding-1' || current === 'onboarding-2' ? 'dashboard' : current,
        );
      }
    } catch (e: any) {
      console.error('LOAD STORES ERROR:', e);
      alert(e?.message || 'Could not load your stores.');
    } finally {
      setLoading(false);
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

  const createStoreOnServer = async (draft: DraftStore): Promise<Store> => {
    const created = await storesApi.create({
      storeName: draft.name?.trim() || 'My Store',
      slug: draft.storeLink?.trim() ? slugify(draft.storeLink) : undefined,
      businessType: draft.category || undefined,
      currency: (draft.currency || 'sgd').toUpperCase(),
      themeColor: draft.color || '#000000',
      storePhone: draft.phone || undefined,
    });
    return toStore(created);
  };

  // Onboarding step 1 -> stash draft locally, continue to products step.
  const handleOnboardingStoreDraft = (data: DraftStore) => {
    setDraft({ store: data, products: [] });
    setActiveScreen('onboarding-2');
  };

  // Onboarding step 2 (or skip) -> create the store for real.
  const finalizeOnboarding = async () => {
    const draft = getDraft();
    if (!draft) {
      setActiveScreen('dashboard');
      return;
    }
    try {
      const newStore = await createStoreOnServer(draft.store);
      clearDraft(); // drafted products are wired to the Products API in Batch 2
      setStores((prev) => [...prev, newStore]);
      setActiveStoreId(newStore.id);
      setActiveScreen('dashboard');
    } catch (e: any) {
      alert(e instanceof ApiError ? e.message : 'Store create failed. Check console.');
      if (e instanceof ApiError && e.status === 409) setActiveScreen('onboarding-1');
    }
  };

  // In-dashboard Create Store (stores 2-3) -> no products step, create directly.
  const handleDirectStoreCreate = async (data: DraftStore) => {
    if (stores.length >= storeLimit) {
      alert(`Store limit reached (${stores.length} of ${storeLimit}).`);
      setActiveScreen('stores-all');
      return;
    }
    try {
      const newStore = await createStoreOnServer(data);
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

  const navigateScreen = (screen: string) => {
    if (isStaff && STAFF_BLOCKED_SCREENS.includes(screen as Screen)) {
      alert('Staff accounts can view orders and products only.');
      return;
    }
    if (screen === 'stores-signin') {
      navigate(`/store-signin${activeStore ? `?store=${activeStore.slug}` : ''}`);
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

    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard />;

      case 'onboarding-1':
        return (
          <OnboardingStep1 canExit={false} onExit={() => setActiveScreen('dashboard')}>
            <CreateStore
              onComplete={handleOnboardingStoreDraft}
              onNavigate={navigateScreen as any}
              initialData={getDraft()?.store}
            />
          </OnboardingStep1>
        );

      case 'onboarding-2':
        return (
          <OnboardingStep2 onSkip={finalizeOnboarding} onBack={() => setActiveScreen('onboarding-1')}>
            <AddProducts
              storeName={getDraft()?.store?.name || ''}
              storeLink={getDraft()?.store?.storeLink || ''}
              storeColor={getDraft()?.store?.color || '#000000'}
              currency={getDraft()?.store?.currency || 'sgd'}
              showHeader={false}
              onComplete={(products) => {
                const draft = getDraft();
                if (draft) setDraft({ ...draft, products });
                finalizeOnboarding();
              }}
            />
          </OnboardingStep2>
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
        return <ProductsList onNavigate={navigateScreen as any} />;
      case 'products-add':
        return activeStore ? (
          <AddProducts storeName={activeStore.name} storeColor={activeStore.color} currency={activeStore.currency} />
        ) : (
          <Dashboard />
        );
      case 'products-edit':
        return activeStore ? (
          <EditProduct
            storeName={activeStore.name}
            storeColor={activeStore.color}
            currency={activeStore.currency}
            onNavigate={navigateScreen as any}
          />
        ) : (
          <Dashboard />
        );
      case 'products-categories':
        return <Categories />;
      case 'products-inventory':
        return <Inventory />;

      case 'customers':
        return <Customers />;
      case 'marketing':
        return <Marketing />;

      case 'settings':
        return activeStore ? (
          <Settings storeId={Number(activeStore.id)} onSaved={refreshStores} />
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
      <Route path="/store-signin" element={<SignInToStore />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <MerchantApp />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
