import { STATUS_ORDER, type ApplicationStatus, type JobEntry } from '../lib/types';
import { LayersIcon } from '../components/icons';
import { STATUS_ICON, STATUS_STAT_LABEL } from './statusMeta';

interface StatsBarProps {
  entries: JobEntry[];
}

export function StatsBar({ entries }: StatsBarProps) {
  const counts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = entries.filter((e) => e.status === status).length;
      return acc;
    },
    {} as Record<ApplicationStatus, number>
  );

  return (
    <section className="stats-row">
      <div className="stat-tile total">
        <span className="sicon">
          <LayersIcon />
        </span>
        <div className="stat-text">
          <div className="snum">{entries.length}</div>
          <div className="slabel">Total</div>
        </div>
      </div>
      {STATUS_ORDER.map((status) => {
        const StatusIcon = STATUS_ICON[status];
        return (
          <div key={status} className="stat-tile" data-status={status}>
            <span className="sicon">
              <StatusIcon />
            </span>
            <div className="stat-text">
              <div className="snum">{counts[status]}</div>
              <div className="slabel">{STATUS_STAT_LABEL[status]}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
