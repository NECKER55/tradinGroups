import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';

interface GroupProfileResponse {
  group: {
    id_gruppo: number;
    nome: string;
    photo_url: string | null;
    privacy: 'Public' | 'Private';
    descrizione?: string | null;
    budget_iniziale?: string;
  };
}

export function GroupDetailPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupProfileResponse['group'] | null>(null);

  useEffect(() => {
    const parsedId = Number(groupId);
    if (!Number.isFinite(parsedId)) {
      setError('ID gruppo non valido.');
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchGroupProfile() {
      setLoading(true);
      setError(null);

      try {
        const profile = await apiRequest<GroupProfileResponse>(`${ROUTES.GROUPS.BY_ID(parsedId)}/profile`, {
          method: 'GET',
        });
        if (!active) return;
        setGroup(profile.group);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Impossibile caricare il gruppo.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchGroupProfile();

    return () => {
      active = false;
    };
  }, [groupId]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-6 py-10 text-slate-100">
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        className="inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
      >
        <span className="material-symbols-outlined text-2xl">arrow_back</span>
      </button>

      <div className="rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/80">Group Page</p>
        <h1 className="mt-3 text-2xl font-bold">{group?.nome ?? `Group #${groupId}`}</h1>
        {loading ? <p className="mt-2 text-sm text-slate-400">Caricamento dati gruppo...</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        {!loading && !error ? (
          <>
            <p className="mt-2 text-sm text-slate-400">{group?.descrizione || 'Nessuna descrizione disponibile.'}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-bold uppercase tracking-wide text-violet-200">{group?.privacy ?? 'Private'}</span>
              <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-1 font-bold uppercase tracking-wide text-slate-300">
                Budget iniziale: ${Number(group?.budget_iniziale ?? '0').toFixed(2)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
