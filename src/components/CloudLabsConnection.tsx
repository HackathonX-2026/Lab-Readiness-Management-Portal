import { CloudCog, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { CloudLabsConnection as Connection } from '../api/cloudlabs';

export default function CloudLabsConnection({ connection, canRefresh }: { connection: Connection; canRefresh: boolean }) {
  const state = connection.expired ? 'Session expired' : !connection.tokenSaved ? 'Not connected'
    : !connection.contextConfigured ? 'Setup incomplete' : !connection.configured ? 'Expiry unknown'
    : connection.expiresSoon ? 'Expires soon' : 'Connected';
  const good = connection.configured && !connection.expiresSoon;
  return (
    <section aria-label="CloudLabs connection" className="card mb-5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CloudCog size={20} className="shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">CloudLabs Admin API {connection.partner && <span className="text-muted">· {connection.partner}</span>}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">Catalog and audit reads use server-side partner credentials, separate from workshop sync.</p>
        </div>
        <span className={`badge ${good ? 'status-good' : 'status-warn'}`}>{good ? <ShieldCheck size={12} aria-hidden="true" /> : <TriangleAlert size={12} aria-hidden="true" />}{state}</span>
      </div>
      {!connection.configured && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
          {connection.expired ? 'Reconnect the approved CloudLabs session in the server environment.'
            : 'Configure CLOUDLABS_TOKEN, CLOUDLABS_ROLEID and CLOUDLABS_TENANTID on the server. Microsoft sign-in alone does not connect CloudLabs.'}
          {' '}Stored results remain available. No tokens are requested or stored in this browser.
        </p>
      )}
      {connection.expiresAt && <p className="mt-2 text-xs text-muted">Session expires: {new Date(connection.expiresAt).toLocaleString()} · Automatic renewal is not enabled.</p>}
      {!canRefresh && <p className="mt-3 flex items-start gap-2 text-xs text-warning"><Info size={14} className="shrink-0" aria-hidden="true" />Refresh requires server authorization. Use the authenticated deployment proxy or an authorized API client; never embed the refresh key in the frontend.</p>}
    </section>
  );
}