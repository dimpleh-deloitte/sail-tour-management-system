// HCM integration seam — SSoT §25: exact Fusion HCM REST endpoints/
// credentials are TBD. Every caller depends only on this HcmClient
// interface; a real Fusion HCM adapter (client.fusion.ts, not yet
// implemented) can be swapped in via env.hcm.useMockAdapter without
// touching modules/tours or modules/auth.
import { env } from "../../config/env.js";
import { store } from "../../repository/store.js";
import { Employee } from "../../types.js";

export interface HcmClient {
  getEmployeeByPersonNumber(personNumber: string): Promise<Employee | null>;
}

class MockHcmClient implements HcmClient {
  async getEmployeeByPersonNumber(personNumber: string): Promise<Employee | null> {
    return store.employees.find((e) => e.personNumber === personNumber) ?? null;
  }
}

class FusionHcmClient implements HcmClient {
  async getEmployeeByPersonNumber(): Promise<Employee | null> {
    throw new Error(
      "Fusion HCM client is not implemented — FUSION_HCM_BASE_URL/credentials are TBD (SSoT S25). " +
        "Set HCM_USE_MOCK_ADAPTER=true for local development."
    );
  }
}

export const hcmClient: HcmClient = env.hcm.useMockAdapter ? new MockHcmClient() : new FusionHcmClient();
