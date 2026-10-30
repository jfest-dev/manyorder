import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import { loadCloudflareAnalytics } from './lib/analytics';
import { installZoomLock } from './lib/zoomLock';
import './index.css';

loadCloudflareAnalytics();
installZoomLock();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </AuthProvider>
  </BrowserRouter>,
);
