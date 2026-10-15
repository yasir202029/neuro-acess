import { afterEach, describe, expect, it } from "vitest";
import { ApiError, authApi, setTokens } from "./api-client";

const okFetch = (body: unknown, status = 200) =>
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;

describe("api-client", () => {
  afterEach(() => { setTokens(null); });

  it("attaches bearer token and parses login response", async () => {
    const login = { user: { id: "u1", email: "e@x", firstName: "F", lastName: "L", roles: ["CLINICIAN"] }, tokens: { accessToken: "a", refreshToken: "r" } };
    let seenAuth = "";
    globalThis.fetch = (async (_url, init) => {
      seenAuth = (init?.headers as Record<string, string>)?.Authorization ?? "";
      return new Response(JSON.stringify(login), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    setTokens({ accessToken: "a", refreshToken: "r" });
    const res = await authApi.login("e@x", "pw");
    expect(seenAuth).toBe("Bearer a");
    expect(res.tokens.accessToken).toBe("a");
  });

  it("throws ApiError with backend error contract", async () => {
    okFetch({ error: { code: "FORBIDDEN", message: "Not permitted" } }, 403);
    const err = await authApi.login("e@x", "pw").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("FORBIDDEN");
    expect((err as ApiError).status).toBe(403);
  });
});
