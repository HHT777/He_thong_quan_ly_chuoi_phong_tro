import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrastRatio } from "../src/shared/design/contrast.mjs";

const css = readFileSync(new URL("../src/shared/styles/ui2-shell.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/layout/app-shell.js", import.meta.url), "utf8");
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

test("UI-2a-1 token text and graphic pairs meet WCAG contrast thresholds", () => {
  for (const [foreground, background] of [
    ["ui2-ink", "ui2-canvas"], ["ui2-subtext", "ui2-canvas"],
  ]) assert.ok(contrastRatio(token(foreground), token(background)) >= 4.5, `${foreground} on ${background}`);
  for (const background of ["ui2-navy", "ui2-navy-active", "ui2-blue"]) {
    assert.ok(contrastRatio("#ffffff", token(background)) >= 4.5, `white text on ${background}`);
  }
  for (const foreground of ["ui2-blue-light", "ui2-amber", "ui2-red"]) {
    assert.ok(contrastRatio(token(foreground), "#ffffff") >= 3, `${foreground} graphic on white`);
  }
});

test("UI-2a-1 shell retains real navigation, hides unread dot until API confirms and only lists real creation tabs", () => {
  assert.match(shell, /get\("\/v1\/notifications"\)/);
  assert.match(shell, /item\.da_doc === false \|\| item\.da_doc === 0/);
  assert.match(shell, /id="unreadNotificationDot" hidden/);
  assert.match(shell, /CREATE_SHORTCUTS\.map[\s\S]*available\.find/);
  assert.match(shell, /createShortcuts\.length >= 2/);
  assert.match(shell, /go\(button\.dataset\.createRoute\)/);
  assert.doesNotMatch(shell, /Không gian quản lý/);
  assert.match(shell, /sidebarCollapseBtn/);
  assert.match(shell, /globalSearchInput/);
});

test("UI-2a-1 dynamic shell HTML is escaped and final font cascade supports Vietnamese", () => {
  assert.match(shell, /escapeHtml\(userName\)/);
  assert.match(shell, /escapeHtml\(item\.label\)/);
  assert.match(css, /--font-sans: system-ui, -apple-system, "Segoe UI", Arial, sans-serif/);
  assert.doesNotMatch(css, /Georgia|Times New Roman/);
});
