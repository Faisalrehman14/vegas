(() => {
  const CFG = Object.assign(
    {
      count: 5,
      password: "Player123",
      managerHint: "Sunny110",
      balance: 5,
      prefix: "",
      postfix: "",
      digitLen: 4,
      uniquePasswords: false,
      checkpointEvery: 25,
      maxRetries: 5,
      batchEvery: 10,
      batchWaitSec: 10
    },
    window.__VE_BULK_CFG || {}
  );

  if (!/vegasempire\.co$/i.test(location.hostname)) {
    alert("Open app.vegasempire.co first, then run this launcher.");
    return;
  }
  if (!CFG.password || CFG.password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  const NAMES = [
    "Liam","Noah","Oliver","Elijah","James","William","Benjamin","Lucas","Henry","Theodore",
    "Jack","Levi","Alexander","Jackson","Mateo","Daniel","Michael","Mason","Sebastian","Ethan",
    "Logan","Owen","Samuel","Jacob","Asher","Aiden","John","David","Joseph","Matthew","Leo",
    "Wyatt","Carter","Julian","Luke","Grayson","Isaac","Jayden","Thea","Aria","Mia","Luna",
    "Harper","Camila","Sofia","Scarlett","Chloe","Nora","Ellie","Hazel","Lily","Aurora",
    "Violet","Nova","Ivy","Emilia","Stella","Zoe","Penelope","Riley","Layla","Eleanor",
    "Madison","Grace","Kai","Nina","Omar","Zara","Felix","Iris","Miles","Quinn","Vera",
    "Hugo","Clara","Roman","Eden","Silas","Maya","Jasper","Ruby","Axel","Freya","Cole"
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lettersOnly = (s) => String(s).replace(/[^A-Za-z]/g, "");
  const alnum = (s) => String(s).replace(/[^a-zA-Z0-9]/g, "");

  function secureRand(maxExclusive) {
    if (maxExclusive <= 0) return 0;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % maxExclusive;
  }

  function secureDigits(len) {
    let out = "";
    for (let i = 0; i < len; i++) out += String(secureRand(10));
    return out;
  }

  function secureToken(len) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += alphabet[secureRand(alphabet.length)];
    return out;
  }

  function setInput(el, value) {
    if (!el) throw new Error("Missing form field");
    const str = String(value);
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.focus();
    el.click();
    // Clear then set so React controlled inputs revalidate.
    proto.set.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    proto.set.call(el, str);
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: str, inputType: "insertText" }));
    } catch (_err) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function buttonLabel(b) {
    return ((b && (b.innerText || b.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function isButtonDisabled(b) {
    if (!b) return true;
    return Boolean(
      b.disabled ||
      b.getAttribute("disabled") != null ||
      b.getAttribute("aria-disabled") === "true" ||
      b.classList.contains("Mui-disabled")
    );
  }

  /** Collision-resistant username factory (max 15 chars to match admin UI). */
  function createAccountFactory(opts) {
    const used = new Set();
    const prefix = alnum(opts.prefix || "").toLowerCase().slice(0, 5);
  const postfix = alnum(opts.postfix || "").toLowerCase().slice(0, 5);
  const digitLen = Math.min(6, Math.max(3, Number(opts.digitLen) || 4));
  const uniquePasswords = Boolean(opts.uniquePasswords);
  const basePassword = opts.password;

  function makePassword() {
    if (!uniquePasswords) return basePassword;
    // Keep shared prefix feel but unique suffix: e.g. Player_a7k2m9
    const root = alnum(basePassword).slice(0, 8) || "Player";
    return (root + secureToken(6)).slice(0, 20);
  }

  function makeUsername(displayName) {
    const name = lettersOnly(displayName).toLowerCase() || "player";
    const maxLen = 15;
    const postfixPart = postfix ? postfix : "";
    for (let attempt = 0; attempt < 80; attempt++) {
      let username;
      if (attempt < 40) {
        const room = Math.max(2, maxLen - digitLen - prefix.length - postfixPart.length);
        const stem = name.slice(0, room);
        username = (prefix + stem + secureDigits(digitLen) + postfixPart).slice(0, maxLen);
      } else if (attempt < 65) {
        const encoded = (prefix + name.slice(0, 4) + secureToken(6) + postfixPart).slice(0, maxLen);
        username = encoded;
      } else {
        username = ("u" + secureToken(10) + postfixPart).slice(0, maxLen);
      }
      if (!used.has(username) && username.length >= 4) {
        used.add(username);
        return username;
      }
    }
    throw new Error("Could not allocate a unique username");
  }

    function next() {
      const name = lettersOnly(NAMES[secureRand(NAMES.length)]);
      const username = makeUsername(name);
      return {
        name,
        username,
        password: makePassword(),
        attempts: 0
      };
    }

    function remake(account) {
      used.delete(account.username);
      const username = makeUsername(account.name);
      account.username = username;
      account.password = makePassword();
      account.attempts = (account.attempts || 0) + 1;
      return account;
    }

    function preallocate(count) {
      const list = [];
      for (let i = 0; i < count; i++) list.push(next());
      return list;
    }

    return { next, remake, preallocate, used };
  }

  async function waitFor(fn, timeout = 12000, label = "the page") {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = fn();
      if (value) return value;
      await sleep(120);
    }
    throw new Error("Timed out waiting for " + label);
  }

  function pageRoot() {
    return document.querySelector("#main-content") || document.querySelector("main") || document.body;
  }

  function visibleText(el) {
    return (el && el.innerText) || "";
  }

  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    return el.getClientRects().length > 0;
  }

  function dismissOpenDialogs() {
    const cancels = [...document.querySelectorAll(".MuiDialog-root button, .MuiModal-root button, button")].filter((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      if (!isVisible(b)) return false;
      return /^cancel$/i.test((b.textContent || "").trim());
    });
    cancels.forEach((b) => b.click());
  }

  function pressEscape() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
  }

  function dismissRuntimeErrorOverlay() {
    // CRA / webpack "Uncaught runtime errors" overlay (often reCAPTCHA Timeout)
    document.querySelectorAll("iframe#webpack-dev-server-client-overlay, iframe[id*='overlay']").forEach((el) => el.remove());
    document.querySelectorAll("#webpack-dev-server-client-overlay").forEach((el) => el.remove());
    [...document.querySelectorAll("body > div, body > iframe")].forEach((el) => {
      if (el.id === "ve-bulk-root" || el.closest("#ve-bulk-root")) return;
      const text = (el.innerText || el.textContent || "").slice(0, 2000);
      if (/Uncaught runtime errors/i.test(text) && /reCAPTCHA|Timeout/i.test(text)) {
        el.remove();
      }
    });
    // Soft-hide any leftover full-screen blocker with that text
    [...document.querySelectorAll("div")].forEach((el) => {
      if (el.closest("#ve-bulk-root")) return;
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "absolute") return;
      const z = Number(style.zIndex) || 0;
      if (z < 1000) return;
      const text = (el.innerText || "").slice(0, 800);
      if (/Uncaught runtime errors|reCAPTCHA Timeout/i.test(text)) {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("pointer-events", "none", "important");
      }
    });
  }

  function hasCaptchaOrRuntimeBlock() {
    if (document.querySelector("iframe#webpack-dev-server-client-overlay, #webpack-dev-server-client-overlay")) return true;
    const bodyText = (document.body && document.body.innerText) || "";
    if (/Uncaught runtime errors[\s\S]{0,200}reCAPTCHA Timeout/i.test(bodyText.slice(0, 5000))) return true;
    // Visible recaptcha challenge iframe (not just analytics)
    const challenge = [...document.querySelectorAll("iframe[src*='recaptcha']")].some((f) => {
      if (!isVisible(f)) return false;
      const r = f.getBoundingClientRect();
      return r.width > 200 && r.height > 100;
    });
    return challenge;
  }

  async function recoverFromUiBlockers(log) {
    dismissRuntimeErrorOverlay();
    if (!hasCaptchaOrRuntimeBlock()) return false;
    if (log) log("⚠ reCAPTCHA / runtime overlay — clearing & waiting…");
    dismissRuntimeErrorOverlay();
    pressEscape();
    await sleep(2000);
    dismissRuntimeErrorOverlay();
    // Give network/recaptcha time to settle before retrying UI actions
    await sleep(8000);
    dismissRuntimeErrorOverlay();
    pressEscape();
    await sleep(400);
    dismissRuntimeErrorOverlay();
    if (hasCaptchaOrRuntimeBlock() && log) {
      log("⚠ Overlay still present — continue carefully / solve captcha if shown.");
    }
    return true;
  }

  async function escapeUi() {
    dismissRuntimeErrorOverlay();
    pressEscape();
    await sleep(120);
    dismissOpenDialogs();
    await sleep(180);
    pressEscape();
    await sleep(120);
    dismissRuntimeErrorOverlay();
  }

  function findActiveDialog(titleRe) {
    const roots = [...document.querySelectorAll(".MuiDialog-root, .MuiModal-root, [role='dialog']")].filter(isVisible);
    const byTitle = roots.find((root) => {
      const title = root.querySelector("h1,h2,[role='heading'],.MuiDialogTitle-root");
      return title && titleRe.test(title.textContent || "");
    });
    if (byTitle) return byTitle;
    return roots.find((root) => titleRe.test(root.innerText || "") && findDialogAmountInput(root)) || null;
  }

  function findMoneyDialog(kind) {
    const loose = kind === "redeem" ? /redeem/i : /recharge/i;
    const strict = kind === "redeem" ? /redeem\s*user/i : /recharge\s*user/i;
    return (
      findActiveDialog(strict) ||
      findActiveDialog(loose) ||
      [...document.querySelectorAll(".MuiDialog-root, .MuiModal-root, [role='dialog']")]
        .filter(isVisible)
        .find((root) => loose.test(root.innerText || "") && findDialogAmountInput(root)) ||
      null
    );
  }

  function findDialogAmountInput(dialog) {
    if (!dialog) return null;
    return (
      dialog.querySelector("input#amount") ||
      dialog.querySelector('input[name="amount"]') ||
      dialog.querySelector('input[type="number"]') ||
      [...dialog.querySelectorAll("input")].find((el) => {
        if (el.type === "hidden") return false;
        return /amount/i.test((el.id || "") + (el.name || "") + (el.getAttribute("aria-label") || "") + (el.placeholder || ""));
      }) ||
      [...dialog.querySelectorAll("input:not([type='hidden']):not([type='checkbox']):not([type='radio'])")].find((el) => isVisible(el)) ||
      null
    );
  }

  function findDialogConfirm(dialog, { allowDisabled = false } = {}) {
    const roots = dialog
      ? [dialog]
      : [...document.querySelectorAll(".MuiDialog-root, .MuiModal-root, [role='dialog']")].filter(isVisible);
    const scope = roots.flatMap((root) => {
      const actions = root.querySelector(".MuiDialogActions-root, .MuiDialog-actions, [class*='DialogActions']");
      const buttons = [...(actions || root).querySelectorAll("button, [role='button']")];
      return buttons.length ? buttons : [...root.querySelectorAll("button, [role='button']")];
    });

    const matches = scope.filter((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      if (!allowDisabled && !isVisible(b)) return false;
      const label = buttonLabel(b);
      return /^(confirm|submit|save|ok)$/i.test(label) || /^confirm\b/i.test(label);
    });

    const enabled = matches.find((b) => !isButtonDisabled(b));
    if (enabled) return enabled;

    // Fallback: primary contained button in actions (not Cancel)
    const primary = scope.find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      if (!allowDisabled && !isVisible(b)) return false;
      if (!allowDisabled && isButtonDisabled(b)) return false;
      const label = buttonLabel(b);
      if (/^cancel$/i.test(label)) return false;
      return (
        b.classList.contains("MuiButton-contained") ||
        b.classList.contains("MuiButton-containedPrimary") ||
        /MuiButton-contained/i.test(b.className || "")
      );
    });
    if (primary) return primary;

    if (allowDisabled) return matches[0] || null;
    return null;
  }

  async function waitForConfirm(dialog, log, label = "Confirm") {
    try {
      return await waitFor(() => {
        const live = (dialog && document.contains(dialog) && findDialogConfirm(dialog))
          ? dialog
          : (findMoneyDialog("recharge") || findMoneyDialog("redeem") || dialog);
        return findDialogConfirm(live, { allowDisabled: false });
      }, 10000, label + " button");
    } catch (err) {
      const live = findMoneyDialog("recharge") || findMoneyDialog("redeem") || dialog;
      const disabled = findDialogConfirm(live, { allowDisabled: true });
      const labels = live
        ? [...live.querySelectorAll("button")].map(buttonLabel).filter(Boolean).join(" | ")
        : "(no dialog)";
      if (disabled) {
        log(label + " still disabled. Dialog buttons: " + labels);
        throw new Error(label + " disabled — amount may not be accepted (check admin balance)");
      }
      log(label + " missing. Dialog buttons: " + labels);
      throw new Error(label + " missing");
    }
  }

  function dialogErrorText(dialog) {
    const text = ((dialog && dialog.innerText) || visibleText(pageRoot()) || "");
    return text;
  }

  async function openCreate() {
    if (document.querySelector("#name") || document.querySelector("input[name='name']")) return;
    const btn = [...document.querySelectorAll("button")].find((b) => /add new user/i.test(b.textContent || ""));
    if (!btn) throw new Error("Add New User button not found. Stay on User List.");
    btn.click();
    await waitFor(() => document.querySelector("#name") || document.querySelector("input[name='name']"), 12000, "Create New User form");
  }

  function findFieldInput(label) {
    const wanted = label.toLowerCase();
    const byId = document.getElementById(label) || document.getElementById(label.toLowerCase());
    if (byId && byId.tagName === "INPUT") return byId;
    return [...document.querySelectorAll("input")].find((el) => {
      if (el.closest("#ve-bulk-root")) return false;
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const name = (el.getAttribute("name") || "").toLowerCase();
      return aria.includes(wanted) || id === wanted || name === wanted;
    }) || null;
  }

  async function pickAutocomplete(label, optionText) {
    const input = findFieldInput(label);
    if (!input) throw new Error("Could not find " + label + " dropdown");
    input.click();
    input.focus();
    const wrap = input.closest(".MuiFormControl-root, .MuiAutocomplete-root, div");
    const openBtn = wrap && wrap.querySelector("button[aria-label='Open'], button[title='Open']");
    if (openBtn) openBtn.click();
    await sleep(250);
    const want = String(optionText).toLowerCase();
    const opt = await waitFor(() => {
      const options = [...document.querySelectorAll("[role='option']")];
      if (!options.length) return null;
      if (want === "__first__") return options.find((o) => (o.textContent || "").trim().length > 1);
      return options.find((o) => (o.textContent || "").trim().toLowerCase().includes(want));
    }, 8000, label + " option");
    opt.click();
    await sleep(280);
  }

  class DupUsernameError extends Error {
    constructor(username) {
      super("Username already in use: " + username);
      this.name = "DupUsernameError";
      this.username = username;
    }
  }

  async function createOne(account, log) {
    await openCreate();
    const nameEl = document.querySelector("#name") || document.querySelector("input[name='name']");
    const userEl = document.querySelector("#username") || document.querySelector("input[name='username']");
    const passEl = document.querySelector("#password") || document.querySelector("input[name='password']");
    const confEl = document.querySelector("#confirmpassword") || document.querySelector("input[name='confirmpassword']");
    const password = account.password || CFG.password;
    setInput(nameEl, account.name);
    setInput(userEl, account.username);
    setInput(passEl, password);
    setInput(confEl, password);
    await pickAutocomplete("Role", "Player");
    try {
      await pickAutocomplete("Manager", CFG.managerHint || "__first__");
    } catch (_err) {
      await pickAutocomplete("Manager", "__first__");
    }
    const confirm = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^confirm$/i.test((b.textContent || "").trim());
    });
    if (!confirm) throw new Error("Confirm button missing");
    confirm.click();
    await sleep(400);
    const result = await waitFor(() => {
      const formOpen = Boolean(document.querySelector("#confirmpassword"));
      const bodyText = visibleText(pageRoot());
      if (/user created successfully/i.test(bodyText)) return "ok";
      if (/already in use/i.test(bodyText) && formOpen) return "dup";
      if (!formOpen) return "ok";
      return false;
    }, 20000, "user create to finish");
    const bodyText = visibleText(pageRoot());
    if (result === "dup" || (document.querySelector("#confirmpassword") && /already in use/i.test(bodyText))) {
      dismissOpenDialogs();
      await sleep(400);
      throw new DupUsernameError(account.username);
    }
    log("✓ " + account.username + " created");
    await sleep(700);
  }

  function rowMatchesUsername(row, username) {
    const want = String(username).trim().toLowerCase();
    if (!want) return false;
    const cells = [...row.querySelectorAll("td, [role='cell']")];
    if (cells.some((c) => (c.textContent || "").trim().toLowerCase() === want)) return true;
    const text = (row.innerText || "").toLowerCase().replace(/\s+/g, " ");
    const re = new RegExp("(^|[^a-z0-9_])" + want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9_]|$)", "i");
    return re.test(text);
  }

  function findRowForUsername(username) {
    const rows = [...document.querySelectorAll("tbody tr, tr, [role='row']")].filter((row) => {
      if (row.closest("#ve-bulk-root")) return false;
      if (row.querySelector("th")) return false;
      return isVisible(row) || row.getClientRects().length > 0;
    });
    const exactPlayer = rows.find((row) => rowMatchesUsername(row, username) && /player/i.test(row.innerText || ""));
    if (exactPlayer) return exactPlayer;
    return rows.find((row) => rowMatchesUsername(row, username)) || null;
  }

  function findSearchBox() {
    return (
      [...document.querySelectorAll("input")].find((el) => {
        if (el.closest("#ve-bulk-root")) return false;
        if (!isVisible(el)) return false;
        return /enter value/i.test(el.placeholder || "");
      }) ||
      document.querySelector("input[placeholder='Enter value']") ||
      [...document.querySelectorAll("input[type='search'], input[type='text']")].find((el) => {
        if (el.closest("#ve-bulk-root, nav, .MuiDrawer-root")) return false;
        return isVisible(el) && /search|username|user/i.test((el.placeholder || "") + (el.getAttribute("aria-label") || "") + (el.id || ""));
      }) ||
      null
    );
  }

  async function searchUser(username, log) {
    log("searching " + username + " ...");
    await recoverFromUiBlockers(log);
    await escapeUi();

    const clearBtn = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      if (!isVisible(b)) return false;
      return /^clear$/i.test((b.textContent || "").trim());
    });
    if (clearBtn) {
      clearBtn.click();
      await sleep(550);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const searchBox = findSearchBox();
      if (!searchBox) throw new Error("Search box not found");
      searchBox.scrollIntoView({ block: "center", inline: "nearest" });
      setInput(searchBox, username);
      await sleep(180);
      if ((searchBox.value || "").trim() !== String(username)) {
        setInput(searchBox, username);
        await sleep(150);
      }

      const searchBtn = [...document.querySelectorAll("button")].find((b) => {
        if (b.closest("#ve-bulk-root")) return false;
        if (!isVisible(b)) return false;
        return /^search$/i.test((b.textContent || "").trim());
      });
      if (searchBtn) searchBtn.click();
      else {
        searchBox.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
        searchBox.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      }

      try {
        const row = await waitFor(() => findRowForUsername(username), 10000, "user row for " + username);
        row.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(350);
        return row;
      } catch (err) {
        if (attempt >= 2) throw err;
        log("search retry " + (attempt + 2) + "/3 for " + username);
        await escapeUi();
        await sleep(500);
      }
    }
    throw new Error("Row not found for " + username);
  }

  function findActionsMenuItem(label) {
    const re = new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
    const openMenus = [...document.querySelectorAll(
      ".MuiPopover-root .MuiMenu-list, .MuiMenu-paper [role='menu'], [role='presentation'] [role='menu'], .MuiMenu-list"
    )].filter((menu) => {
      if (menu.closest("#ve-bulk-root, nav, .MuiDrawer-root")) return false;
      return isVisible(menu);
    });
    const items = openMenus
      .flatMap((menu) => [...menu.querySelectorAll('[role="menuitem"], li, button')])
      .filter((el) => !el.closest("nav, .MuiDrawer-root, #ve-bulk-root") && isVisible(el));
    return items.find((el) => {
      const firstLine = (el.textContent || "").trim().split("\n")[0].trim();
      return re.test(firstLine);
    }) || null;
  }

  function readBalanceFromRow(row) {
    if (!row) return 0;
    const table = row.closest("table");
    const headers = table
      ? [...table.querySelectorAll("thead th, thead [role='columnheader'], [role='columnheader']")].map((h) =>
          (h.textContent || "").trim().toLowerCase()
        )
      : [];
    const cells = [...row.querySelectorAll("td, [role='cell']")];
    const balIdx = headers.findIndex((h) => /^balance$|balance/.test(h) && !/recharge|redeem/.test(h));
    if (balIdx >= 0 && cells[balIdx]) {
      const raw = (cells[balIdx].textContent || "").trim().replace(/,/g, "");
      const n = Number(raw.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    const text = (row.innerText || "").replace(/\s+/g, " ").trim();
    const m =
      text.match(/Player\s+(\d+(?:\.\d+)?)/i) ||
      text.match(/\b(\d+(?:\.\d+)?)\s+\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (m) return Number(m[1]) || 0;

    const nums = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((x) => Number(x[1]));
    const candidates = nums.filter((n) => n >= 0 && n < 1000000 && !(n >= 1900 && n <= 2100));
    if (!candidates.length) return 0;
    return candidates.length >= 2 ? candidates[candidates.length - 2] : candidates[0];
  }

  function findRowActionsButton(row) {
    return (
      [...row.querySelectorAll("button")].find((b) => /^actions$/i.test((b.textContent || "").trim())) ||
      row.querySelector("#user-actions-button") ||
      [...row.querySelectorAll("button")].find((b) => /action/i.test((b.getAttribute("aria-label") || "") + (b.id || ""))) ||
      null
    );
  }

  async function openRowAction(username, actionLabel, log) {
    const row = await searchUser(username, log);
    if (!row) throw new Error("Row not found for " + username);
    const balance = readBalanceFromRow(row);

    for (let attempt = 0; attempt < 3; attempt++) {
      pressEscape();
      await sleep(150);
      const freshRow = findRowForUsername(username) || row;
      const actionsBtn = findRowActionsButton(freshRow);
      if (!actionsBtn) throw new Error("Actions button not found in row for " + username);
      log("opening " + actionLabel + " for " + username + " (balance " + balance + ") ...");
      actionsBtn.scrollIntoView({ block: "center", inline: "nearest" });
      actionsBtn.click();
      await sleep(400);
      try {
        const item = await waitFor(() => findActionsMenuItem(actionLabel), 7000, "Actions → " + actionLabel);
        item.click();
        await sleep(450);
        return { row: freshRow, balance };
      } catch (err) {
        if (attempt >= 2) throw err;
        log("Actions menu retry " + (attempt + 2) + "/3");
        await escapeUi();
        await sleep(400);
      }
    }
    throw new Error("Could not open Actions → " + actionLabel + " for " + username);
  }

  async function waitDialogResult(titleRe, successRe, errorRe, timeout = 22000) {
    return waitFor(() => {
      const dialog = findActiveDialog(titleRe);
      const bodyText = dialogErrorText(dialog);
      if (successRe.test(bodyText)) return "ok";
      if (dialog && errorRe.test(bodyText)) return "err";
      if (!dialog) return "ok";
      return false;
    }, timeout, "dialog to finish");
  }

  async function fillAmount(dialog, amt) {
    const amountEl = await waitFor(
      () => findDialogAmountInput(findMoneyDialog("recharge") || findMoneyDialog("redeem") || dialog),
      8000,
      "amount field"
    );
    amountEl.focus();
    amountEl.click();
    await sleep(80);
    setInput(amountEl, String(amt));
    await sleep(250);
    if (String(amountEl.value || "").trim() !== String(amt)) {
      setInput(amountEl, String(amt));
      await sleep(200);
    }
    // Re-focus confirm area so MUI validators run.
    amountEl.dispatchEvent(new Event("change", { bubbles: true }));
    amountEl.blur();
    await sleep(200);
    return amountEl;
  }

  async function rechargeOne(username, amount, log) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid recharge amount for " + username);

    await openRowAction(username, "Recharge", log);
    const dialog = await waitFor(() => findMoneyDialog("recharge"), 15000, "Recharge User dialog");
    await fillAmount(dialog, amt);

    const liveDialog = findMoneyDialog("recharge") || dialog;
    const confirm = await waitForConfirm(liveDialog, log, "Recharge Confirm");
    confirm.click();
    await sleep(450);

    const result = await waitDialogResult(
      /recharge/i,
      /recharged successfully/i,
      /cannot exceed|amount must|insufficient|error|failed|invalid/i,
      22000
    );
    const stillOpen = findMoneyDialog("recharge");
    const bodyText = dialogErrorText(stillOpen);
    if (result === "err" || (stillOpen && /cannot exceed|amount must|insufficient|error|failed|invalid/i.test(bodyText))) {
      await escapeUi();
      throw new Error("Recharge failed for " + username + " (check admin balance / amount)");
    }
    log("✓ " + username + " recharged +" + amt);
    await sleep(500);
    return { username, amount: amt, status: "ok" };
  }

  async function redeemOne(username, log) {
    const row = await searchUser(username, log);
    const balance = readBalanceFromRow(row);
    if (!balance || balance <= 0) {
      log(username + " skipped (balance 0)");
      return { username, redeemed: 0, skipped: true, reason: "balance-0" };
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      pressEscape();
      await sleep(120);
      const freshRow = findRowForUsername(username) || row;
      const actionsBtn = findRowActionsButton(freshRow);
      if (!actionsBtn) throw new Error("Actions button not found in row for " + username);
      log("opening Redeem for " + username + " (balance " + balance + ") ...");
      actionsBtn.scrollIntoView({ block: "center", inline: "nearest" });
      actionsBtn.click();
      await sleep(400);
      try {
        const item = await waitFor(() => findActionsMenuItem("Redeem"), 7000, "Actions → Redeem");
        item.click();
        await sleep(450);
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
        log("Redeem menu retry " + (attempt + 2) + "/3");
        await escapeUi();
        await sleep(400);
      }
    }

    const dialog = await waitFor(() => findMoneyDialog("redeem"), 15000, "Redeem User dialog");

    const dialogText = (findMoneyDialog("redeem") || dialog).innerText || "";
    let redeemAmount = balance;
    const maxMatch =
      dialogText.match(/Maximum Amount Redeem:\s*(\d+(?:\.\d+)?)/i) ||
      dialogText.match(/Maximum(?:\s+Amount)?(?:\s+Redeem)?:\s*(\d+(?:\.\d+)?)/i) ||
      dialogText.match(/Max(?:imum)?\s*:?\s*(\d+(?:\.\d+)?)/i);
    if (maxMatch) redeemAmount = Number(maxMatch[1]);
    if (!Number.isFinite(redeemAmount) || redeemAmount <= 0) {
      await escapeUi();
      log(username + " skipped (max redeem 0)");
      return { username, redeemed: 0, skipped: true, reason: "max-0" };
    }

    await fillAmount(dialog, redeemAmount);

    const remarks =
      (findMoneyDialog("redeem") || dialog).querySelector("input#remarks, input[name='remarks']");
    if (remarks && (remarks.value || "").trim()) setInput(remarks, "");

    const liveDialog = findMoneyDialog("redeem") || dialog;
    const confirm = await waitForConfirm(liveDialog, log, "Redeem Confirm");
    confirm.click();
    await sleep(450);

    const result = await waitDialogResult(
      /redeem/i,
      /redeemed successfully/i,
      /cannot exceed|amount must|must be in lobby|playing|error|failed|invalid|online/i,
      22000
    );
    const stillOpen = findMoneyDialog("redeem");
    const bodyText = dialogErrorText(stillOpen);
    if (result === "err" || (stillOpen && /cannot exceed|amount must|must be in lobby|playing|error|failed|invalid|online/i.test(bodyText))) {
      const reason = /lobby|playing|online/i.test(bodyText) ? "user busy / in game" : "redeem rejected";
      await escapeUi();
      throw new Error("Redeem failed for " + username + " (" + reason + ")");
    }
    log("✓ " + username + " redeemed -" + redeemAmount);
    await sleep(550);
    return { username, redeemed: redeemAmount, skipped: false, balanceBefore: balance };
  }

  async function withMoneyRetries(fn, label, log, maxRetries = 3) {
    let lastErr = null;
    const tries = Math.max(maxRetries, 4);
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        await recoverFromUiBlockers(log);
        if (attempt > 0) {
          log(label + " retry " + (attempt + 1) + "/" + tries);
          await escapeUi();
          const captchaBackoff = /recaptcha|timeout|overlay|confirm missing|search box|timed out/i.test(
            (lastErr && lastErr.message) || ""
          );
          await sleep((captchaBackoff ? 2500 : 600) + attempt * (captchaBackoff ? 1500 : 400));
          await recoverFromUiBlockers(log);
        }
        return await fn();
      } catch (err) {
        lastErr = err;
        const msg = (err && err.message) || String(err);
        if (/admin balance|insufficient|invalid recharge amount/i.test(msg) && !/timed out|not found|Actions|Confirm|Search|recaptcha/i.test(msg)) {
          break;
        }
        await escapeUi();
        if (/recaptcha|timeout/i.test(msg) || hasCaptchaOrRuntimeBlock()) {
          await recoverFromUiBlockers(log);
        }
      }
    }
    throw lastErr || new Error(label + " failed");
  }

  function normalizeSheetName(name) {
    const cleaned = String(name || "vegas-accounts")
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "vegas-accounts";
    return cleaned;
  }



  function getUserTableHeaders() {
    const table = [...document.querySelectorAll("table")].find((t) => {
      if (t.closest("#ve-bulk-root")) return false;
      return isVisible(t) && t.querySelector("tbody tr");
    });
    if (!table) return { table: null, headers: [] };
    const headers = [...table.querySelectorAll("thead th")].map((h) =>
      (h.textContent || "").trim().toLowerCase()
    );
    return { table, headers };
  }

  function readPaginationMeta() {
    const root = document.querySelector(".MuiTablePagination-root") || pageRoot();
    const text = ((root && root.innerText) || "") + "\n" + ((pageRoot() && pageRoot().innerText) || "");
    const m = text.match(/(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)/i);
    if (!m) return { from: 0, to: 0, total: 0 };
    return { from: Number(m[1]), to: Number(m[2]), total: Number(m[3]) };
  }

  function buildUsersHash(page, perPage) {
    const params = new URLSearchParams();
    params.set("displayedFilters", "{}");
    params.set("filter", "{}");
    params.set("order", "DESC");
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    params.set("sort", "createdAt");
    return "#/users?" + params.toString();
  }

  function extractUsernameFromRow(row, headers) {
    if (!row || row.closest("#ve-bulk-root")) return null;
    const cells = [...row.querySelectorAll("td")];
    if (!cells.length) return null;
    const text = (row.innerText || "").replace(/\s+/g, " ").trim();
    if (!text || /no rows|no data|no users/i.test(text)) return null;

    const blocked = new Set([
      "player", "manager", "admin", "agent", "actions", "active", "inactive", "yes", "no"
    ]);
    const mgr = String(CFG.managerHint || "").trim().toLowerCase();
    if (mgr) blocked.add(mgr);

    const userIdx = headers.findIndex((h) => h === "username" || h === "user name");
    if (userIdx >= 0 && cells[userIdx]) {
      const u = (cells[userIdx].textContent || "").trim();
      if (/^[a-zA-Z][a-zA-Z0-9_]{2,24}$/.test(u) && !blocked.has(u.toLowerCase())) return u;
    }

    for (const cell of cells) {
      const v = (cell.textContent || "").trim();
      if (!/^[a-zA-Z][a-zA-Z0-9_]{2,24}$/.test(v)) continue;
      if (blocked.has(v.toLowerCase())) continue;
      if (v.includes("@")) continue;
      return v;
    }
    return null;
  }

  function collectUsernamesFromCurrentPage(opts = {}) {
    const playersOnly = opts.playersOnly !== false;
    const { table, headers } = getUserTableHeaders();
    if (!table) return [];
    const out = [];
    const seen = new Set();
    [...table.querySelectorAll("tbody tr")].forEach((row) => {
      if (!(isVisible(row) || row.getClientRects().length)) return;
      const text = row.innerText || "";
      if (playersOnly && !/player/i.test(text)) return;
      const username = extractUsernameFromRow(row, headers);
      if (!username) return;
      const key = username.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(username);
    });
    return out;
  }

  function pageFingerprint() {
    return collectUsernamesFromCurrentPage({ playersOnly: false }).join("|");
  }

  async function waitForUserPage(previousFp, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const users = collectUsernamesFromCurrentPage({ playersOnly: false });
      const fp = users.join("|");
      const meta = readPaginationMeta();
      if (users.length && (!previousFp || fp !== previousFp)) {
        return { users, fp, meta };
      }
      await sleep(180);
    }
    const users = collectUsernamesFromCurrentPage({ playersOnly: false });
    return { users, fp: users.join("|"), meta: readPaginationMeta() };
  }

  async function setItemsPerPage100(log) {
    const before = pageFingerprint();
    log("Items per page → 100 (URL)…");
    location.hash = buildUsersHash(1, 100);
    let loaded = await waitForUserPage(before, 18000);

    // If still ~10 rows, try clicking the dropdown option 100
    if (loaded.users.length > 0 && loaded.users.length <= 12) {
      log("Still ~" + loaded.users.length + "/page — clicking Items per page = 100…");
      pressEscape();
      await sleep(200);
      const pagination = document.querySelector(".MuiTablePagination-root");
      const combo = pagination && (
        pagination.querySelector("[role='combobox']") ||
        pagination.querySelector(".MuiSelect-select") ||
        pagination.querySelector(".MuiTablePagination-select")
      );
      if (combo) {
        const beforeClick = pageFingerprint();
        combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        combo.click();
        await sleep(350);
        const opt = [...document.querySelectorAll('[role="listbox"] [role="option"], [role="option"], li')].find((o) => {
          const t = (o.textContent || "").trim();
          return t === "100" || o.getAttribute("data-value") === "100";
        });
        if (opt) {
          opt.click();
          loaded = await waitForUserPage(beforeClick, 15000);
        } else {
          pressEscape();
        }
      }
    }

    const perPage = loaded.users.length >= 50 ? 100 : Math.max(loaded.users.length || 10, 10);
    log("Page size ready: " + loaded.users.length + " usernames visible · total " + (loaded.meta.total || "?"));
    return { perPage: perPage >= 80 ? 100 : perPage, loaded };
  }

  async function clearUserFilters(log) {
    await escapeUi();
    const clearBtn = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      if (!isVisible(b)) return false;
      return /^clear$/i.test((b.textContent || "").trim());
    });
    if (clearBtn) {
      clearBtn.click();
      log("Filters cleared.");
      await sleep(800);
    }
  }

  async function harvestExistingUsernames(log, opts = {}) {
    const playersOnly = opts.playersOnly !== false;
    if (![...document.querySelectorAll("button")].some((b) => /add new user/i.test(b.textContent || ""))) {
      throw new Error("User List page pe raho (Add New User button dikhna chahiye).");
    }

    log("Scan start: pehle 100/page, phir har page se Username column copy.");
    await clearUserFilters(log);
    const { perPage, loaded: first } = await setItemsPerPage100(log);

    const found = [];
    const seen = new Set();
    let previousFp = "";
    let total = first.meta.total || 0;
    const maxPages = Math.max(1, Math.ceil((total || 5000) / Math.max(perPage, 1)) + 3);

    for (let page = 1; page <= maxPages; page++) {
      let meta = readPaginationMeta();
      let pageUsers;

      if (page === 1 && collectUsernamesFromCurrentPage({ playersOnly: false }).length) {
        await sleep(200);
        pageUsers = collectUsernamesFromCurrentPage({ playersOnly });
        meta = readPaginationMeta();
      } else {
        const before = previousFp || pageFingerprint();
        location.hash = buildUsersHash(page, perPage);
        const loaded = await waitForUserPage(before, 20000);
        await sleep(200);
        pageUsers = collectUsernamesFromCurrentPage({ playersOnly });
        meta = loaded.meta.total ? loaded.meta : readPaginationMeta();
      }

      if (meta.total) total = meta.total;
      let added = 0;
      pageUsers.forEach((u) => {
        const key = u.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        found.push(u);
        added += 1;
      });
      previousFp = pageUsers.join("|");

      log(
        "Page " + page + "/" + Math.ceil((total || 1) / perPage) +
        ": +" + added + " · on-page " + pageUsers.length +
        " · unique " + found.length + (total ? (" / " + total) : "")
      );

      if (total && found.length >= total) break;
      if (meta.to && meta.total && meta.to >= meta.total) break;
      if (page > 1 && pageUsers.length === 0) break;
    }

    if (!found.length) throw new Error("Koi username nahi mila. Username column / User List check karo.");
    if (total && found.length < total * 0.9) {
      log("Warning: sirf " + found.length + " mile, UI total " + total + " dikhata hai.");
    }
    log("Harvest complete: " + found.length + " usernames.");
    return found;
  }

  const VAULT_KEY = "vegas-account-vaults-v1";

  function loadVaultStore() {
    try {
      const data = JSON.parse(localStorage.getItem(VAULT_KEY) || "null");
      if (!data || typeof data !== "object") return { version: 1, activeId: null, vaults: {} };
      if (!data.vaults || typeof data.vaults !== "object") data.vaults = {};
      return data;
    } catch (_err) {
      return { version: 1, activeId: null, vaults: {} };
    }
  }

  function saveVaultStore(store) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(store));
  }

  function listEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function splitIntoHalves(usernames) {
    const all = [...usernames];
    const mid = Math.ceil(all.length / 2);
    return { list1: all.slice(0, mid), list2: all.slice(mid) };
  }

  function vaultStats(vault) {
    if (!vault) return null;
    const c1 = Math.min(Number(vault.cursor1) || 0, (vault.list1 || []).length);
    const c2 = Math.min(Number(vault.cursor2) || 0, (vault.list2 || []).length);
    return {
      total: (vault.all || []).length,
      list1Size: (vault.list1 || []).length,
      list2Size: (vault.list2 || []).length,
      list1Done: c1,
      list2Done: c2,
      list1Left: Math.max(0, (vault.list1 || []).length - c1),
      list2Left: Math.max(0, (vault.list2 || []).length - c2)
    };
  }

  function getActiveVault() {
    const store = loadVaultStore();
    if (!store.activeId || !store.vaults[store.activeId]) return null;
    return store.vaults[store.activeId];
  }

  function setActiveVault(id) {
    const store = loadVaultStore();
    if (!store.vaults[id]) return null;
    store.activeId = id;
    saveVaultStore(store);
    return store.vaults[id];
  }

  function upsertVaultFromUsernames(usernames, opts = {}) {
    const unique = [...new Set((usernames || []).map((u) => String(u || "").trim()).filter(Boolean))];
    if (!unique.length) throw new Error("No usernames to build vault");
    const halves = splitIntoHalves(unique);
    const name = normalizeSheetName(opts.name || CFG.sheetName || "vegas-accounts");
    const manager = String(opts.manager || CFG.managerHint || "manager").trim() || "manager";
    const id = normalizeSheetName(manager + "-" + name);
    const store = loadVaultStore();
    const prev = store.vaults[id];
    const keepCursor1 = prev && listEqual(prev.list1, halves.list1);
    const keepCursor2 = prev && listEqual(prev.list2, halves.list2);
    const vault = {
      id,
      name,
      manager,
      createdAt: (prev && prev.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      all: unique,
      list1: halves.list1,
      list2: halves.list2,
      cursor1: keepCursor1 ? Math.min(Number(prev.cursor1) || 0, halves.list1.length) : 0,
      cursor2: keepCursor2 ? Math.min(Number(prev.cursor2) || 0, halves.list2.length) : 0,
      accounts: Array.isArray(opts.accounts) ? opts.accounts : (prev && prev.accounts) || []
    };
    store.vaults[id] = vault;
    store.activeId = id;
    saveVaultStore(store);
    return vault;
  }

  function upsertVaultFromRows(rows, opts = {}) {
    const accounts = Array.isArray(rows) ? rows : [];
    const usernames = accounts.map((a) => a && a.username).filter(Boolean);
    return upsertVaultFromUsernames(usernames, Object.assign({}, opts, { accounts }));
  }

  function advanceVaultCursor(vaultId, listNo, successCount) {
    const store = loadVaultStore();
    const vault = store.vaults[vaultId];
    if (!vault) return null;
    const n = Math.max(0, Number(successCount) || 0);
    if (listNo === 2) {
      vault.cursor2 = Math.min((vault.list2 || []).length, (Number(vault.cursor2) || 0) + n);
    } else {
      vault.cursor1 = Math.min((vault.list1 || []).length, (Number(vault.cursor1) || 0) + n);
    }
    vault.updatedAt = new Date().toISOString();
    store.vaults[vaultId] = vault;
    saveVaultStore(store);
    return vault;
  }

  function resetVaultCursor(vaultId, listNo) {
    const store = loadVaultStore();
    const vault = store.vaults[vaultId];
    if (!vault) return null;
    if (listNo === 2) vault.cursor2 = 0;
    else if (listNo === 1) vault.cursor1 = 0;
    else {
      vault.cursor1 = 0;
      vault.cursor2 = 0;
    }
    vault.updatedAt = new Date().toISOString();
    store.vaults[vaultId] = vault;
    saveVaultStore(store);
    return vault;
  }

  function planWalletAwareBatch(vault, listNo, amount, wallet) {
    const amt = Number(amount);
    const wal = Number(wallet);
    if (!vault) throw new Error("No active vault");
    if (![1, 2].includes(listNo)) throw new Error("List must be 1 or 2");
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount per account must be > 0");
    if (!Number.isFinite(wal) || wal < 0) throw new Error("Wallet balance invalid");

    const list = listNo === 2 ? (vault.list2 || []) : (vault.list1 || []);
    const cursorKey = listNo === 2 ? "cursor2" : "cursor1";
    const cursor = Math.min(Number(vault[cursorKey]) || 0, list.length);
    const pending = list.slice(cursor);
    const capacity = Math.floor(wal / amt);
    const take = Math.min(pending.length, Math.max(0, capacity));
    const batch = pending.slice(0, take).map((username) => ({ username, amount: amt }));
    return {
      vaultId: vault.id,
      listNo,
      amount: amt,
      wallet: wal,
      capacity,
      cursor,
      listSize: list.length,
      pendingCount: pending.length,
      take,
      batch,
      spend: take * amt,
      leftoverWallet: wal - take * amt,
      remainingAfter: pending.length - take
    };
  }

  function downloadListCsv(listName, usernames) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const lines = ["#,Username"].concat(
      (usernames || []).map((u, i) => (i + 1) + "," + JSON.stringify(String(u)))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${normalizeSheetName(listName)}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadVaultHalves(vault) {
    if (!vault) return;
    downloadListCsv(vault.name + "-list1", vault.list1 || []);
    downloadListCsv(vault.name + "-list2", vault.list2 || []);
  }


  function keepCreatedBackup(rows, fileName) {
    const safeName = normalizeSheetName(fileName || CFG.sheetName || "vegas-accounts");
    CFG.sheetName = safeName;
    localStorage.setItem("vegas-bulk-sheet-name", safeName);
    localStorage.setItem("vegas-bulk-created-backup", JSON.stringify({
      fileName: safeName,
      savedAt: new Date().toISOString(),
      rows
    }));
    return safeName;
  }

  function restoreCreatedBackup() {
    try {
      const raw = localStorage.getItem("vegas-bulk-created-backup");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.rows) || !data.rows.length) return null;
      const fileName = normalizeSheetName(data.fileName || "vegas-accounts");
      CFG.sheetName = fileName;
      return { fileName, rows: data.rows };
    } catch (_err) {
      return null;
    }
  }

  function downloadSheet(rows, fallbackPassword, balance) {
    const fileName = normalizeSheetName(CFG.sheetName || "vegas-accounts");
    keepCreatedBackup(rows, fileName);
    const header = ["#", "Name", "Username", "Password", "Role", "Manager", "Balance Loaded", "Status", "Created At"];
    const lines = [header.join(",")];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    rows.forEach((a, i) => {
      const cells = [
        i + 1,
        a.name,
        a.username,
        a.password || fallbackPassword,
        "Player",
        CFG.managerHint || "",
        a.balanceLoaded != null ? a.balanceLoaded : balance,
        a.status || "ok",
        a.createdAt || stamp
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadRedeemSheet(rows) {
    const header = ["#", "Username", "Redeemed", "Recharged", "Recharge Status", "Status", "At"];
    const lines = [header.join(",")];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    rows.forEach((a, i) => {
      const cells = [
        i + 1,
        a.username,
        a.redeemed || 0,
        a.recharged || 0,
        a.rechargeStatus || "not-needed",
        a.skipped ? "skipped" : (a.error || "ok"),
        a.at || stamp
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vegas-redeems-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadHybridSheet(rows) {
    const header = ["#", "RedeemFrom", "Redeemed", "RedeemStatus", "RechargeTo", "Recharged", "RechargeStatus", "At"];
    const lines = [header.join(",")];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    rows.forEach((a, i) => {
      const cells = [
        i + 1,
        a.redeemFrom || "",
        a.redeemed || 0,
        a.redeemStatus || (a.redeemSkipped ? "skipped" : (a.redeemError || "ok")),
        a.rechargeTo || "",
        a.recharged || 0,
        a.rechargeStatus || "not-needed",
        a.at || stamp
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vegas-hybrid-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadRechargeSheet(rows) {
    const header = ["#", "Username", "Amount", "Status", "At"];
    const lines = [header.join(",")];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    rows.forEach((a, i) => {
      const cells = [
        i + 1,
        a.username,
        a.amount || 0,
        a.status || (a.error ? "failed" : "ok"),
        a.at || stamp
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vegas-recharges-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function parseUsernameList(text) {
    return [...new Set(
      String(text || "")
        .split(/[\n,;\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )];
  }

  function parseRechargeEntries(text, defaultAmount = 0) {
    const entries = [];
    const lines = String(text || "").split(/\r?\n/);
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const candidate = line.replace(/\s+/g, " ");
      const match = candidate.match(/^([^,;|\t:\s][^,;|\t:]*)\s*(?:[,:;|]|\s+)\s*(\d+(?:\.\d+)?)\s*$/);
      if (match) {
        const username = match[1].trim();
        const amount = Number(match[2]);
        if (username && Number.isFinite(amount) && amount > 0) {
          entries.push({ username, amount });
          return;
        }
      }
      const commaMatch = candidate.match(/^([^,;|\t:\s][^,;|\t:]*)\s*,\s*([^,]+)$/);
      if (commaMatch) {
        const username = commaMatch[1].trim();
        const amount = Number(String(commaMatch[2]).replace(/[^\d.]/g, ""));
        if (username && Number.isFinite(amount) && amount > 0) {
          entries.push({ username, amount });
          return;
        }
      }
      const maybe = candidate.split(/\s+/);
      if (maybe.length >= 2) {
        const username = maybe[0].trim();
        const amount = Number(String(maybe[1]).replace(/[^\d.]/g, ""));
        if (username && Number.isFinite(amount) && amount > 0) {
          entries.push({ username, amount });
          return;
        }
      }
      const amount = Number(String(defaultAmount).replace(/[^\d.]/g, ""));
      if (candidate && Number.isFinite(amount) && amount > 0) {
        entries.push({ username: candidate, amount });
      }
    });
    return entries;
  }

  function formatEta(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "--:--";
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function mount() {
    const existing = document.getElementById("ve-bulk-root");
    if (existing) existing.remove();
    const root = document.createElement("div");
    root.id = "ve-bulk-root";
    root.innerHTML = `
      <style>
        #ve-bulk-root { position:fixed; right:12px; bottom:12px; z-index:2147483646; width:min(360px, calc(100vw - 24px)); max-height:min(96vh, 720px); font-family:Inter,system-ui,sans-serif; }
        #ve-bulk-card { background:#14141c; color:#f4f1ea; border:1px solid rgba(245,197,24,.28); border-radius:14px; padding:12px; box-shadow:0 20px 60px rgba(0,0,0,.45); max-height:min(96vh, 720px); overflow:auto; }
        #ve-bulk-card h3 { margin:0 0 4px; font-size:15px; color:#f5c518; }
        #ve-bulk-card p { margin:0 0 8px; font-size:11px; color:#9a9488; line-height:1.4; }
        #ve-bulk-tabs { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:8px; }
        #ve-bulk-tabs button { border:1px solid rgba(245,197,24,.28); background:#0e0e14; color:#9a9488; border-radius:8px; padding:7px; font-weight:700; cursor:pointer; font-size:12px; }
        #ve-bulk-tabs button.active { background:#f5c518; color:#111; border-color:#f5c518; }
        #ve-bulk-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        #ve-bulk-card label { display:block; font-size:10px; color:#9a9488; margin:0 0 3px; }
        #ve-bulk-card input, #ve-bulk-card textarea { width:100%; box-sizing:border-box; background:#0e0e14; color:#f4f1ea; border:1px solid rgba(245,197,24,.22); border-radius:8px; padding:7px; font-size:13px; }
        #ve-bulk-card textarea { min-height:90px; resize:vertical; font-family:ui-monospace,monospace; }
        #ve-bulk-card .ve-check { display:flex; align-items:center; gap:8px; margin-top:8px; font-size:12px; color:#cfc8ba; }
        #ve-bulk-card .ve-check input { width:auto; }
        #ve-progress-wrap { margin-top:10px; display:none; }
        #ve-progress-wrap.on { display:block; }
        #ve-progress-bar { height:8px; background:#0e0e14; border-radius:999px; overflow:hidden; border:1px solid rgba(245,197,24,.18); }
        #ve-progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#f5c518,#e8a317); transition:width .25s ease; }
        #ve-stats { margin-top:6px; font:11px ui-monospace,monospace; color:#9a9488; line-height:1.45; }
        #ve-job-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:7px; }
        #ve-bulk-log { height:110px; overflow:auto; background:#0e0e14; border-radius:8px; padding:8px; font:11px ui-monospace,monospace; white-space:pre-wrap; margin-top:8px; }
        #ve-bulk-go, #ve-bulk-recharge, #ve-bulk-redeem, #ve-bulk-hybrid, #ve-bulk-sheet, #ve-bulk-x, #ve-bulk-pause, #ve-bulk-stop { width:100%; border:0; border-radius:9px; padding:9px; font-weight:700; cursor:pointer; margin-top:7px; }
        #ve-bulk-go, #ve-bulk-recharge, #ve-bulk-redeem, #ve-bulk-hybrid { background:#f5c518; color:#111; }
        #ve-bulk-go:disabled, #ve-bulk-recharge:disabled, #ve-bulk-redeem:disabled, #ve-bulk-hybrid:disabled, #ve-bulk-pause:disabled, #ve-bulk-stop:disabled { opacity:.55; cursor:wait; }
        #ve-bulk-pause { background:#1c1c28; color:#f5c518; border:1px solid rgba(245,197,24,.28); margin-top:0; }
        #ve-bulk-stop { background:#2a1515; color:#ff8e8e; border:1px solid rgba(255,100,100,.28); margin-top:0; }
        #ve-bulk-sheet { background:#1c1c28; color:#f5c518; border:1px solid rgba(245,197,24,.28); }
        #ve-bulk-sheet:disabled { opacity:.4; cursor:not-allowed; }
        #ve-bulk-x { background:transparent; color:#f5c518; border:1px solid rgba(245,197,24,.28); }
        .ve-pane { display:none; }
        .ve-pane.active { display:block; }
        #ve-vault-box { margin-top:8px; padding:8px; border:1px solid rgba(245,197,24,.22); border-radius:10px; background:#0e0e14; font:11px ui-monospace,monospace; color:#cfc8ba; line-height:1.45; }
        #ve-vault-box strong { color:#f5c518; }
        #ve-list-pick { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
        #ve-list-pick button { border:1px solid rgba(245,197,24,.28); background:#14141c; color:#f4f1ea; border-radius:8px; padding:10px 8px; font-weight:700; cursor:pointer; font-size:12px; }
        #ve-list-pick button.active { background:#f5c518; color:#111; }
        #ve-bulk-smart, #ve-bulk-scan-users, #ve-bulk-rebuild-vault, #ve-bulk-reset-cursor, #ve-bulk-dl-lists, #ve-hybrid-load-vault, #ve-hybrid-swap { width:100%; border:0; border-radius:9px; padding:9px; font-weight:700; cursor:pointer; margin-top:7px; }
        #ve-bulk-smart { background:#f5c518; color:#111; }
        #ve-bulk-scan-users { background:#1a2a1a; color:#7dffb3; border:1px solid rgba(125,255,179,.35); }
        #ve-bulk-rebuild-vault, #ve-bulk-reset-cursor, #ve-bulk-dl-lists, #ve-hybrid-load-vault, #ve-hybrid-swap { background:#1c1c28; color:#f5c518; border:1px solid rgba(245,197,24,.28); }
        #ve-hybrid-hint { font-size:11px; color:#9a9488; line-height:1.4; margin:6px 0 8px; }
        #ve-manual-wrap { margin-top:10px; border-top:1px dashed rgba(245,197,24,.18); padding-top:8px; }
      </style>
      <div id="ve-bulk-card">
        <h3>Vegas Admin Helper</h3>
        <p>Create · recharge · redeem · hybrid (A redeem → B recharge).</p>
        <div id="ve-bulk-tabs">
          <button type="button" id="ve-tab-create" class="active">Create</button>
          <button type="button" id="ve-tab-recharge">Recharge</button>
          <button type="button" id="ve-tab-redeem">Redeem</button>
          <button type="button" id="ve-tab-hybrid">Hybrid</button>
        </div>
        <div id="ve-pane-create" class="ve-pane active">
          <div id="ve-bulk-row">
            <div>
              <label>Accounts (1–1000)</label>
              <input id="ve-bulk-count" type="number" min="1" max="1000" value="${CFG.count}" />
            </div>
            <div>
              <label>Balance each</label>
              <input id="ve-bulk-balance" type="number" min="0" step="0.01" value="${CFG.balance != null ? CFG.balance : 5}" />
            </div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Username prefix</label>
              <input id="ve-bulk-prefix" type="text" maxlength="5" placeholder="optional" value="${CFG.prefix || ""}" />
            </div>
            <div>
              <label>Username postfix</label>
              <input id="ve-bulk-postfix" type="text" maxlength="5" placeholder="optional" value="${CFG.postfix || ""}" />
            </div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Digit length</label>
              <input id="ve-bulk-digits" type="number" min="3" max="6" value="${CFG.digitLen || 4}" />
            </div>
            <div></div>
          </div>
          <label style="margin-top:8px">Password</label>
          <input id="ve-bulk-pass" type="text" value="${CFG.password}" />
          <label style="margin-top:8px">Manager</label>
          <input id="ve-bulk-manager" type="text" value="${CFG.managerHint || ""}" />
          <label class="ve-check"><input id="ve-bulk-unique-pass" type="checkbox" ${CFG.uniquePasswords ? "checked" : ""} /> Unique password per account</label>
          <button id="ve-bulk-go">Start create job</button>
        </div>
        <div id="ve-pane-recharge" class="ve-pane">
          <div id="ve-vault-box">No vault yet. Scan existing accounts, create, or rebuild from saved sheet.</div>
          <div id="ve-list-pick">
            <button type="button" id="ve-pick-list1" class="active">List 1</button>
            <button type="button" id="ve-pick-list2">List 2</button>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Your wallet balance</label>
              <input id="ve-bulk-wallet" type="number" min="0" step="0.01" value="200" />
            </div>
            <div>
              <label>Amount each</label>
              <input id="ve-bulk-recharge-amount" type="number" min="0.01" step="0.01" value="1" />
            </div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Retries each</label>
              <input id="ve-bulk-money-retries" type="number" min="1" max="8" value="3" />
            </div>
            <div></div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Pause every N accounts</label>
              <input id="ve-bulk-batch-every" type="number" min="1" max="100" value="10" />
            </div>
            <div>
              <label>Wait seconds</label>
              <input id="ve-bulk-batch-wait" type="number" min="0" max="300" value="10" />
            </div>
          </div>
          <button id="ve-bulk-smart">Smart recharge (ask list 1/2)</button>
          <button id="ve-bulk-scan-users" type="button">Scan existing accounts → build List 1/2</button>
          <button id="ve-bulk-rebuild-vault" type="button">Rebuild vault from saved create sheet</button>
          <button id="ve-bulk-dl-lists" type="button">Download list1 + list2 CSV</button>
          <button id="ve-bulk-reset-cursor" type="button">Reset selected list cursor</button>
          <div id="ve-manual-wrap">
            <label>Manual paste (optional)</label>
            <textarea id="ve-bulk-recharge-users" placeholder="asher205, 1&#10;madison919 1"></textarea>
            <button id="ve-bulk-recharge">Manual recharge job</button>
          </div>
        </div>
        <div id="ve-pane-redeem" class="ve-pane">
          <label>Usernames (one per line)</label>
          <textarea id="ve-bulk-users" placeholder="asher205&#10;madison919&#10;lucas275"></textarea>
          <label class="ve-check"><input id="ve-bulk-auto-recharge" type="checkbox" /> Auto recharge after each successful redeem</label>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Recharge amount</label>
              <input id="ve-bulk-recharge-after-amount" type="number" min="1" step="0.01" value="5" />
            </div>
            <div>
              <label>Retries each</label>
              <input id="ve-bulk-redeem-retries" type="number" min="1" max="8" value="3" />
            </div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Pause every N accounts</label>
              <input id="ve-bulk-redeem-batch-every" type="number" min="1" max="100" value="10" />
            </div>
            <div>
              <label>Wait seconds</label>
              <input id="ve-bulk-redeem-batch-wait" type="number" min="0" max="300" value="10" />
            </div>
          </div>
          <button id="ve-bulk-redeem">Start redeem job</button>
        </div>
        <div id="ve-pane-hybrid" class="ve-pane">
          <p id="ve-hybrid-hint">Redeem from List A → recharge into List B (paired by row). Same account auto-recharge nahi.</p>
          <label>List A — Redeem FROM</label>
          <textarea id="ve-hybrid-a" placeholder="source1&#10;source2&#10;source3"></textarea>
          <label style="margin-top:8px">List B — Recharge TO</label>
          <textarea id="ve-hybrid-b" placeholder="target1&#10;target2&#10;target3"></textarea>
          <button type="button" id="ve-hybrid-load-vault">Load vault: List1→A · List2→B</button>
          <button type="button" id="ve-hybrid-swap">Swap A ↔ B</button>
          <label class="ve-check" style="margin-top:8px">
            <input id="ve-hybrid-mirror" type="checkbox" checked />
            Recharge amount = redeemed amount (mirror)
          </label>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Fixed recharge (if mirror off)</label>
              <input id="ve-hybrid-fixed" type="number" min="0.01" step="0.01" value="1" />
            </div>
            <div>
              <label>Retries each</label>
              <input id="ve-hybrid-retries" type="number" min="1" max="8" value="3" />
            </div>
          </div>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Pause every N pairs</label>
              <input id="ve-hybrid-batch-every" type="number" min="1" max="100" value="10" />
            </div>
            <div>
              <label>Wait seconds</label>
              <input id="ve-hybrid-batch-wait" type="number" min="0" max="300" value="10" />
            </div>
          </div>
          <button id="ve-bulk-hybrid">Start hybrid job</button>
        </div>
        <div id="ve-job-row">
          <button id="ve-bulk-pause" disabled>Pause</button>
          <button id="ve-bulk-stop" disabled>Stop</button>
        </div>
        <div id="ve-progress-wrap">
          <div id="ve-progress-bar"><div id="ve-progress-fill"></div></div>
          <div id="ve-stats">Idle</div>
        </div>
        <div id="ve-bulk-log">Ready.</div>
        <button id="ve-bulk-sheet" disabled>Download sheet (CSV)</button>
        <button id="ve-bulk-x">Close panel</button>
      </div>`;
    document.body.appendChild(root);

    const logEl = document.getElementById("ve-bulk-log");
    const sheetBtn = document.getElementById("ve-bulk-sheet");
    const goBtn = document.getElementById("ve-bulk-go");
    const pauseBtn = document.getElementById("ve-bulk-pause");
    const stopBtn = document.getElementById("ve-bulk-stop");
    const progressWrap = document.getElementById("ve-progress-wrap");
    const progressFill = document.getElementById("ve-progress-fill");
    const statsEl = document.getElementById("ve-stats");

    let lastCreated = [];
    let lastRecharges = [];
    let lastRedeems = [];
    let lastHybrids = [];
    let sheetMode = "create";
    let job = null;

    const log = (m) => {
      const t = new Date().toLocaleTimeString();
      logEl.textContent += "\n[" + t + "] " + m;
      logEl.scrollTop = logEl.scrollHeight;
    };

    const setTab = (tab) => {
      document.getElementById("ve-tab-create").classList.toggle("active", tab === "create");
      document.getElementById("ve-tab-recharge").classList.toggle("active", tab === "recharge");
      document.getElementById("ve-tab-redeem").classList.toggle("active", tab === "redeem");
      document.getElementById("ve-tab-hybrid").classList.toggle("active", tab === "hybrid");
      document.getElementById("ve-pane-create").classList.toggle("active", tab === "create");
      document.getElementById("ve-pane-recharge").classList.toggle("active", tab === "recharge");
      document.getElementById("ve-pane-redeem").classList.toggle("active", tab === "redeem");
      document.getElementById("ve-pane-hybrid").classList.toggle("active", tab === "hybrid");
      sheetMode = tab;
      if (tab === "create") sheetBtn.disabled = !lastCreated.length;
      else if (tab === "recharge") {
        sheetBtn.disabled = !lastRecharges.length;
        if (typeof refreshVaultUi === "function") refreshVaultUi();
      } else if (tab === "redeem") sheetBtn.disabled = !lastRedeems.length;
      else if (tab === "hybrid") sheetBtn.disabled = !lastHybrids.length;
      else sheetBtn.disabled = true;
    };

    function readCreateCfg() {
      CFG.count = Math.min(1000, Math.max(1, Number(document.getElementById("ve-bulk-count").value) || 1));
      CFG.password = document.getElementById("ve-bulk-pass").value.trim();
      CFG.balance = Math.max(0, Number(document.getElementById("ve-bulk-balance").value) || 0);
      CFG.prefix = document.getElementById("ve-bulk-prefix").value.trim();
      CFG.postfix = document.getElementById("ve-bulk-postfix").value.trim();
      CFG.digitLen = Math.min(6, Math.max(3, Number(document.getElementById("ve-bulk-digits").value) || 4));
      CFG.managerHint = document.getElementById("ve-bulk-manager").value.trim();
      CFG.uniquePasswords = document.getElementById("ve-bulk-unique-pass").checked;
    }

    const rechargeBtn = document.getElementById("ve-bulk-recharge");
    const redeemBtn = document.getElementById("ve-bulk-redeem");
    const hybridBtn = document.getElementById("ve-bulk-hybrid");
    const smartBtn = document.getElementById("ve-bulk-smart");
    let selectedListNo = 1;

    function refreshVaultUi() {
      const box = document.getElementById("ve-vault-box");
      if (!box) return;
      const vault = getActiveVault();
      if (!vault) {
        box.innerHTML = "No vault yet. Create accounts or <em>Rebuild from saved create sheet</em>.";
        return;
      }
      const st = vaultStats(vault);
      box.innerHTML =
        "<strong>" + vault.id + "</strong><br>" +
        "Total <strong>" + st.total + "</strong> · List1 <strong>" + st.list1Size + "</strong> (left " + st.list1Left + ") · List2 <strong>" + st.list2Size + "</strong> (left " + st.list2Left + ")<br>" +
        "Cursor L1 #" + (st.list1Done + 1) + " · L2 #" + (st.list2Done + 1) + " · mgr " + (vault.manager || "—");
      document.getElementById("ve-pick-list1").classList.toggle("active", selectedListNo === 1);
      document.getElementById("ve-pick-list2").classList.toggle("active", selectedListNo === 2);
    }

    document.getElementById("ve-pick-list1").onclick = () => { selectedListNo = 1; refreshVaultUi(); };
    document.getElementById("ve-pick-list2").onclick = () => { selectedListNo = 2; refreshVaultUi(); };

    document.getElementById("ve-bulk-scan-users").onclick = async () => {
      if (job && (job.state === "running" || job.state === "paused")) {
        log("Another job is running. Pause/Stop first.");
        return;
      }
      const scanBtn = document.getElementById("ve-bulk-scan-users");
      const manager = (document.getElementById("ve-bulk-manager") && document.getElementById("ve-bulk-manager").value.trim()) || CFG.managerHint || "manager";
      const ok = window.confirm(
        "User List se saari existing Player usernames scan karni hain?\\n" +
        "Pehle app.vegasempire.co → Users page khula rakho.\\n" +
        "Phir auto List1/List2 ban jayegi."
      );
      if (!ok) return;

      scanBtn.disabled = true;
      goBtn.disabled = true;
      rechargeBtn.disabled = true;
      if (smartBtn) smartBtn.disabled = true;
      redeemBtn.disabled = true;
      if (hybridBtn) hybridBtn.disabled = true;
      job = { state: "running", kind: "scan", total: 1, ok: 0, fail: 0, skipped: 0, dups: 0, done: 0 };
      setJobUi("running");
      progressWrap.classList.add("on");
      statsEl.textContent = "Scanning User List…";

      try {
        const usernames = await harvestExistingUsernames(log, { playersOnly: true, maxPages: 400 });
        const vaultName = window.prompt("Vault/file name?", "existing-" + manager) || ("existing-" + manager);
        const vault = upsertVaultFromUsernames(usernames, {
          name: vaultName,
          manager,
          accounts: usernames.map((username) => ({ username, name: username, status: "harvested" }))
        });
        // Also mirror into created backup so rebuild works later
        keepCreatedBackup(
          usernames.map((username) => ({ username, name: username, status: "harvested", createdAt: new Date().toLocaleString() })),
          vault.name
        );
        lastCreated = usernames.map((username) => ({ username, name: username, status: "harvested" }));
        sheetBtn.disabled = false;
        sheetMode = "create";
        const st = vaultStats(vault);
        downloadListCsv(vault.name + "-ALL", usernames);
        downloadVaultHalves(vault);
        refreshVaultUi();
        log("Vault ready: " + vault.id + " · " + st.total + " → L1 " + st.list1Size + " / L2 " + st.list2Size);
        log("Downloaded ALL + list1 + list2 CSV.");
        alert("Scan done: " + st.total + " usernames\\nList1: " + st.list1Size + "\\nList2: " + st.list2Size);
        job.state = "done";
        job.ok = st.total;
        setJobUi("done");
        renderStats({
          kind: "scan",
          total: st.total,
          done: st.total,
          ok: st.total,
          fail: 0,
          skipped: 0,
          dups: 0,
          remaining: 0,
          avgMs: 0,
          state: "done"
        });
      } catch (err) {
        log("Scan failed: " + ((err && err.message) || err));
        job.state = "stopped";
        setJobUi("stopped");
      } finally {
        scanBtn.disabled = false;
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        if (smartBtn) smartBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    };

    document.getElementById("ve-bulk-rebuild-vault").onclick = () => {
      const saved = restoreCreatedBackup();
      if (!saved || !saved.rows.length) {
        // Also allow building from manual textarea usernames
        const pasted = parseUsernameList(document.getElementById("ve-bulk-recharge-users").value);
        if (!pasted.length) {
          log("No saved create sheet or pasted usernames to rebuild vault.");
          return;
        }
        const vault = upsertVaultFromUsernames(pasted, {
          name: CFG.sheetName || "manual-list",
          manager: CFG.managerHint || document.getElementById("ve-bulk-manager")?.value || "manager"
        });
        const st = vaultStats(vault);
        log("Vault from paste: " + st.total + " → L1 " + st.list1Size + " / L2 " + st.list2Size);
        downloadVaultHalves(vault);
        refreshVaultUi();
        return;
      }
      lastCreated = saved.rows.slice();
      const vault = upsertVaultFromRows(saved.rows, {
        name: saved.fileName || CFG.sheetName,
        manager: CFG.managerHint,
        accounts: saved.rows
      });
      const st = vaultStats(vault);
      log("Vault rebuilt: " + vault.id + " · " + st.total + " → L1 " + st.list1Size + " / L2 " + st.list2Size);
      downloadVaultHalves(vault);
      refreshVaultUi();
    };

    document.getElementById("ve-bulk-dl-lists").onclick = () => {
      const vault = getActiveVault();
      if (!vault) { log("No active vault."); return; }
      downloadVaultHalves(vault);
      log("Downloaded list1 + list2 for " + vault.id);
    };

    document.getElementById("ve-bulk-reset-cursor").onclick = () => {
      const vault = getActiveVault();
      if (!vault) { log("No active vault."); return; }
      const which = window.prompt("Reset cursor for list? Type 1, 2, or both", String(selectedListNo));
      if (which === null) return;
      const w = String(which).trim().toLowerCase();
      if (w === "both" || w === "0") resetVaultCursor(vault.id, 0);
      else if (w === "2") resetVaultCursor(vault.id, 2);
      else resetVaultCursor(vault.id, 1);
      log("Cursor reset for " + w);
      refreshVaultUi();
    };

    refreshVaultUi();


    function setJobUi(state) {
      const running = state === "running" || state === "paused";
      goBtn.disabled = running;
      rechargeBtn.disabled = running;
      if (typeof smartBtn !== "undefined" && smartBtn) smartBtn.disabled = running;
      const scanBtn = document.getElementById("ve-bulk-scan-users");
      if (scanBtn) scanBtn.disabled = running;
      redeemBtn.disabled = running;
      if (hybridBtn) hybridBtn.disabled = running;
      pauseBtn.disabled = !running;
      stopBtn.disabled = !running;
      pauseBtn.textContent = state === "paused" ? "Resume" : "Pause";
      progressWrap.classList.toggle("on", running || state === "done" || state === "stopped");
    }

    function renderStats(stats) {
      const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
      progressFill.style.width = pct + "%";
      const eta = stats.avgMs && stats.remaining
        ? formatEta(stats.avgMs * stats.remaining)
        : "--:--";
      const extra = stats.kind === "create"
        ? stats.dups + " dup-retry"
        : (stats.skipped || 0) + " skip";
      statsEl.textContent =
        (stats.kind ? stats.kind + " · " : "") +
        pct + "% · " + stats.ok + " ok · " + stats.fail + " fail · " + extra + " · ETA " + eta +
        (stats.state === "paused" ? " · PAUSED" : "") +
        (stats.state === "stopped" ? " · STOPPED" : "");
    }

    async function waitIfPaused() {
      while (job && job.state === "paused") {
        await sleep(200);
      }
      if (!job || job.state === "stopped") throw new Error("__STOP__");
    }

    function readBatchPace(kind) {
      let everyEl;
      let waitEl;
      if (kind === "redeem") {
        everyEl = document.getElementById("ve-bulk-redeem-batch-every");
        waitEl = document.getElementById("ve-bulk-redeem-batch-wait");
      } else if (kind === "hybrid") {
        everyEl = document.getElementById("ve-hybrid-batch-every");
        waitEl = document.getElementById("ve-hybrid-batch-wait");
      } else {
        everyEl = document.getElementById("ve-bulk-batch-every");
        waitEl = document.getElementById("ve-bulk-batch-wait");
      }
      return {
        every: Math.min(100, Math.max(1, Number(everyEl && everyEl.value) || CFG.batchEvery || 10)),
        waitSec: Math.min(300, Math.max(0, Number(waitEl && waitEl.value) || CFG.batchWaitSec || 10))
      };
    }

    async function awaitBatchCooldown(doneCount, total, log, kind) {
      const pace = readBatchPace(kind || "recharge");
      if (!pace.waitSec || !pace.every) return;
      if (doneCount <= 0 || doneCount >= total) return;
      if (doneCount % pace.every !== 0) return;
      log("⏸ Batch pause after " + doneCount + " accounts — waiting " + pace.waitSec + "s…");
      const end = Date.now() + pace.waitSec * 1000;
      while (Date.now() < end) {
        await waitIfPaused();
        dismissRuntimeErrorOverlay();
        const left = end - Date.now();
        if (left <= 0) break;
        await sleep(Math.min(250, left));
      }
      await recoverFromUiBlockers(log);
      log("▶ Batch pause done — next " + pace.every + " accounts…");
    }


    async function runCreateJob() {
      readCreateCfg();
      if (CFG.password.length < 6) {
        log("Password must be at least 6 characters.");
        return;
      }

      const saved = restoreCreatedBackup();
      if (saved && saved.rows.length) {
        lastCreated = saved.rows.slice();
        sheetBtn.disabled = false;
        log("Recovered saved file: " + saved.fileName + " (" + saved.rows.length + " accounts already stored).");
      }

      const promptFile = window.prompt("Excel file name save karna hai? (without .csv)", CFG.sheetName || "vegas-accounts");
      if (promptFile === null) {
        log("Create job cancelled. Save name not chosen.");
        return;
      }
      CFG.sheetName = normalizeSheetName(promptFile);
      if (!CFG.sheetName) {
        log("Invalid file name. Please enter a valid sheet name.");
        return;
      }
      localStorage.setItem("vegas-bulk-sheet-name", CFG.sheetName);
      log("Sheet name set: " + CFG.sheetName + ".csv");

      const factory = createAccountFactory(CFG);
      const queue = factory.preallocate(CFG.count);
      const created = [];
      const startedAt = Date.now();
      const timings = [];
      let consecutiveFails = 0;

      job = {
        state: "running",
        kind: "create",
        total: CFG.count,
        ok: 0,
        fail: 0,
        dups: 0,
        done: 0
      };
      setJobUi("running");
      log("Job started: " + CFG.count + " accounts · prefix=" + (CFG.prefix || "none") +
        " · postfix=" + (CFG.postfix || "none") + " · digits=" + CFG.digitLen + " · uniquePass=" + CFG.uniquePasswords);

      try {
        for (let i = 0; i < queue.length; i++) {
          await waitIfPaused();
          let account = queue[i];
          const tickStart = Date.now();
          log((i + 1) + "/" + CFG.count + "  " + account.name + " / " + account.username);

          let success = false;
          for (let attempt = 0; attempt < (CFG.maxRetries || 5); attempt++) {
            await waitIfPaused();
            try {
              await createOne(account, log);
              account.createdAt = new Date().toLocaleString();
              account.balanceLoaded = 0;
              account.status = "created";
              if (CFG.balance > 0) {
                await withMoneyRetries(
                  () => rechargeOne(account.username, CFG.balance, log),
                  "recharge " + account.username,
                  log,
                  CFG.maxRetries || 3
                );
                account.balanceLoaded = CFG.balance;
                account.status = "created+recharged";
              }
              created.push(account);
              lastCreated = created.slice();
              keepCreatedBackup(lastCreated, CFG.sheetName);
              sheetMode = "create";
              sheetBtn.disabled = false;
              job.ok += 1;
              consecutiveFails = 0;
              success = true;
              break;
            } catch (err) {
              if (err && err.message === "__STOP__") throw err;
              if (err instanceof DupUsernameError || (err && /already in use/i.test(err.message || ""))) {
                job.dups += 1;
                log("dup " + account.username + " → regenerating");
                account = factory.remake(account);
                queue[i] = account;
                await sleep(400);
                continue;
              }
              log("FAIL " + account.username + ": " + ((err && err.message) || err));
              dismissOpenDialogs();
              consecutiveFails += 1;
              const backoff = Math.min(5000, 600 * consecutiveFails);
              await sleep(backoff);
              if (attempt < (CFG.maxRetries || 5) - 1) {
                log("retry " + (attempt + 2) + "/" + (CFG.maxRetries || 5));
                continue;
              }
            }
          }

          if (!success) {
            job.fail += 1;
            account.status = "failed";
            account.createdAt = new Date().toLocaleString();
          }

          timings.push(Date.now() - tickStart);
          job.done = i + 1;
          const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
          renderStats({
            kind: "create",
            total: job.total,
            done: job.done,
            ok: job.ok,
            fail: job.fail,
            dups: job.dups,
            remaining: job.total - job.done,
            avgMs,
            state: job.state
          });

          if (created.length && CFG.checkpointEvery > 0 && created.length % CFG.checkpointEvery === 0) {
            downloadSheet(created, CFG.password, CFG.balance);
            log("Checkpoint CSV · " + created.length + " accounts");
          }

          // Light pacing — longer after failures to let UI settle
          await sleep(consecutiveFails ? 500 : 220);
        }

        const elapsed = formatEta(Date.now() - startedAt);
        log("Done. " + job.ok + "/" + CFG.count + " ok · " + job.fail + " fail · " + job.dups + " dup-retries · " + elapsed);
        if (created.length) {
          downloadSheet(created, CFG.password, CFG.balance);
          log("Final sheet downloaded.");
          try {
            const vault = upsertVaultFromRows(created, {
              name: CFG.sheetName,
              manager: CFG.managerHint,
              accounts: created
            });
            const st = vaultStats(vault);
            log("Vault built: " + vault.id + " · total " + st.total +
              " → List1 " + st.list1Size + " / List2 " + st.list2Size);
            downloadVaultHalves(vault);
            log("Downloaded list1 + list2 CSV.");
            if (typeof refreshVaultUi === "function") refreshVaultUi();
          } catch (vaultErr) {
            log("Vault build skipped: " + ((vaultErr && vaultErr.message) || vaultErr));
          }
        }
        console.table(created.map((a) => ({
          name: a.name,
          username: a.username,
          password: a.password || CFG.password,
          balance: a.balanceLoaded,
          status: a.status
        })));
        job.state = "done";
        setJobUi("done");
      } catch (e) {
        if (e && e.message === "__STOP__") {
          log("Stopped by user after " + created.length + " successes.");
          job.state = "stopped";
        } else {
          log("Job error: " + ((e && e.message) || e));
          job.state = "stopped";
        }
        if (created.length) {
          lastCreated = created.slice();
          keepCreatedBackup(lastCreated, CFG.sheetName);
          sheetBtn.disabled = false;
          downloadSheet(created, CFG.password, CFG.balance);
          log("Partial sheet downloaded for " + created.length + " accounts.");
        }
        setJobUi(job.state);
        renderStats({
          kind: "create",
          total: job.total,
          done: job.done,
          ok: job.ok,
          fail: job.fail,
          dups: job.dups,
          remaining: job.total - job.done,
          avgMs: timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0,
          state: job.state
        });
      } finally {
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    }

    document.getElementById("ve-tab-create").onclick = () => setTab("create");
    document.getElementById("ve-tab-recharge").onclick = () => setTab("recharge");
    document.getElementById("ve-tab-redeem").onclick = () => setTab("redeem");
    document.getElementById("ve-tab-hybrid").onclick = () => setTab("hybrid");
    document.getElementById("ve-bulk-x").onclick = () => root.remove();

    sheetBtn.onclick = () => {
      if (sheetMode === "recharge") {
        if (!lastRecharges.length) return;
        downloadRechargeSheet(lastRecharges);
        log("Recharge sheet downloaded.");
        return;
      }
      if (sheetMode === "redeem") {
        if (!lastRedeems.length) return;
        downloadRedeemSheet(lastRedeems);
        log("Redeem sheet downloaded.");
        return;
      }
      if (sheetMode === "hybrid") {
        if (!lastHybrids.length) return;
        downloadHybridSheet(lastHybrids);
        log("Hybrid sheet downloaded.");
        return;
      }
      if (!lastCreated.length) return;
      downloadSheet(lastCreated, CFG.password, CFG.balance);
      log("Sheet downloaded again.");
    };

    goBtn.onclick = () => {
      if (job && (job.state === "running" || job.state === "paused")) return;
      runCreateJob();
    };

    pauseBtn.onclick = () => {
      if (!job) return;
      if (job.state === "running") {
        job.state = "paused";
        pauseBtn.textContent = "Resume";
        log("Paused.");
        renderStats({
          kind: job.kind || "create",
          total: job.total,
          done: job.done,
          ok: job.ok,
          fail: job.fail,
          dups: job.dups || 0,
          skipped: job.skipped || 0,
          remaining: job.total - job.done,
          avgMs: 0,
          state: "paused"
        });
      } else if (job.state === "paused") {
        job.state = "running";
        pauseBtn.textContent = "Pause";
        log("Resumed.");
      }
    };

    stopBtn.onclick = () => {
      if (!job) return;
      job.state = "stopped";
      log("Stop requested… finishing current step then exiting.");
    };

    async function runWalletAwareRechargeJob(entries, meta) {
      const retriesEl = document.getElementById("ve-bulk-money-retries");
      const retries = Math.min(8, Math.max(1, Number(retriesEl && retriesEl.value) || 3));
      if (!entries.length) {
        log("Nothing to recharge in this batch.");
        return;
      }
      const results = [];
      const timings = [];
      const startedAt = Date.now();
      let spent = 0;
      job = {
        state: "running",
        kind: "recharge",
        total: entries.length,
        ok: 0,
        fail: 0,
        skipped: 0,
        dups: 0,
        done: 0
      };
      setJobUi("running");
      sheetBtn.disabled = true;
      const pace = readBatchPace("recharge");
      log("Smart recharge: list " + (meta.listNo || "?") + " · " + entries.length + " accounts · amount " +
        (meta.amount || "?") + " · wallet " + (meta.wallet || "?") + " · retries=" + retries +
        " · pause every " + pace.every + " / " + pace.waitSec + "s");

      try {
        for (let i = 0; i < entries.length; i++) {
          await waitIfPaused();
          const { username, amount } = entries[i];
          const tickStart = Date.now();
          log((i + 1) + "/" + entries.length + "  " + username + " → " + amount);
          try {
            await withMoneyRetries(
              () => rechargeOne(username, amount, log),
              "recharge " + username,
              log,
              retries
            );
            results.push({ username, amount, status: "ok", at: new Date().toLocaleString() });
            job.ok += 1;
            spent += Number(amount) || 0;
            if (meta.vaultId && meta.listNo) {
              advanceVaultCursor(meta.vaultId, meta.listNo, 1);
              refreshVaultUi();
            }
          } catch (err) {
            if (err && err.message === "__STOP__") throw err;
            const msg = (err && err.message) || String(err);
            results.push({ username, amount, status: "failed", error: msg, at: new Date().toLocaleString() });
            job.fail += 1;
            log("Failed " + username + ": " + msg);
            await escapeUi();
            if (/admin balance|insufficient|disabled|cannot exceed/i.test(msg)) {
              log("Wallet likely empty — stopping batch to protect remaining accounts.");
              break;
            }
          }
          timings.push(Date.now() - tickStart);
          job.done = i + 1;
          lastRecharges = results.slice();
          sheetMode = "recharge";
          sheetBtn.disabled = false;
          renderStats({
            kind: "recharge",
            total: job.total,
            done: job.done,
            ok: job.ok,
            fail: job.fail,
            skipped: job.skipped,
            dups: 0,
            remaining: job.total - job.done,
            avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
            state: job.state
          });
          if (results.length && results.length % 25 === 0) {
            downloadRechargeSheet(results);
            log("Checkpoint CSV · " + results.length + " recharges");
          }
          await sleep(280);
          await awaitBatchCooldown(job.done, entries.length, log, "recharge");
        }
        log("Done. Spent ~" + spent + " · " + job.ok + " ok / " + job.fail + " fail · " + formatEta(Date.now() - startedAt));
        if (results.length) {
          downloadRechargeSheet(results);
          log("Sheet downloaded: vegas-recharges-*.csv");
        }
        console.table(results);
        job.state = "done";
        setJobUi("done");
        refreshVaultUi();
      } catch (e) {
        if (e && e.message === "__STOP__") {
          log("Recharge stopped after " + job.ok + " successes.");
          job.state = "stopped";
        } else {
          log("Recharge job error: " + ((e && e.message) || e));
          job.state = "stopped";
        }
        if (results.length) {
          lastRecharges = results.slice();
          sheetBtn.disabled = false;
          downloadRechargeSheet(results);
        }
        setJobUi(job.state);
        refreshVaultUi();
      } finally {
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        if (smartBtn) smartBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    }

    smartBtn.onclick = async () => {
      if (job && (job.state === "running" || job.state === "paused")) {
        log("Another job is running. Pause/Stop first.");
        return;
      }
      let vault = getActiveVault();
      if (!vault) {
        const saved = restoreCreatedBackup();
        if (saved && saved.rows.length) {
          vault = upsertVaultFromRows(saved.rows, {
            name: saved.fileName || CFG.sheetName,
            manager: CFG.managerHint,
            accounts: saved.rows
          });
          refreshVaultUi();
          log("Auto-rebuilt vault from saved sheet.");
        }
      }
      if (!vault) {
        log("No vault. Create accounts first, or rebuild from saved sheet / paste usernames.");
        return;
      }

      const st = vaultStats(vault);
      const ask = window.prompt(
        "Vault " + vault.id + "\\n" +
        "List 1: " + st.list1Size + " (left " + st.list1Left + ")\\n" +
        "List 2: " + st.list2Size + " (left " + st.list2Left + ")\\n\\n" +
        "Kaunsi list recharge karni hai? Type 1 or 2",
        String(selectedListNo)
      );
      if (ask === null) { log("Smart recharge cancelled."); return; }
      const listNo = Number(String(ask).trim()) === 2 ? 2 : 1;
      selectedListNo = listNo;
      refreshVaultUi();

      let amount = Math.max(0, Number(document.getElementById("ve-bulk-recharge-amount").value) || 0);
      if (amount <= 0) {
        const a = window.prompt("Har account pe kitna load?", "1");
        if (a === null) return;
        amount = Math.max(0, Number(a) || 0);
        document.getElementById("ve-bulk-recharge-amount").value = String(amount || 1);
      }
      if (amount <= 0) { log("Invalid amount."); return; }

      let wallet = Math.max(0, Number(document.getElementById("ve-bulk-wallet").value) || 0);
      if (!(wallet > 0)) {
        const w = window.prompt("Aapka available wallet/admin balance kitna hai?", "200");
        if (w === null) return;
        wallet = Math.max(0, Number(w) || 0);
        document.getElementById("ve-bulk-wallet").value = String(wallet);
      }
      if (!(wallet > 0)) { log("Wallet balance required."); return; }

      let plan;
      try {
        plan = planWalletAwareBatch(vault, listNo, amount, wallet);
      } catch (err) {
        log((err && err.message) || err);
        return;
      }

      if (!plan.take) {
        log("List " + listNo + " pe pending accounts khatam hain, ya wallet (" + wallet +
          ") se amount " + amount + " cover nahi hota. Capacity=" + plan.capacity + ".");
        return;
      }

      const ok = window.confirm(
        "List " + listNo + " se " + plan.take + " accounts recharge?\\n" +
        "Amount each: " + amount + "\\n" +
        "Wallet: " + wallet + " → spend ~" + plan.spend + " · leftover ~" + plan.leftoverWallet + "\\n" +
        "Pending after: " + plan.remainingAfter + "\\n\\nContinue?"
      );
      if (!ok) { log("Smart recharge cancelled."); return; }

      goBtn.disabled = true;
      rechargeBtn.disabled = true;
      smartBtn.disabled = true;
      redeemBtn.disabled = true;
      if (hybridBtn) hybridBtn.disabled = true;
      await runWalletAwareRechargeJob(plan.batch, {
        vaultId: plan.vaultId,
        listNo: plan.listNo,
        amount: plan.amount,
        wallet: plan.wallet
      });
    };

    document.getElementById("ve-bulk-recharge").onclick = async () => {
      if (job && (job.state === "running" || job.state === "paused")) {
        log("Another job is running. Pause/Stop first.");
        return;
      }
      const defaultAmount = Math.max(0, Number(document.getElementById("ve-bulk-recharge-amount").value) || 0);
      const retriesEl = document.getElementById("ve-bulk-money-retries");
      const retries = Math.min(8, Math.max(1, Number(retriesEl && retriesEl.value) || 3));
      const entries = parseRechargeEntries(document.getElementById("ve-bulk-recharge-users").value, defaultAmount);
      if (!entries.length) {
        log("Paste usernames with amounts first, or use the default amount field.");
        return;
      }

      const results = [];
      const timings = [];
      const startedAt = Date.now();
      job = {
        state: "running",
        kind: "recharge",
        total: entries.length,
        ok: 0,
        fail: 0,
        skipped: 0,
        dups: 0,
        done: 0
      };
      setJobUi("running");
      sheetBtn.disabled = true;
      const pace = readBatchPace("recharge");
      log("Recharge job: " + entries.length + " users · retries=" + retries +
        " · pause every " + pace.every + " / " + pace.waitSec + "s");

      try {
        for (let i = 0; i < entries.length; i++) {
          await waitIfPaused();
          const { username, amount } = entries[i];
          const tickStart = Date.now();
          log((i + 1) + "/" + entries.length + "  " + username + " → " + amount);
          try {
            await withMoneyRetries(
              () => rechargeOne(username, amount, log),
              "recharge " + username,
              log,
              retries
            );
            results.push({
              username,
              amount,
              status: "ok",
              at: new Date().toLocaleString()
            });
            job.ok += 1;
          } catch (err) {
            if (err && err.message === "__STOP__") throw err;
            results.push({
              username,
              amount,
              status: "failed",
              error: (err && err.message) || String(err),
              at: new Date().toLocaleString()
            });
            job.fail += 1;
            log("Failed " + username + ": " + ((err && err.message) || err));
            await escapeUi();
          }
          timings.push(Date.now() - tickStart);
          job.done = i + 1;
          lastRecharges = results.slice();
          sheetMode = "recharge";
          sheetBtn.disabled = false;
          renderStats({
            kind: "recharge",
            total: job.total,
            done: job.done,
            ok: job.ok,
            fail: job.fail,
            skipped: job.skipped,
            dups: 0,
            remaining: job.total - job.done,
            avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
            state: job.state
          });
          if (results.length && results.length % 25 === 0) {
            downloadRechargeSheet(results);
            log("Checkpoint CSV · " + results.length + " recharges");
          }
          await sleep(280);
          await awaitBatchCooldown(job.done, entries.length, log, "recharge");
        }
        const okTotal = results.filter((r) => r.status === "ok").reduce((s, r) => s + (Number(r.amount) || 0), 0);
        log("Done. Recharged " + okTotal + " · " + job.ok + " ok / " + job.fail + " fail · " + formatEta(Date.now() - startedAt));
        downloadRechargeSheet(results);
        log("Sheet downloaded: vegas-recharges-*.csv");
        console.table(results);
        job.state = "done";
        setJobUi("done");
      } catch (e) {
        if (e && e.message === "__STOP__") {
          log("Recharge stopped after " + job.ok + " successes.");
          job.state = "stopped";
        } else {
          log("Recharge job error: " + ((e && e.message) || e));
          job.state = "stopped";
        }
        if (results.length) {
          lastRecharges = results.slice();
          sheetBtn.disabled = false;
          downloadRechargeSheet(results);
        }
        setJobUi(job.state);
      } finally {
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    };

    document.getElementById("ve-bulk-redeem").onclick = async () => {
      if (job && (job.state === "running" || job.state === "paused")) {
        log("Another job is running. Pause/Stop first.");
        return;
      }
      const users = parseUsernameList(document.getElementById("ve-bulk-users").value);
      const autoRechargeEnabled = document.getElementById("ve-bulk-auto-recharge").checked;
      const retriesEl = document.getElementById("ve-bulk-redeem-retries");
      const retries = Math.min(8, Math.max(1, Number(retriesEl && retriesEl.value) || 3));
      let autoRechargeAmount = Math.max(0, Number(document.getElementById("ve-bulk-recharge-after-amount").value) || 0);

      if (!users.length) {
        log("Paste usernames first (one per line).");
        return;
      }

      if (autoRechargeEnabled && autoRechargeAmount <= 0) {
        const prompted = window.prompt("Kitna recharge karna hai har successful redeem ke baad?", "5");
        if (prompted === null) {
          log("Auto recharge cancelled.");
          document.getElementById("ve-bulk-auto-recharge").checked = false;
          return;
        }
        autoRechargeAmount = Math.max(0, Number(prompted) || 0);
        if (autoRechargeAmount <= 0) {
          log("Auto recharge amount invalid. Recharge disabled.");
          document.getElementById("ve-bulk-auto-recharge").checked = false;
          return;
        }
        document.getElementById("ve-bulk-recharge-after-amount").value = String(autoRechargeAmount);
      }

      const results = [];
      const timings = [];
      const startedAt = Date.now();
      job = {
        state: "running",
        kind: "redeem",
        total: users.length,
        ok: 0,
        fail: 0,
        skipped: 0,
        dups: 0,
        done: 0
      };
      setJobUi("running");
      sheetBtn.disabled = true;
      const pace = readBatchPace("redeem");
      log("Redeem job: " + users.length + " users · retries=" + retries +
        (autoRechargeEnabled ? (" · auto-recharge +" + autoRechargeAmount) : "") +
        " · pause every " + pace.every + " / " + pace.waitSec + "s");

      try {
        for (let i = 0; i < users.length; i++) {
          await waitIfPaused();
          const username = users[i];
          const tickStart = Date.now();
          log((i + 1) + "/" + users.length + "  " + username);
          try {
            const r = await withMoneyRetries(
              () => redeemOne(username, log),
              "redeem " + username,
              log,
              retries
            );
            r.at = new Date().toLocaleString();

            if (r.skipped) {
              job.skipped += 1;
              r.recharged = 0;
              r.rechargeStatus = "not-needed";
            } else {
              job.ok += 1;
              if (autoRechargeEnabled && Number(r.redeemed) > 0) {
                try {
                  await withMoneyRetries(
                    () => rechargeOne(username, autoRechargeAmount, log),
                    "auto-recharge " + username,
                    log,
                    retries
                  );
                  r.recharged = autoRechargeAmount;
                  r.rechargeStatus = "ok";
                  log(username + " auto-recharged +" + autoRechargeAmount);
                } catch (rechargeErr) {
                  if (rechargeErr && rechargeErr.message === "__STOP__") throw rechargeErr;
                  r.recharged = 0;
                  r.rechargeStatus = "failed";
                  r.rechargeError = (rechargeErr && rechargeErr.message) || String(rechargeErr);
                  log("Auto recharge failed for " + username + ": " + r.rechargeError);
                  await escapeUi();
                }
              } else {
                r.recharged = 0;
                r.rechargeStatus = "not-needed";
              }
            }
            results.push(r);
          } catch (err) {
            if (err && err.message === "__STOP__") throw err;
            results.push({
              username,
              redeemed: 0,
              recharged: 0,
              rechargeStatus: "not-needed",
              skipped: false,
              error: (err && err.message) || String(err),
              at: new Date().toLocaleString()
            });
            job.fail += 1;
            log("Failed " + username + ": " + ((err && err.message) || err));
            await escapeUi();
          }
          timings.push(Date.now() - tickStart);
          job.done = i + 1;
          lastRedeems = results.slice();
          sheetMode = "redeem";
          sheetBtn.disabled = false;
          renderStats({
            kind: "redeem",
            total: job.total,
            done: job.done,
            ok: job.ok,
            fail: job.fail,
            skipped: job.skipped,
            dups: 0,
            remaining: job.total - job.done,
            avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
            state: job.state
          });
          if (results.length && results.length % 25 === 0) {
            downloadRedeemSheet(results);
            log("Checkpoint CSV · " + results.length + " redeems");
          }
          await sleep(280);
          await awaitBatchCooldown(job.done, users.length, log, "redeem");
        }
        const total = results.reduce((s, r) => s + (Number(r.redeemed) || 0), 0);
        const rechargedTotal = results.reduce((s, r) => s + (Number(r.recharged) || 0), 0);
        log("Done. Redeemed " + total + " · auto-recharged " + rechargedTotal +
          " · " + job.ok + " ok / " + job.skipped + " skip / " + job.fail + " fail · " + formatEta(Date.now() - startedAt));
        downloadRedeemSheet(results);
        log("Sheet downloaded: vegas-redeems-*.csv");
        console.table(results);
        job.state = "done";
        setJobUi("done");
      } catch (e) {
        if (e && e.message === "__STOP__") {
          log("Redeem stopped after " + job.ok + " successes.");
          job.state = "stopped";
        } else {
          log("Redeem job error: " + ((e && e.message) || e));
          job.state = "stopped";
        }
        if (results.length) {
          lastRedeems = results.slice();
          sheetBtn.disabled = false;
          downloadRedeemSheet(results);
        }
        setJobUi(job.state);
      } finally {
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    };

    document.getElementById("ve-hybrid-load-vault").onclick = () => {
      const vault = getActiveVault();
      if (!vault) {
        log("No vault. Scan or rebuild first.");
        return;
      }
      document.getElementById("ve-hybrid-a").value = (vault.list1 || []).join("\n");
      document.getElementById("ve-hybrid-b").value = (vault.list2 || []).join("\n");
      log("Hybrid loaded vault " + vault.id + " · A=" + (vault.list1 || []).length + " · B=" + (vault.list2 || []).length);
    };

    document.getElementById("ve-hybrid-swap").onclick = () => {
      const a = document.getElementById("ve-hybrid-a");
      const b = document.getElementById("ve-hybrid-b");
      const tmp = a.value;
      a.value = b.value;
      b.value = tmp;
      log("Hybrid lists swapped A ↔ B.");
    };

    hybridBtn.onclick = async () => {
      if (job && (job.state === "running" || job.state === "paused")) {
        log("Another job is running. Pause/Stop first.");
        return;
      }
      const listA = parseUsernameList(document.getElementById("ve-hybrid-a").value);
      const listB = parseUsernameList(document.getElementById("ve-hybrid-b").value);
      const mirror = document.getElementById("ve-hybrid-mirror").checked;
      const fixedAmount = Math.max(0, Number(document.getElementById("ve-hybrid-fixed").value) || 0);
      const retries = Math.min(8, Math.max(1, Number(document.getElementById("ve-hybrid-retries").value) || 3));
      const pace = readBatchPace("hybrid");

      if (!listA.length || !listB.length) {
        log("Hybrid needs both lists: A (redeem from) and B (recharge to).");
        return;
      }
      if (!mirror && fixedAmount <= 0) {
        log("Mirror off — fixed recharge amount > 0 chahiye.");
        return;
      }

      const pairCount = Math.min(listA.length, listB.length);
      if (listA.length !== listB.length) {
        log("Warning: A=" + listA.length + " B=" + listB.length + " → pairing first " + pairCount + " rows.");
      }

      const samePairs = [];
      for (let i = 0; i < pairCount; i++) {
        if (String(listA[i]).toLowerCase() === String(listB[i]).toLowerCase()) samePairs.push(listA[i]);
      }
      if (samePairs.length) {
        const go = window.confirm(
          samePairs.length + " pairs mein SAME username hai.\\nContinue anyway?\\n\\n" + samePairs.slice(0, 5).join(", ")
        );
        if (!go) return;
      }

      const ok = window.confirm(
        "Hybrid job\\nPairs: " + pairCount + "\\nRedeem A → Recharge B\\nAmount: " +
        (mirror ? "mirrored" : ("fixed " + fixedAmount)) + "\\nPause every " + pace.every + " / " + pace.waitSec + "s\\n\\nStart?"
      );
      if (!ok) return;

      const results = [];
      const timings = [];
      const startedAt = Date.now();
      let redeemedTotal = 0;
      let rechargedTotal = 0;
      job = {
        state: "running",
        kind: "hybrid",
        total: pairCount,
        ok: 0,
        fail: 0,
        skipped: 0,
        dups: 0,
        done: 0
      };
      setJobUi("running");
      sheetBtn.disabled = true;
      log("Hybrid start: " + pairCount + " pairs · " + (mirror ? "mirror" : ("fixed +" + fixedAmount)) +
        " · retries=" + retries + " · pause every " + pace.every + " / " + pace.waitSec + "s");

      try {
        for (let i = 0; i < pairCount; i++) {
          await waitIfPaused();
          const fromUser = listA[i];
          const toUser = listB[i];
          const tickStart = Date.now();
          const row = {
            redeemFrom: fromUser,
            rechargeTo: toUser,
            redeemed: 0,
            recharged: 0,
            redeemSkipped: false,
            redeemStatus: "pending",
            rechargeStatus: "pending",
            at: new Date().toLocaleString()
          };
          log((i + 1) + "/" + pairCount + "  redeem " + fromUser + " → recharge " + toUser);

          try {
            const r = await withMoneyRetries(
              () => redeemOne(fromUser, log),
              "hybrid-redeem " + fromUser,
              log,
              retries
            );
            if (r.skipped || !(Number(r.redeemed) > 0)) {
              row.redeemSkipped = true;
              row.redeemStatus = "skipped";
              row.redeemed = Number(r.redeemed) || 0;
              row.rechargeStatus = "skipped-no-redeem";
              job.skipped += 1;
              log("Skip pair: " + fromUser + " empty redeem — skip recharge " + toUser);
            } else {
              row.redeemed = Number(r.redeemed) || 0;
              row.redeemStatus = "ok";
              redeemedTotal += row.redeemed;
              const pay = mirror ? row.redeemed : fixedAmount;
              try {
                await withMoneyRetries(
                  () => rechargeOne(toUser, pay, log),
                  "hybrid-recharge " + toUser,
                  log,
                  retries
                );
                row.recharged = pay;
                row.rechargeStatus = "ok";
                rechargedTotal += pay;
                job.ok += 1;
                log("✓ " + fromUser + " -" + row.redeemed + " → " + toUser + " +" + pay);
              } catch (reErr) {
                if (reErr && reErr.message === "__STOP__") throw reErr;
                row.rechargeStatus = "failed";
                row.rechargeError = (reErr && reErr.message) || String(reErr);
                job.fail += 1;
                log("Redeem OK, recharge failed " + toUser + ": " + row.rechargeError);
                await escapeUi();
              }
            }
          } catch (err) {
            if (err && err.message === "__STOP__") throw err;
            row.redeemStatus = "failed";
            row.redeemError = (err && err.message) || String(err);
            row.rechargeStatus = "skipped-redeem-failed";
            job.fail += 1;
            log("Redeem failed " + fromUser + ": " + row.redeemError);
            await escapeUi();
          }

          results.push(row);
          timings.push(Date.now() - tickStart);
          job.done = i + 1;
          lastHybrids = results.slice();
          sheetMode = "hybrid";
          sheetBtn.disabled = false;
          renderStats({
            kind: "hybrid",
            total: job.total,
            done: job.done,
            ok: job.ok,
            fail: job.fail,
            skipped: job.skipped,
            dups: 0,
            remaining: job.total - job.done,
            avgMs: timings.reduce((a, b) => a + b, 0) / timings.length,
            state: job.state
          });
          if (results.length % 25 === 0) {
            downloadHybridSheet(results);
            log("Checkpoint CSV · " + results.length + " hybrid pairs");
          }
          await sleep(280);
          await awaitBatchCooldown(job.done, pairCount, log, "hybrid");
        }

        log("Hybrid done. Redeemed " + redeemedTotal + " · recharged " + rechargedTotal +
          " · " + job.ok + " ok / " + job.skipped + " skip / " + job.fail + " fail · " + formatEta(Date.now() - startedAt));
        downloadHybridSheet(results);
        log("Sheet downloaded: vegas-hybrid-*.csv");
        console.table(results);
        job.state = "done";
        setJobUi("done");
      } catch (e) {
        if (e && e.message === "__STOP__") {
          log("Hybrid stopped after " + job.ok + " ok pairs.");
          job.state = "stopped";
        } else {
          log("Hybrid job error: " + ((e && e.message) || e));
          job.state = "stopped";
        }
        if (results.length) {
          lastHybrids = results.slice();
          sheetBtn.disabled = false;
          downloadHybridSheet(results);
        }
        setJobUi(job.state);
      } finally {
        goBtn.disabled = false;
        rechargeBtn.disabled = false;
        if (smartBtn) smartBtn.disabled = false;
        redeemBtn.disabled = false;
        if (hybridBtn) hybridBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    };

  }

  mount();
})();
