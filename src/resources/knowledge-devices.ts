import { loadAllDevices } from "../knowledge/index.js";

import type { ResourceDefinition } from "./index.js";

/**
 * `live://knowledge/devices` — índice estático de todos os 55 devices da
 * knowledge base. Não consulta o Live; lê os JSONs embarcados.
 *
 * Útil para LLM se orientar sobre quais devices têm schema disponível antes
 * de chamar `device_get_parameters`.
 */
export const knowledgeDevicesResource: ResourceDefinition = {
  uri: "live://knowledge/devices",
  name: "knowledge_devices",
  description:
    "Index of all device schemas in the embedded knowledge base (id, name, category, completeness, param count).",
  mimeType: "application/json",
  read: async () => {
    try {
      const devices = await loadAllDevices();
      const index = devices.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        vendor: d.vendor,
        live_version_min: d.live_version_min,
        completeness: d.completeness,
        parameter_count: d.parameters.length,
      }));
      return {
        contents: [
          {
            uri: "live://knowledge/devices",
            mimeType: "application/json",
            text: JSON.stringify({ total: index.length, devices: index }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        contents: [
          {
            uri: "live://knowledge/devices",
            mimeType: "application/json",
            text: JSON.stringify(
              { error: (err as Error).message, name: (err as Error).name },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
};
