import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/AuthContext';
import { Badge, EmptyState, PageHeader } from '../components/ui';
import type { AppUser, Role } from '../types';

const ROLES: Role[] = ['Admin', 'Tester', 'Manager'];

function roleBadge(r: Role): string {
  switch (r) {
    case 'Admin': return 'bg-brand-100 text-brand-900 dark:bg-brand-700/30 dark:text-brand-100';
    case 'Tester': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'Manager': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
  }
}

export default function UserManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser, resetPassword } = useAuth();
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  if (currentUser?.role !== 'Admin') {
    return <EmptyState title="Access denied" hint="Only Admins can manage users." />;
  }

  return (
    <div>
      <PageHeader title="User Management" subtitle="Create accounts, assign roles, reset passwords.">
        <button className="btn-primary" onClick={() => setOpenAdd(true)}>➕ Add User</button>
      </PageHeader>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">User</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Created</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-600 text-white grid place-items-center text-xs font-semibold">
                      {u.displayName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        {u.displayName}
                        {u.id === currentUser?.id && <span className="ml-2 text-xs text-brand-600">(you)</span>}
                      </div>
                      <div className="text-xs text-slate-500">created by {u.createdBy}</div>
                    </div>
                  </div>
                </td>
                <td className="td">{u.email}</td>
                <td className="td"><Badge className={roleBadge(u.role)}>{u.role}</Badge></td>
                <td className="td">
                  {u.disabled
                    ? <Badge className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Disabled</Badge>
                    : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Active</Badge>}
                </td>
                <td className="td">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="td whitespace-nowrap">
                  <button className="text-brand-600 hover:underline text-sm mr-3" onClick={() => setEditing(u)}>Edit</button>
                  <button
                    className="text-slate-600 hover:underline text-sm mr-3"
                    onClick={async () => {
                      const p = prompt(`Set a new password for ${u.email} (min 6 chars):`);
                      if (p && p.length >= 6) { await resetPassword(u.id, p); alert('Password updated.'); }
                      else if (p !== null) alert('Password must be at least 6 characters.');
                    }}
                  >
                    Reset password
                  </button>
                  {u.id !== currentUser?.id && (
                    <button
                      className="text-rose-600 hover:underline text-sm"
                      onClick={() => confirm(`Delete ${u.email}?`) && deleteUser(u.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openAdd && (
        <UserForm
          onClose={() => setOpenAdd(false)}
          onSubmit={async input => {
            const res = await addUser(input);
            if (!res.ok) { alert(res.error ?? 'Failed to create user.'); return; }
            setOpenAdd(false);
          }}
        />
      )}
      {editing && (
        <EditUserForm
          user={editing}
          onClose={() => setEditing(null)}
          onSave={patch => {
            updateUser(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function UserForm({ onSubmit, onClose }: { onSubmit: (input: { displayName: string; email: string; role: Role; password: string }) => void; onClose: () => void; }) {
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Tester');
  const [password, setPassword] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ displayName, email, role, password });
  };

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Display Name">
          <input className="input" required value={displayName} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={e => setRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Password (min 6 chars)">
          <input className="input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Create User</button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserForm({ user, onSave, onClose }: { user: AppUser; onSave: (patch: Partial<Pick<AppUser, 'displayName' | 'email' | 'role' | 'disabled'>>) => void; onClose: () => void; }) {
  const [displayName, setName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [disabled, setDisabled] = useState<boolean>(!!user.disabled);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ displayName, email, role, disabled });
  };

  return (
    <Modal title="Edit User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Display Name">
          <input className="input" required value={displayName} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={e => setRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} />
          Account disabled (cannot sign in)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</div>
      {children}
    </label>
  );
}
