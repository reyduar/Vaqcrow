import {
  correlationIdSchema,
  generateCorrelationId,
  parseCorrelationId
} from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";

const generated: CorrelationId = generateCorrelationId();
const parsed: CorrelationId = parseCorrelationId(generated);

document.body.dataset.correlationId = correlationIdSchema.parse(parsed);
