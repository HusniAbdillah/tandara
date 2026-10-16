import { Check, ChevronRight, UsersRound } from 'lucide-react';

type DemoAccount = { id: string; name: string; identifier: string; role: string };

export function DemoAccountPicker({
  accounts,
  selectedId,
  disabled,
  onSelect,
}: {
  accounts: DemoAccount[];
  selectedId?: string | undefined;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="demo-accounts" disabled={disabled}>
      <legend className="sr-only">Coba akun demo</legend>
      <div className="demo-accounts-heading">
        <span className="demo-accounts-icon">
          <UsersRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Coba Tandara</h2>
          <p>Pilih akun. Data masuk akan terisi otomatis.</p>
        </div>
        <span className="demo-accounts-badge">Demo</span>
      </div>
      <div className="demo-accounts-list">
        {accounts.map((account) => {
          const selected = selectedId === account.id;
          const initials = account.name
            .split(' ')
            .slice(0, 2)
            .map((word) => word[0])
            .join('');
          return (
            <button
              key={account.id}
              type="button"
              className="demo-account"
              aria-pressed={selected}
              onClick={() => onSelect(account.id)}
            >
              <span className="demo-account-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="demo-account-copy">
                <span className="demo-account-name">{account.name}</span>
                <span className="demo-account-identifier">{account.identifier}</span>
                <span className="demo-account-role">{account.role}</span>
              </span>
              <span className="demo-account-indicator" aria-hidden="true">
                {selected ? <Check size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="demo-accounts-hint" role="status">
        {selectedId ? (
          <>
            Akun siap. Tekan <strong>Masuk</strong> untuk melanjutkan.
          </>
        ) : (
          'Gunakan akun demo untuk menjelajahi fitur.'
        )}
      </p>
    </fieldset>
  );
}
