import { useEffect, useState } from 'react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  stock: number;
}

interface Reservation {
  id: number;
  productId: number;
  quantity: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresAt: string;
}

// If testing locally use localhost:3000, or point to your deployed Render URL
const rawApi= import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = rawApi.replace(/\/+$/, '');

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error('Network response not ok');
      const data = await res.json();
      setProducts(data);
    } catch {
      setStatusMessage(`Unable to connect to backend at ${API_BASE}. Make sure NestJS is running.`);
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

    const updateTimer = () => {
      const remainingMs = new Date(activeReservation.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft(0);
        setActiveReservation(null);
        setStatusMessage('Reservation expired. Stock has been reclaimed.');
        fetchProducts();
      } else {
        setTimeLeft(Math.floor(remainingMs / 1000));
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeReservation]);

  const handleReserve = async (productId: number) => {
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Reservation failed');
      }

      setActiveReservation(data);
      setStatusMessage(`Stock held! Reservation #${data.id}`);
      fetchProducts();
    } catch (err: any) {
      setStatusMessage(err.message || 'Error creating reservation');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!activeReservation) return;
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch(`${API_BASE}/checkout/${activeReservation.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Checkout failed');
      }

      setActiveReservation(null);
      setStatusMessage(`Order completed successfully! Receipt #${data.id}`);
      fetchProducts();
    } catch (err: any) {
      setStatusMessage(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 20px' }}>
      <header style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>Limited Drop Flash Store</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          High-Concurrency Inventory Reservation Engine (Backend: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{API_BASE}</code>)
        </p>
      </header>

      {statusMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          backgroundColor: statusMessage.includes('Order completed') || statusMessage.includes('held!') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${statusMessage.includes('Order completed') || statusMessage.includes('held!') ? '#bbf7d0' : '#fecaca'}`,
          color: statusMessage.includes('Order completed') || statusMessage.includes('held!') ? '#166534' : '#991b1b',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {statusMessage}
        </div>
      )}

      {activeReservation && (
        <div style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '32px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ backgroundColor: '#38bdf8', color: '#0f172a', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                Temporary Lock Active
              </span>
              <h3 style={{ margin: '8px 0 4px 0', fontSize: '20px' }}>Reservation #{activeReservation.id} Held</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Complete checkout before the hold expires and stock returns to pool:</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Remaining</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#38bdf8' }}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              marginTop: '20px',
              padding: '12px 28px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Processing Transaction...' : 'Complete Checkout Now'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', margin: 0, color: '#1e293b' }}>Available Inventory Drops</h2>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Auto-refreshing every 3s</span>
      </div>

      {products.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', color: '#64748b' }}>
          No products found in the database. Run the concurrency test or seed a product to see cards here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#0f172a' }}>{p.name}</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', minHeight: '36px' }}>{p.description}</p>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '8px 0' }}>
                  ${Number(p.price).toFixed(2)}
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: p.stock > 0 ? '#ecfdf5' : '#fef2f2',
                  color: p.stock > 0 ? '#059669' : '#dc2626',
                  marginBottom: '18px'
                }}>
                  {p.stock > 0 ? `Stock: ${p.stock} units available` : 'Sold Out / Held'}
                </div>
              </div>

              <button
                onClick={() => handleReserve(p.id)}
                disabled={p.stock <= 0 || loading || activeReservation !== null}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: p.stock > 0 && !activeReservation ? '#2563eb' : '#cbd5e1',
                  color: p.stock > 0 && !activeReservation ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: p.stock > 0 && !activeReservation ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                }}
              >
                {p.stock <= 0 ? 'Out of Stock' : activeReservation ? 'Hold Already in Progress' : 'Reserve Unit'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}