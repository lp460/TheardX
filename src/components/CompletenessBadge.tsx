import { AlertTriangle, CheckCircle2, CircleDashed, Hand, Layers, XCircle } from 'lucide-react';
import type { Completeness } from '@/types/model';
import { completenessLabel, completenessTone, issueLabel } from '@/thread-engine/labels';
import { Badge } from './ui/primitives';
import { Tooltip } from './ui/Tooltip';

const ICON = {
  complete: CheckCircle2,
  partial: AlertTriangle,
  needs_more: CircleDashed,
  unreconstructable: XCircle,
  single: Layers,
  manual: Hand,
};

export function CompletenessBadge({
  completeness,
  compact,
}: {
  completeness: Completeness;
  compact?: boolean;
}) {
  const tone = completenessTone(completeness.status);
  const Icon = ICON[completeness.status];
  const label =
    compact && completeness.status === 'needs_more'
      ? 'Incomplet'
      : completenessLabel(completeness.status);
  const badge = (
    <Badge
      tone={tone === 'neutral' ? 'neutral' : tone}
      aria-label={`État : ${completenessLabel(completeness.status)}`}
    >
      <Icon size={12} /> {label}
    </Badge>
  );
  if (!completeness.issues.length) return badge;
  return (
    <Tooltip
      label={
        <ul className="max-w-xs space-y-0.5">
          {completeness.issues.map((i) => (
            <li key={i}>{issueLabel(i)}</li>
          ))}
        </ul>
      }
    >
      <span tabIndex={0} className="inline-flex">
        {badge}
      </span>
    </Tooltip>
  );
}
