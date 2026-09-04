"use client";

import { useLanguage } from "@/context/language-context";

interface Props {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: Props) {
  const { t } = useLanguage();
  const percentage = Math.round(confidence * 100);

  let colorClass: string;
  let label: string;

  if (percentage >= 80) {
    colorClass = "badge-success";
    label = t("High confidence");
  } else if (percentage >= 50) {
    colorClass = "badge-warning";
    label = t("Medium confidence");
  } else {
    colorClass = "badge-error";
    label = t("Low confidence");
  }

  return (
    <span className={colorClass} title={label}>
      {percentage}% {t("confidence")}
    </span>
  );
}
