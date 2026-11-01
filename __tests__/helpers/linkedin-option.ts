import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
import { buildLinkedinSelectionTool } from "@/modules/outreach/domain/linkedin-grounded-selection";

export function firstLinkedinOption(sources: readonly AtomicSource[]) {
  return {
    option_id:
      buildLinkedinSelectionTool(sources).input_schema.properties.option_id
        .enum[0],
  };
}

/** Exercise the actual requested tool contract, without teaching the fake model facts. */
export function linkedinOptionResponse(request: {
  tools: readonly { input_schema: unknown }[];
}) {
  const schema = request.tools[0]!.input_schema as {
    properties: { option_id: { enum: string[] } };
  };
  return {
    content: [
      {
        type: "tool_use",
        name: "return_linkedin_connection_composition",
        input: { option_id: schema.properties.option_id.enum[0] },
      },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}
