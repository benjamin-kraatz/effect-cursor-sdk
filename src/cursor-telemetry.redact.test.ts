import { describe, expect, it } from "@effect/vitest";

import { redact } from "./cursor-telemetry";

describe("redact", () => {
  it("matches existing integration-style expectations for API and nested data", () => {
    expect(
      redact({
        apiKey: "secret",
        nested: { Authorization: "bearer token", keep: "value" },
        images: [{ data: "base64" }],
      }),
    ).toEqual({
      apiKey: "[redacted]",
      nested: { Authorization: "[redacted]", keep: "value" },
      images: [{ data: "[redacted]" }],
    });
  });

  it("redacts extended secret-shaped key names", () => {
    expect(
      redact({
        password: "p",
        userPassword: "p2",
        httpOnlyCookie: "c",
        sessionJwt: "j",
        oauthBearer: "b",
        clientCredential: "cr",
        CURSOR_API_TOKEN: "t",
        client_secret: "s",
      }),
    ).toEqual({
      password: "[redacted]",
      userPassword: "[redacted]",
      httpOnlyCookie: "[redacted]",
      sessionJwt: "[redacted]",
      oauthBearer: "[redacted]",
      clientCredential: "[redacted]",
      CURSOR_API_TOKEN: "[redacted]",
      client_secret: "[redacted]",
    });
  });

  it("does not redact unrelated keys that lack sensitive substrings", () => {
    expect(
      redact({
        id: "ok",
        label: "ok",
        count: 3,
        metadata: { nested: true },
      }),
    ).toEqual({
      id: "ok",
      label: "ok",
      count: 3,
      metadata: { nested: true },
    });
  });

  it("redacts only exact key `data`, not every key containing the word data", () => {
    expect(
      redact({
        data: "blob",
        payload: "visible",
        metadata: "visible",
      }),
    ).toEqual({
      data: "[redacted]",
      payload: "visible",
      metadata: "visible",
    });
  });

  it("supports Object.create(null) dictionaries", () => {
    const dict = Object.create(null) as Record<string, unknown>;
    dict.token = "x";
    dict.safe = 1;
    expect(redact(dict)).toEqual({ token: "[redacted]", safe: 1 });
  });

  it("replaces non-plain objects with an opaque marker instead of empty objects", () => {
    expect(redact({ at: new Date(0), nested: { m: new Map([["a", 1]]) } })).toEqual({
      at: "[opaque]",
      nested: { m: "[opaque]" },
    });
    expect(redact({ r: /x/, set: new Set([1]) })).toEqual({
      r: "[opaque]",
      set: "[opaque]",
    });
  });

  it("detects true cycles on objects without treating DAG shared references as circular", () => {
    type Node = { tag: string; next?: Node };
    const cyclic: Node = { tag: "root" };
    cyclic.next = cyclic;

    expect(redact(cyclic)).toEqual({
      tag: "root",
      next: "[circular]",
    });

    const shared = { keep: "ok" };
    expect(redact({ a: shared, b: shared })).toEqual({
      a: { keep: "ok" },
      b: { keep: "ok" },
    });
  });

  it("detects cycles through arrays", () => {
    const a: unknown[] = [];
    a.push(a);
    expect(redact(a)).toEqual(["[circular]"]);
  });

  it("truncates extremely deep nesting with an opaque marker", () => {
    let deep: Record<string, unknown> = { v: 0 };
    for (let i = 0; i < 70; i += 1) {
      deep = { nest: deep };
    }
    const out = redact(deep) as Record<string, unknown>;
    let cursor: unknown = out;
    for (let i = 0; i < 64; i += 1) {
      expect(cursor).toEqual({ nest: expect.any(Object) });
      cursor = (cursor as Record<string, unknown>).nest;
    }
    expect(cursor).toEqual({ nest: "[opaque]" });
  });

  it("passes through primitives, undefined, bigint, and symbols", () => {
    const sym = Symbol("s");
    expect(redact(undefined)).toBe(undefined);
    expect(redact(0n)).toBe(0n);
    expect(redact(sym)).toBe(sym);
    expect(redact(NaN)).toBeNaN();
  });
});
