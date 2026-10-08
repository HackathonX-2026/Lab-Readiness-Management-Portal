import { useState, type FormEvent } from 'react';
import { ArrowRight, FlaskConical, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import { CloudLabsLogo } from '../components/Logo';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@labs.local', pwd: 'admin123', icon: ShieldCheck },
  { role: 'Tester', email: 'tester@labs.local', pwd: 'tester123', icon: FlaskConical },
  { role: 'Manager', email: 'manager@labs.local', pwd: 'manager123', icon: Users }
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
    <main className="flex min-h-full items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CloudLabsLogo size={38} />
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-foreground">Lab Readiness</div>
              <div className="mt-0.5 text-xs text-muted">CloudLabs · Management Portal</div>
            </div>
          </div>
          <button className="btn-icon" onClick={toggle} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>

        <form className="card p-6 sm:p-8" onSubmit={submit}>
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary-soft text-accent">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted">Use your assigned account to continue.</p>

          <label className="mb-4 block text-sm">
            <div className="mb-1.5 text-xs font-medium text-muted">Email</div>
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
            <div className="mb-1.5 text-xs font-medium text-muted">Password</div>
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

          {err && <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>}

          <button className="btn-primary w-full justify-center mt-5" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <div className="card mt-4 p-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted">
            Demo accounts (click to prefill)
          </div>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => useDemo(a)}
                className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:bg-surface"
              >
                <a.icon size={16} className="shrink-0 text-subtle group-hover:text-accent" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2">
                    <span className="text-sm font-medium text-foreground">{a.role}</span>
                    <span className="text-xs text-muted">{a.email}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">password: <code>{a.pwd}</code></div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-subtle">Lab Readiness Portal · By Spektra Systems</p>
      </div>
    </main>
  );
}
