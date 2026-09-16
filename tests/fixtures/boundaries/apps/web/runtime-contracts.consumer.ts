import {
  applicationReviewSnapshotSchema,
  correlationIdSchema,
  generateCorrelationId,
  parseApplicationId,
  parseCorrelationId
} from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";

const generated: CorrelationId = generateCorrelationId();
const parsed: CorrelationId = parseCorrelationId(generated);

document.body.dataset.correlationId = correlationIdSchema.parse(parsed);

const applicationId = parseApplicationId("123e4567-e89b-42d3-a456-426614174000");
const snapshot = applicationReviewSnapshotSchema.parse({
  applicationId,
  state: "draft"
});

document.body.dataset.applicationId = snapshot.applicationId;
document.body.dataset.applicationReviewState = snapshot.state;
