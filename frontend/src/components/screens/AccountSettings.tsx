import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput } from '../Field';
import { PasswordField } from '../PasswordField';
import { Select } from '../Select';
import { Toast } from '../Toast';
import { accountApi, authApi, ApiError } from '../../lib/api';
import { validatePassword, PASSWORD_RULE_TEXT } from '../../lib/password';
import { useAuth } from '../../context/AuthContext';

const SUCCESS_GREEN = '#16a34a';
const COUNTRY_CODES = ['+65', '+62'];
const COUNTRY_OPTIONS = [
  { value: '+65', label: '+65 (Singapore)' },
  { value: '+62', label: '+62 (Indonesia)' },
];

const sectionCard: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-medium)', padding: '24px',
};
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' };

/** Split a stored phone like "+6591234567" into a known country code + the rest. */
function splitPhone(phone: string | null): { code: string; number: string } {
  if (!phone) return { code: '+65', number: '' };
  const code = COUNTRY_CODES.find((c) => phone.startsWith(c)) ?? '+65';
  return { code, number: phone.startsWith(code) ? phone.slice(code.length).trim() : phone };
}

/** The Settings "Account" tab: the signed-in user's own name, email, phone and password. */
export function AccountSettings() {
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(true);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+65');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Change password (moved here from the store settings).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    let cancelled = false;
    accountApi.me()
      .then((a) => {
        if (cancelled) return;
        setEmail(a.email); setVerified(a.verified); setName(a.fullName);
        const { code, number } = splitPhone(a.phone);
        setCountryCode(code); setPhoneNumber(number);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Could not load your account'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2400); };

  const saveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setSaveError('Name is required.'); return; }
    setSaving(true); setSaveError('');
    const digits = phoneNumber.trim();
    const phone = digits ? `${countryCode}${digits}` : '';
    try {
      const updated = await accountApi.updateProfile({ fullName: trimmed, phone });
      setName(updated.fullName);
      const split = splitPhone(updated.phone);
      setCountryCode(split.code); setPhoneNumber(split.number);
      await refreshUser(); // propagate the new name everywhere without re-login
      showToast('Account updated.');
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Could not update your account');
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setResendState('sending');
    try {
      await authApi.resendVerification();
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  const canChangePassword = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;
  const changePassword = async () => {
    setPwError(''); setPwSaved(false);
    const trimmedNew = newPassword.trim();
    const strengthError = validatePassword(trimmedNew);
    if (strengthError) { setPwError(strengthError); return; }
    if (trimmedNew !== confirmPassword.trim()) { setPwError('New passwords do not match.'); return; }
    setPwSaving(true);
    try {
      await accountApi.changePassword(currentPassword.trim(), trimmedNew);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 4000);
    } catch (e) {
      setPwError(e instanceof ApiError && e.status === 403 ? 'Incorrect password.'
        : e instanceof ApiError ? e.message : 'Could not update password');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading your account…</p>;
  if (loadError) return <p className="text-small" style={{ color: 'var(--error-color)' }}>{loadError}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '620px' }}>
      <div style={sectionCard}>
        <h3 style={{ marginBottom: '4px' }}>Your account</h3>
        <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          These details are about you, not any single store.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
          <FieldInput label="Name" value={name} onChange={setName} placeholder="Your name" />

          <div>
            <label className="text-xs" style={labelStyle}>Login email</label>
            <input value={email} readOnly aria-label="Login email"
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-field)', background: 'var(--bg-card-subtle)', color: 'var(--text-secondary)',
                fontSize: '13px', outline: 'none' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
              Changing your login email isn't available yet.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              {verified ? (
                <span className="text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: SUCCESS_GREEN, fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Email verified
                </span>
              ) : (
                <>
                  <span className="text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#B45309', fontWeight: 600 }}>
                    <AlertCircle size={14} /> Email not verified
                  </span>
                  <button type="button" onClick={resend} disabled={resendState !== 'idle'}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)',
                      cursor: resendState === 'idle' ? 'pointer' : 'default', fontSize: '12px', fontWeight: 600 }}>
                    {resendState === 'sent' ? 'Verification email sent' : resendState === 'sending' ? 'Sending…' : 'Resend'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs" style={labelStyle}>Phone (optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
              <Select value={countryCode} onChange={setCountryCode} options={COUNTRY_OPTIONS} ariaLabel="Country code" />
              <input type="tel" placeholder="8123 4567" value={phoneNumber} aria-label="Phone number"
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', fontSize: '13px', outline: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
          <Button variant="primary" onClick={saveProfile} disabled={saving || name.trim().length === 0}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {saveError && <span className="text-small" style={{ color: 'var(--error-color)' }}>{saveError}</span>}
        </div>
      </div>

      <div style={sectionCard}>
        <p className="text-small" style={{ fontWeight: 600, marginBottom: '12px' }}>Change Password</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
          <PasswordField label="Current Password" value={currentPassword}
            onChange={(v) => { setCurrentPassword(v); if (pwError) setPwError(''); }} placeholder="Your current password" />
          <PasswordField label="New Password" value={newPassword}
            onChange={(v) => { setNewPassword(v); if (pwError) setPwError(''); }} placeholder={PASSWORD_RULE_TEXT} />
          <PasswordField label="Confirm New Password" value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); if (pwError) setPwError(''); }} placeholder="Repeat your password" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
          <Button variant="primary" onClick={changePassword} disabled={pwSaving || !canChangePassword}>
            {pwSaving ? 'Updating…' : 'Update password'}
          </Button>
          {pwSaved && <span className="text-small" style={{ color: SUCCESS_GREEN, fontWeight: 500 }}>Password updated</span>}
          {pwError && <span className="text-small" style={{ color: 'var(--error-color)' }}>{pwError}</span>}
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
