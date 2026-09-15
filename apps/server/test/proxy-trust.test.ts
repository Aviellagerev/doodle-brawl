import test from "node:test";
import assert from "node:assert/strict";
import { ipFromHeaders, trustsProxyHeaders } from "../src/observability.js";

/**
 * Pure logic, because every peer in a local test is loopback and loopback is
 * trusted. What matters is the shape of the decision: a forwarded-for header is
 * a claim, and a claim only counts from someone allowed to make it.
 */

const CLAIMS = { "x-forwarded-for": "9.9.9.9", "cf-connecting-ip": "8.8.8.8" };

test("the proxy may say who the client is", () => {
  assert.equal(trustsProxyHeaders("127.0.0.1"), true, "loopback is the dev proxy");
  assert.equal(trustsProxyHeaders("10.0.0.1"), true, "the WireGuard peer");
  assert.equal(trustsProxyHeaders("::ffff:10.0.0.1"), true, "…written the IPv6 way");
  assert.equal(ipFromHeaders(CLAIMS, "10.0.0.1"), "8.8.8.8", "cf-connecting-ip wins when trusted");
  assert.equal(
    ipFromHeaders({ "x-forwarded-for": "9.9.9.9, 7.7.7.7" }, "10.0.0.1"),
    "9.9.9.9",
    "the first hop of a chain is the client",
  );
});

test("a stranger may not", () => {
  assert.equal(trustsProxyHeaders("203.0.113.5"), false, "a public address is not our proxy");
  assert.equal(
    ipFromHeaders(CLAIMS, "203.0.113.5"),
    "203.0.113.5",
    "the header is ignored, so one attacker cannot become a thousand buckets",
  );
});

test("nonsense is not a proxy", () => {
  assert.equal(trustsProxyHeaders("not-an-ip"), false);
  assert.equal(trustsProxyHeaders(""), false);
});
