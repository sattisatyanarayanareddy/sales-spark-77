import { QuotationStage, STAGE_LABELS, STAGE_COLORS } from "@/types/crm";
import { Badge } from "@/components/ui/badge";

interface StageBadgeProps {
  stage: QuotationStage;
}

const StageBadge = ({ stage }: StageBadgeProps) => {
  return (
    <Badge variant="secondary" className={STAGE_COLORS[stage]}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
};

export default StageBadge;
