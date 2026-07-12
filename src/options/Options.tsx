import { useEffect, useState, type CSSProperties } from 'react';
import { getTreats, setTreats } from '../lib/storage';

type SaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Reward-wheel treat list editor. Loads the current treat list from
 * storage.getTreats() (which already seeds sensible defaults — see
 * DEFAULT_TREATS in src/lib/storage.ts), lets the user add/edit/remove
 * entries, and persists via storage.setTreats().
 */
export function Options() {
  const [treats, setTreatsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTreat, setNewTreat] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    getTreats().then((loaded) => {
      setTreatsState(loaded);
      setLoading(false);
    });
  }, []);

  async function persist(next: string[]) {
    setTreatsState(next);
    setStatus('saving');
    await setTreats(next);
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1200);
  }

  function handleAdd() {
    const trimmed = newTreat.trim();
    if (!trimmed) return;
    persist([...treats, trimmed]);
    setNewTreat('');
  }

  function handleRemove(index: number) {
    persist(treats.filter((_, i) => i !== index));
  }

  function handleEdit(index: number, value: string) {
    const next = treats.slice();
    next[index] = value;
    setTreatsState(next);
  }

  function handleEditCommit() {
    // Persist current in-memory state (after an inline edit loses focus).
    persist(treats);
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>SideQuest Settings</h1>
      <p style={styles.subtitle}>
        Configure the treats your <strong>Quest Reward</strong> wheel can land on. These are
        purely suggestions for yourself — nothing here books, buys, or sends anything.
      </p>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Reward Wheel Treats</h2>

        {loading ? (
          <p style={{ color: '#666' }}>Loading…</p>
        ) : (
          <>
            <ul style={styles.list}>
              {treats.map((treat, index) => (
                <li key={index} style={styles.listItem}>
                  <input
                    style={styles.input}
                    value={treat}
                    onChange={(e) => handleEdit(index, e.target.value)}
                    onBlur={handleEditCommit}
                    aria-label={`Treat ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    style={styles.removeButton}
                    aria-label={`Remove ${treat || 'treat'}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {treats.length === 0 && (
                <li style={styles.emptyState}>
                  No treats yet — add one below so the wheel has something to land on.
                </li>
              )}
            </ul>

            <div style={styles.addRow}>
              <input
                style={styles.input}
                placeholder="Add a new treat, e.g. Get boba"
                value={newTreat}
                onChange={(e) => setNewTreat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
              />
              <button type="button" onClick={handleAdd} style={styles.addButton}>
                Add
              </button>
            </div>

            <div style={styles.statusLine}>
              {status === 'saving' && 'Saving…'}
              {status === 'saved' && 'Saved.'}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    fontFamily: 'system-ui, sans-serif',
    color: '#1f1a3d',
    maxWidth: 560,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 13,
    marginTop: 0,
    marginBottom: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 10,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #ddd',
    fontSize: 13,
  },
  removeButton: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #e0c6c6',
    background: '#fff5f5',
    color: '#a33',
    cursor: 'pointer',
    fontSize: 12,
  },
  addRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  addButton: {
    padding: '8px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#4b2fb3',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  statusLine: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    minHeight: 16,
  },
  emptyState: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
};
