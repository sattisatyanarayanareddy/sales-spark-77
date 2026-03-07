import React from "react";
import { QuotationStage, STAGE_LABELS, STAGE_COLORS } from "@/types/crm";
import { Badge } from "@/components/ui/badge";

interface StageBadgeProps {
  stage: QuotationStage;
}

const StageBadge: React.FC<StageBadgeProps> = ({ stage }) => {
  return (
    <Badge variant="outline" className={`text-xs font-medium border-0 ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
};

export default StageBadge;
