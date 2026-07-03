import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@labs.local', pwd: 'admin123' },
  { role: 'Tester', email: 'tester@labs.local', pwd: 'tester123' },
  { role: 'Manager', email: 'manager@labs.local', pwd: 'manager123' }
];

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) setErr(res.error ?? 'Login failed.');
  };

  const useDemo = (a: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(a.email);
    setPassword(a.pwd);
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lab Readiness</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Management Portal</div>
          </div>
          <button className="btn-secondary" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <form className="card p-6" onSubmit={submit}>
          <h1 className="text-lg font-bold mb-1 text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Use your assigned account to continue.</p>

          <label className="block text-sm mb-3">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Email</div>
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="block text-sm mb-1">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Password</div>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {err && <div className="mt-3 text-sm text-rose-600 dark:text-rose-400">{err}</div>}

          <button className="btn-primary w-full justify-center mt-5" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="card p-4 mt-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Demo accounts (click to prefill)
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => useDemo(a)}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{a.role}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{a.email}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">password: <code>{a.pwd}</code></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
