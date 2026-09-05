import React, { useEffect, useState } from 'react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number | string;
  stock: number;
}

interface Reservation {
  id: number;
  productId: number;
  quantity: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresAt: string;
}

const rawApi = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = rawApi.replace(/\/+$/, '');

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch {
      setError(`Unable to synchronize with API at ${API_BASE}`);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeReservation || activeReservation.status !== 'ACTIVE') {
      setTimeLeft(0);
      return;
    }

    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(activeReservation.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);

      if (remaining === 0) {
        setActiveReservation(null);
        setSuccess(null);
        setError('Reservation hold expired. The inventory has been reclaimed.');
        fetchProducts();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeReservation]);

  const handleReserve = async (productId: number) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Item sold out or currently unavailable');

      setActiveReservation(data);
      setSuccess('Item locked! Complete checkout before the countdown timer hits zero.');
      fetchProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to acquire reservation lock.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!activeReservation) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/checkout/${activeReservation.id}`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      setActiveReservation(null);
      setSuccess(`🎉 Order confirmed! Reservation #${activeReservation.id} successfully completed.`);
      fetchProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Checkout processing error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                LIMITED DROP <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">ENGINE</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Row-Level ACID Protection active</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-slate-500 border border-slate-800 px-2.5 py-1 rounded-md bg-slate-900">
              Live API: {API_BASE.replace('https://', '')}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-rose-400 text-lg">⚠️</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 text-lg">✓</span>
              <p className="text-sm font-medium">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* Active Hold Widget */}
        {activeReservation && (
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/40 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  HOLD SECURED
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Reservation #{activeReservation.id} Locked in Database
                </h2>
                <p className="text-sm text-slate-400">
                  Exclusive row hold reserved. Inventory automatically returns to pool if timeout elapses.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-xs font-mono uppercase text-slate-500">Hold Window</span>
                  <span className="text-3xl font-mono font-bold text-indigo-400 tabular-nums">
                    {formatTimer(timeLeft)}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Processing...' : 'Complete Checkout Now →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Live Flash Inventory</h2>
            <p className="text-xs text-slate-400">Real-time concurrency updates every 3 seconds</p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            {products.length} Products Monitored
          </span>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const isOutOfStock = product.stock <= 0;
            const isHolding = activeReservation?.productId === product.id;

            return (
              <div
                key={product.id}
                className={`flex flex-col justify-between p-6 rounded-2xl bg-slate-900/60 border transition-all duration-200 ${
                  isHolding
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">
                      {product.name}
                    </h3>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold font-mono tracking-wide ${
                        isOutOfStock
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : product.stock <= 2
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isOutOfStock ? 'SOLD OUT' : `${product.stock} REMAINING`}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    {product.description || 'Exclusive release. Strict single-unit reservation limits apply.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-xs uppercase font-mono text-slate-500">Price</span>
                    <span className="text-xl font-bold font-mono text-white">
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleReserve(product.id)}
                    disabled={isOutOfStock || loading || !!activeReservation}
                    className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all duration-150 cursor-pointer ${
                      isHolding
                        ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-200 cursor-not-allowed'
                        : isOutOfStock
                        ? 'bg-slate-800 border border-slate-700/50 text-slate-500 cursor-not-allowed'
                        : activeReservation
                        ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
                    }`}
                  >
                    {isHolding
                      ? 'Hold Active'
                      : isOutOfStock
                      ? 'Depleted'
                      : activeReservation
                      ? 'Hold In Progress'
                      : 'Reserve Unit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}