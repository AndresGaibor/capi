import { test, expect } from "bun:test";
import { isSessionExpired, parseBundle, getSessionStatus } from "../src/auth/deepseek";
import type { DeepSeekSession, DeepSeekBundle } from "../src/auth/deepseek";

test("isSessionExpired detecta sesiones vacías o sin tokens", () => {
  expect(isSessionExpired(null)).toBe(true);

  const incompleta: DeepSeekSession = {
    authorization: "Bearer 123",
    thumbcache: "",
    awsWafToken: "aws=456",
    capturedAt: new Date().toISOString(),
  };
  expect(isSessionExpired(incompleta)).toBe(true);

  const completa: DeepSeekSession = {
    authorization: "Bearer 123",
    thumbcache: "thumb=abc",
    awsWafToken: "aws=456",
    capturedAt: new Date().toISOString(),
  };
  expect(isSessionExpired(completa)).toBe(false);
});

test("parseBundle convierte bundle recibido en DeepSeekSession", () => {
  const bundle: DeepSeekBundle = {
    source: "webbridge",
    capturedAt: "2026-07-23T12:00:00Z",
    authorization: "Bearer eyJtest",
    cookies: {
      thumbcache: "thumb=123",
      awsWafToken: "aws=456",
      dsSessionId: "ds_session_id=789",
    },
  };

  const session = parseBundle(bundle);
  expect(session.authorization).toBe("Bearer eyJtest");
  expect(session.thumbcache).toBe("thumb=123");
  expect(session.awsWafToken).toBe("aws=456");
  expect(session.dsSessionId).toBe("ds_session_id=789");
  expect(session.capturedAt).toBe("2026-07-23T12:00:00Z");
});
