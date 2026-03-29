import { QuotationStatus, STATUS_LABELS, STATUS_COLORS } from "@/types/crm";
import { Badge } from "@/components/ui/badge";

interface StageBadgeProps {
  stage: QuotationStatus;
}

const StageBadge = ({ stage }: StageBadgeProps) => {
  return (
    <Badge variant="secondary" className={STATUS_COLORS[stage]}>
      {STATUS_LABELS[stage]}
    </Badge>
  );
};

export default StageBadge;
