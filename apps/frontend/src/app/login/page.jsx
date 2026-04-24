'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('login');   // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isLoggedIn()) router.replace('/');
  }, [router]);

  function switchTab(t) {
    setTab(t);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let data;
      if (tab === 'login') {
        data = await auth.login(email, password);
      } else {
        data = await auth.register(email, password, storeName || 'My Store');
        setSuccess('Account created! Signing you in…');
      }
      auth.setToken(data.token);
      setTimeout(() => router.replace('/'), 400);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loginDemo() {
    setTab('login');
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await auth.login('demo@kalemart.local', 'kalemart-demo');
      auth.setToken(data.token);
      setSuccess('Demo store loaded. Opening operations dashboard…');
      setTimeout(() => router.replace('/'), 250);
    } catch (err) {
      setError(err.message || 'Unable to open demo store');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
      }}>

        {/* Logo */}
        <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            KaleMart24
          </h1>
          <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', marginTop: 4 }}>
            Store management dashboard
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', margin: '24px 28px 0', background: 'var(--surface-2, #f5f5f7)', borderRadius: 10, padding: 4 }}>
          {[['login', 'Sign In'], ['register', 'Create Account']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s',
                background: tab === id ? 'var(--surface)' : 'transparent',
                color: tab === id ? 'var(--text)' : 'var(--text-muted, #888)',
                boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'login' && (
            <button
              type="button"
              onClick={loginDemo}
              disabled={loading}
              style={{
                padding: '11px',
                borderRadius: 10,
                border: '1px solid rgba(126,200,122,0.28)',
                background: 'rgba(126,200,122,0.10)',
                color: 'var(--brand)',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Open Demo Store
            </button>
          )}

          {tab === 'register' && (
            <div>
              <label style={labelStyle}>Store name</label>
              <input
                type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                placeholder="e.g. KaleMart24"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="you@example.com"
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{error}</p>
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ color: '#34c759', fontSize: '0.85rem', margin: 0 }}>{success}</p>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: '11px', borderRadius: 10, border: 'none',
              background: 'var(--accent, #1b8a5f)', color: '#fff',
              fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-muted, #888)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box',
  outline: 'none',
};
