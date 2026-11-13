import { createApi, ApiError } from "../../src/app/api";

const cfg = { url: "https://script.example/exec", token: "tok" };

function fakeFetch(reply: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { json: async () => reply } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("sends a text/plain POST with the token and action (no CORS preflight)", async () => {
  const { impl, calls } = fakeFetch({ ok: true, data: { rows: [] } });
  await createApi(cfg, impl).upsert("Transactions", [{ ID: "a" }]);
  expect(calls[0].url).toBe(cfg.url);
  expect(calls[0].init.method).toBe("POST");
  expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("text/plain;charset=utf-8");
  const body = JSON.parse(String(calls[0].init.body));
  expect(body).toMatchObject({ token: "tok", action: "upsert", tab: "Transactions", rows: [{ ID: "a" }] });
});

test("batch turns changes into upsert and remove ops in one POST", async () => {
  const { impl, calls } = fakeFetch({ ok: true, data: { saved: [], removed: 1 } });
  await createApi(cfg, impl).batch([
    { tab: "Meals", row: { ID: "m1" } },
    { tab: "Transactions", removeId: "t1" },
  ]);
  expect(calls).toHaveLength(1);
  expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
    action: "batch",
    ops: [
      { op: "upsert", tab: "Meals", rows: [{ ID: "m1" }] },
      { op: "remove", tab: "Transactions", ids: ["t1"] },
    ],
  });
});

test("returns data on success", async () => {
  const { impl } = fakeFetch({ ok: true, data: { serverTime: "x" } });
  await expect(createApi(cfg, impl).ping()).resolves.toEqual({ serverTime: "x" });
});

test("a server error becomes an ApiError with its code", async () => {
  const { impl } = fakeFetch({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing or wrong token" } });
  const err = await createApi(cfg, impl).ping().catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.code).toBe("UNAUTHORIZED");
});

test("a failed fetch becomes a NETWORK ApiError", async () => {
  const impl = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  const err = await createApi(cfg, impl).ping().catch((e) => e);
  expect(err.code).toBe("NETWORK");
});

test("a non-JSON reply becomes a NETWORK ApiError", async () => {
  const impl = (async () => ({ json: async () => { throw new SyntaxError("bad"); } }) as unknown as Response) as unknown as typeof fetch;
  const err = await createApi(cfg, impl).ping().catch((e) => e);
  expect(err.code).toBe("NETWORK");
});
