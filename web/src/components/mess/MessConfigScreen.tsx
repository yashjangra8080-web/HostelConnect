import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Calendar,
  Save,
  RefreshCw,
  Info,
  PlayCircle,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { useToast } from '../ui/Toast.js';

interface MessConfigData {
  hostel_id: number;
  hostel_name: string;
  month: number;
  year: number;
  monthly_fee: number;
  food_component: number;
  per_meal_rate: number;
  free_skips: number;
  cap_pct: number;
  appSettings: {
    mess_flat_refund: number;
    mess_free_skips: number;
    mess_cap_pct: number;
  };
}

export const MessConfigScreen: React.FC = () => {
  const { toast } = useToast();
  const [selectedHostel, setSelectedHostel] = useState<number>(1);
  const [month, setMonth] = useState<number>(10);
  const year = 2026;
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingMeals, setGeneratingMeals] = useState<boolean>(false);

  // Form state
  const [monthlyFee, setMonthlyFee] = useState<string>('4500');
  const [foodComponent, setFoodComponent] = useState<string>('3600');
  const [perMealRate, setPerMealRate] = useState<string>('40');
  const [freeSkips, setFreeSkips] = useState<string>('15');
  const [capPct, setCapPct] = useState<string>('60.00');
  const [flatRefund, setFlatRefund] = useState<string>('1200.00');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/mess/config?hostel_id=${selectedHostel}&month=${month}&year=${year}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load mess configurations.');
      const json: MessConfigData = await res.json();

      setMonthlyFee(String(json.monthly_fee));
      setFoodComponent(String(json.food_component));
      setPerMealRate(String(json.per_meal_rate));
      setFreeSkips(String(json.free_skips));
      setCapPct(String(json.cap_pct));
      setFlatRefund(String(json.appSettings.mess_flat_refund));
    } catch (err: any) {
      toast.error(err.message || 'Error fetching config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [selectedHostel, month, year]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const mFee = Number(monthlyFee);
    const fComp = Number(foodComponent);
    const pRate = Number(perMealRate);
    const fSkips = Number(freeSkips);
    const cPct = Number(capPct);
    const flRefund = Number(flatRefund);

    if (isNaN(mFee) || mFee <= 0) {
      toast.error('Monthly fee must be a positive number.');
      return;
    }
    if (isNaN(fComp) || fComp <= 0 || fComp > mFee) {
      toast.error('Food component must be positive and cannot exceed total monthly fee.');
      return;
    }
    if (isNaN(pRate) || pRate <= 0) {
      toast.error('Per-meal rate must be positive.');
      return;
    }
    if (isNaN(fSkips) || fSkips < 0) {
      toast.error('Free skips allowance cannot be negative.');
      return;
    }
    if (isNaN(cPct) || cPct <= 0 || cPct > 100) {
      toast.error('Cap percentage must be between 1% and 100%.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/mess/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hostel_id: selectedHostel,
          month,
          year,
          monthly_fee: mFee,
          food_component: fComp,
          per_meal_rate: pRate,
          free_skips: fSkips,
          cap_pct: cPct,
          flat_refund_benchmark: flRefund,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update configurations.');

      toast.success(json.message || 'Mess configuration updated successfully!');
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateMeals = async () => {
    setGeneratingMeals(true);
    try {
      const res = await fetch('/api/mess/generate-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hostel_id: selectedHostel,
          month,
          year,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate meal slots.');

      toast.success(json.message || 'Generated monthly meal schedule successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error generating meals');
    } finally {
      setGeneratingMeals(false);
    }
  };

  const maxRebateCap = ((Number(foodComponent) * Number(capPct)) / 100).toFixed(2);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-saffron mb-1">
            <Settings className="w-4 h-4" strokeWidth={1.75} />
            <span>HostelConnect • Operational Settings</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink-primary">
            Mess Fee & Refund Parameters
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Configure monthly dining fees, food component ratios, per-meal rates, and policy rebate caps.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Hostel Select */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Building className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(Number(e.target.value))}
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={1}>BH1 (Boys Hostel 1)</option>
              <option value={2}>BH2 (Boys Hostel 2)</option>
              <option value={3}>GH1 (Girls Hostel 1)</option>
            </select>
          </div>

          {/* Month/Year Select */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={9}>Sep 2026</option>
              <option value={10}>Oct 2026</option>
              <option value={11}>Nov 2026</option>
              <option value={12}>Dec 2026</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchConfig} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Reset
          </Button>
        </div>
      </div>

      {/* Policy Context Box */}
      <div className="p-4 bg-primary-subtle border border-primary-border rounded-lg text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="space-y-1 text-ink-secondary leading-relaxed">
          <p className="font-semibold text-primary uppercase tracking-wider text-[11px]">
            Institutional Refund Policy Framework
          </p>
          <p>
            The total monthly dining fee is composed of operational kitchen overheads and a direct edible food component. By institutional decree, attendance refunds apply exclusively to eligible missed meals in excess of the statutory 15-meal skip allowance, capped at the defined percentage of the edible food component.
          </p>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-6 bg-surface border border-border rounded-lg space-y-6 shadow-none">
          <div className="border-b border-border pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-primary">
              Monthly Hostel Financials ({month}/{year})
            </h3>
            <p className="text-xs text-ink-muted">
              Applies to all active residents in selected hostel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Monthly Mess Fee */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Total Monthly Mess Fee (₹)</span>
                <span className="text-[10px] text-ink-muted font-normal">Base fee billed to student</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {/* 2. Food Component */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Edible Food Component (₹)</span>
                <span className="text-[10px] text-ink-muted font-normal">Must be ≤ Total Fee</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={foodComponent}
                onChange={(e) => setFoodComponent(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {/* 3. Per-Meal Refund Rate */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Per-Meal Refund Rate (₹)</span>
                <span className="text-[10px] text-ink-muted font-normal">Rebate per eligible missed meal</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={perMealRate}
                onChange={(e) => setPerMealRate(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {/* 4. Free Skips Allowance */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Free Skips Allowance (Count)</span>
                <span className="text-[10px] text-ink-muted font-normal">Default statutory allowance: 15</span>
              </label>
              <Input
                type="number"
                step="1"
                value={freeSkips}
                onChange={(e) => setFreeSkips(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {/* 5. Food Component Cap % */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Food Component Cap %</span>
                <span className="text-[10px] text-ink-muted font-normal">Max rebate limit (% of food component)</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={capPct}
                onChange={(e) => setCapPct(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {/* 6. Historical Flat Refund Benchmark */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Historical Flat Benchmark (₹)</span>
                <span className="text-[10px] text-ink-muted font-normal">Legacy setting in app_settings</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={flatRefund}
                onChange={(e) => setFlatRefund(e.target.value)}
                className="font-mono"
                required
              />
            </div>
          </div>

          {/* Computed Formula Summary Callout */}
          <div className="p-4 bg-surface-subtle rounded border border-border text-xs space-y-2 font-mono">
            <div className="text-ink-secondary text-[11px] font-sans font-semibold uppercase tracking-wider">
              Live Parameter Validation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-ink-muted block text-[10px]">Overhead Component:</span>
                <span className="text-ink-primary font-bold">
                  ₹{(Number(monthlyFee) - Number(foodComponent)).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px]">Max Refund Cap:</span>
                <span className="text-emerald-700 font-bold">
                  ₹{maxRebateCap}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px]">Meals to hit Cap:</span>
                <span className="text-ink-primary font-bold">
                  {Math.ceil(Number(maxRebateCap) / (Number(perMealRate) || 1))} meals
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="submit" variant="primary" disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </form>

      {/* Meal Slot Scheduling Operations */}
      <div className="p-6 bg-surface border border-border rounded-lg space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-primary">
              Monthly Meal Slot Generator
            </h3>
            <p className="text-xs text-ink-secondary mt-1">
              Idempotently generate daily meal slots (Breakfast, Lunch, Snacks, Dinner) for {month}/{year} using stored procedure <code className="font-mono bg-surface-subtle px-1 py-0.5 rounded">sp_generate_meals</code>.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateMeals}
            disabled={generatingMeals}
            className="shrink-0"
          >
            <PlayCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
            {generatingMeals ? 'Generating...' : 'Generate Meal Slots'}
          </Button>
        </div>
      </div>
    </div>
  );
};
