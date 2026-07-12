import type { ApplicationStatus, JobEntry } from '../lib/types';

interface StatsBarProps {
  entries: JobEntry[];
}

const STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'rejected',
  'offer',
];

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  rejected: 'Rejected',
  offer: 'Offer',
};

export function StatsBar({ entries }: StatsBarProps) {
  const counts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = entries.filter((e) => e.status === status).length;
      return acc;
    },
    {} as Record<ApplicationStatus, number>
  );

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Overview</h2>
      </div>
      <div className="stats-bar">
        <div className="stat-tile stat-tile--total">
          <span className="stat-tile__label">Total</span>
          <span className="stat-tile__value">{entries.length}</span>
        </div>
        {STATUS_ORDER.map((status) => (
          <div key={status} className="stat-tile" data-status={status}>
            <span className="stat-tile__label">{STATUS_LABEL[status]}</span>
            <span className="stat-tile__value">{counts[status]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
