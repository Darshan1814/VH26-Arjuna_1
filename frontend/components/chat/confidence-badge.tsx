interface Props {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: Props) {
  const percentage = Math.round(confidence * 100);

  let colorClass: string;
  let label: string;

  if (percentage >= 80) {
    colorClass = "badge-success";
    label = "High confidence";
  } else if (percentage >= 50) {
    colorClass = "badge-warning";
    label = "Medium confidence";
  } else {
    colorClass = "badge-error";
    label = "Low confidence";
  }

  return (
    <span className={colorClass} title={label}>
      {percentage}% confidence
    </span>
  );
}
