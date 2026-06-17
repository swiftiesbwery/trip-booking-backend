import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import hero from '../assets/travel-hero.png';

function AuthShell({ children, title, subtitle }) {
  return (
    <div className="auth-page">
      <div className="auth-visual" style={{ backgroundImage: `url(${hero})` }}>
        <Link className="brand light" to="/">Wanderly<span>.</span></Link>
        <div><p className="eyebrow light">TRAVEL BEAUTIFULLY</p><h1>Your next story<br />starts here.</h1><p>Handpicked escapes, easy booking, unforgettable moments.</p></div>
      </div>
      <div className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME TO WANDERLY</p><h2>{title}</h2><p>{subtitle}</p>{children}</div></div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const logged = await login(form); navigate(logged.role === 'admin' ? '/admin' : '/'); }
    catch (err) { setError(err.response?.data?.message || 'Unable to sign in'); }
    finally { setBusy(false); }
  };

  return <AuthShell title="Sign in to your account" subtitle="Welcome back. Your saved journeys are waiting.">
    <Alert error={error} />
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></label>
      <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" /></label>
      <button className="button wide" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
    </form>
    <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
  </AuthShell>;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(form); navigate('/'); }
    catch (err) { setError(err.response?.data?.message || 'Unable to create account'); }
    finally { setBusy(false); }
  };

  return <AuthShell title="Create your account" subtitle="Plan, save, and book beautiful escapes in one place.">
    <Alert error={error} />
    <form onSubmit={submit} className="form-stack">
      <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Budi Santoso" /></label>
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></label>
      <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812..." /></label>
      <label>Password<input type="password" minLength="6" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" /></label>
      <button className="button wide" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
  </AuthShell>;
}
