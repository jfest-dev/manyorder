import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Tag, Percent, X, Edit2, Trash2, TrendingUp, Award } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { FieldInput } from '../Field';
import { MoneyField } from '../MoneyField';
import { Select } from '../Select';
import { DatePicker } from '../DatePicker';
import { Checkbox } from '../Checkbox';
import { useConfirm } from '../ConfirmDialog';
import { discountsApi, DiscountResponse, DiscountType, DiscountPayload, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';

interface MarketingProps {
  storeId: number;
  /** Store currency, so a fixed-amount discount formats correctly. */
  currency?: string;
}

type Status = 'active' | 'scheduled' | 'expired' | 'inactive';

function statusOf(d: DiscountResponse): Status {
  if (!d.active) return 'inactive';
  const now = Date.now();
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return 'expired';
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return 'scheduled';
  return 'active';
}
const STATUS_META: Record<Status, { label: string; color: string }> = {
  active: { label: 'Active', color: '#10B981' },
  scheduled: { label: 'Scheduled', color: '#2563EB' },
  expired: { label: 'Expired', color: '#DC2626' },
  inactive: { label: 'Inactive', color: '#6B7280' },
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function StatCard({ icon, tint, label, value }: { icon: ReactNode; tint: string; label: string; value: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', background: `${tint}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '20px', fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

interface FormState {
  name: string;
  code: string;
  type: DiscountType;
  value: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  active: boolean;
}
const BLANK: FormState = {
  name: '', code: '', type: 'PERCENTAGE', value: '', usageLimit: '', startDate: '', endDate: '', active: true,
};

export function Marketing({ storeId, currency = 'sgd' }: MarketingProps) {
  const confirm = useConfirm();
  const [discounts, setDiscounts] = useState<DiscountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    discountsApi
      .list(storeId)
      .then((res) => { if (!cancelled) setDiscounts(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load discounts'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  };
  useEffect(load, [storeId]);

  // Summary stats, all derived from the fetched list (no extra backend call).
  const activeCount = useMemo(() => discounts.filter((d) => statusOf(d) === 'active').length, [discounts]);
  const totalRedemptions = useMemo(() => discounts.reduce((s, d) => s + d.usedCount, 0), [discounts]);
  const mostUsed = useMemo(() => {
    if (discounts.length === 0) return null;
    const top = discounts.reduce((a, b) => (b.usedCount > a.usedCount ? b : a));
    return top.usedCount > 0 ? top : null; // no "most-used" until something's been redeemed
  }, [discounts]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(BLANK); setEditingId(null); setFormError(null); setFormOpen(true); };
  const openEdit = (d: DiscountResponse) => {
    setForm({
      name: d.name ?? '', code: d.code, type: d.type, value: String(d.value),
      usageLimit: d.usageLimit != null ? String(d.usageLimit) : '',
      startDate: d.startsAt ? d.startsAt.slice(0, 10) : '',
      endDate: d.endsAt ? d.endsAt.slice(0, 10) : '',
      active: d.active,
    });
    setEditingId(d.id);
    setFormError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    const value = Number(form.value);
    if (!form.code.trim()) { setFormError('Code is required.'); return; }
    if (form.value.trim() === '' || Number.isNaN(value) || value <= 0) { setFormError('Enter a value greater than 0.'); return; }
    if (form.type === 'PERCENTAGE' && value > 100) { setFormError('A percentage discount cannot exceed 100%.'); return; }
    const usageLimit = form.usageLimit.trim() === '' ? null : Number(form.usageLimit);
    if (usageLimit != null && (Number.isNaN(usageLimit) || usageLimit < 0)) { setFormError('Usage limit must be 0 or more.'); return; }
    if (form.startDate && form.endDate && form.startDate > form.endDate) { setFormError('The start date must be before the end date.'); return; }

    const payload: DiscountPayload = {
      code: form.code.trim(),
      name: form.name.trim() || undefined,
      type: form.type,
      value,
      usageLimit,
      startsAt: form.startDate ? `${form.startDate}T00:00:00` : null,
      endsAt: form.endDate ? `${form.endDate}T23:59:59` : null,
      active: form.active,
    };
    setSubmitting(true);
    try {
      if (editingId != null) await discountsApi.update(storeId, editingId, payload);
      else await discountsApi.create(storeId, payload);
      setFormOpen(false);
      load();
    } catch (e: any) {
      setFormError(e instanceof ApiError ? e.message : 'Could not save discount');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (d: DiscountResponse) => {
    const ok = await confirm({
      title: 'Delete discount',
      message: `Delete the discount code ${d.code}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await discountsApi.delete(storeId, d.id);
      load();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Could not delete discount');
    }
  };

  const valueLabel = (d: DiscountResponse) =>
    d.type === 'PERCENTAGE' ? `${d.value}% off` : `${formatMoney(d.value, currency)} off`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Marketing</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Discount codes customers enter at checkout
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Plus size={16} /> New Discount</span>
        </Button>
      </div>

      {/* Summary stats (same pattern as the Products screen). */}
      {!loading && !error && discounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard icon={<Tag size={20} style={{ color: '#10B981' }} />} tint="#10B981" label="Active Discounts" value={String(activeCount)} />
          <StatCard icon={<TrendingUp size={20} style={{ color: '#3B82F6' }} />} tint="#3B82F6" label="Total Redemptions" value={String(totalRedemptions)} />
          <StatCard icon={<Award size={20} style={{ color: '#D97706' }} />} tint="#D97706" label="Most-Used Code" value={mostUsed ? mostUsed.code : '—'} />
        </div>
      )}

      {loading ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading discounts…</p>
      ) : error ? (
        <Card><div className="text-small" style={{ padding: '24px', color: 'var(--error-color)' }}>{error}</div></Card>
      ) : discounts.length === 0 ? (
        <Card>
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No discount codes yet. Create one for customers to use at checkout.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {discounts.map((d) => {
            const meta = STATUS_META[statusOf(d)];
            return (
              <Card key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {d.type === 'PERCENTAGE' ? <Percent size={18} style={{ color: meta.color }} /> : <Tag size={18} style={{ color: meta.color }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{d.name || d.code}</span>
                        <span className="text-tag" style={{ padding: '2px 8px', borderRadius: '4px', background: `${meta.color}20`, color: meta.color, fontSize: '12px', fontWeight: 500 }}>{meta.label}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Code <strong style={{ color: 'var(--text-primary)' }}>{d.code}</strong> · {valueLabel(d)}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        Used {d.usedCount}{d.usageLimit != null ? ` / ${d.usageLimit}` : ' · unlimited'}
                        {(d.startsAt || d.endsAt) ? ` · ${fmtDate(d.startsAt) || 'now'} to ${fmtDate(d.endsAt) || 'no end'}` : ' · no date limit'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => openEdit(d)} aria-label={`Edit ${d.code}`} style={iconBtn}><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(d)} aria-label={`Delete ${d.code}`} style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !submitting && setFormOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-overlay)', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{editingId != null ? 'Edit discount' : 'New discount'}</h3>
              <button onClick={() => !submitting && setFormOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FieldInput label="Name" placeholder="e.g. New customer offer" value={form.name} onChange={(v) => set('name', v)} maxLength={255} helperText="Optional label. The code is what customers type." />
              <FieldInput label="Code" placeholder="WELCOME10" value={form.code} onChange={(v) => set('code', v)} maxLength={255} required helperText="Saved in uppercase. Must be unique for this store." />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Type</label>
                  <Select value={form.type} onChange={(v) => set('type', v as DiscountType)} ariaLabel="Discount type" options={[
                    { value: 'PERCENTAGE', label: 'Percentage (%)' },
                    { value: 'FIXED', label: 'Fixed amount' },
                  ]} />
                </div>
                {form.type === 'FIXED' ? (
                  <MoneyField label="Amount off" currency={currency} value={form.value === '' ? null : Number(form.value)} onChange={(n) => set('value', n == null ? '' : String(n))} />
                ) : (
                  <FieldInput label="Percent off" type="number" inputMode="numeric" placeholder="10" value={form.value} onChange={(v) => set('value', v)} />
                )}
              </div>

              <FieldInput label="Usage limit" type="number" inputMode="numeric" placeholder="Leave blank for unlimited" value={form.usageLimit} onChange={(v) => set('usageLimit', v)} helperText="Total redemptions allowed." />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Starts</label>
                  <DatePicker value={form.startDate} onChange={(v) => set('startDate', v)} placeholder="No start" ariaLabel="Start date" />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Ends</label>
                  <DatePicker value={form.endDate} onChange={(v) => set('endDate', v)} placeholder="No end" ariaLabel="End date" />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <Checkbox checked={form.active} onChange={(v) => set('active', v)} ariaLabel="Active" />
                <span className="text-small">Active (customers can use this code now)</span>
              </label>

              {formError && <p className="text-small" style={{ color: 'var(--error-color)', margin: 0 }}>{formError}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : editingId != null ? 'Save changes' : 'Create discount'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)', background: 'var(--bg-card)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};
