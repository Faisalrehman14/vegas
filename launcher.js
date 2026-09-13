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
      maxRetries: 5
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
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    el.focus();
    proto.set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
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

  function dismissOpenDialogs() {
    const cancel = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^cancel$/i.test((b.textContent || "").trim());
    });
    if (cancel) cancel.click();
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

  function findRowForUsername(username) {
    const rows = [...document.querySelectorAll("tr, [role='row']")];
    return rows.find((row) => {
      if (row.closest("#ve-bulk-root")) return false;
      const t = (row.innerText || "").toLowerCase();
      return t.includes(String(username).toLowerCase()) && /player/i.test(t);
    }) || rows.find((row) => {
      if (row.closest("#ve-bulk-root")) return false;
      return (row.innerText || "").toLowerCase().includes(String(username).toLowerCase());
    });
  }

  async function searchUser(username, log) {
    log("searching " + username + " ...");
    const clearBtn = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^clear$/i.test((b.textContent || "").trim());
    });
    if (clearBtn) {
      clearBtn.click();
      await sleep(500);
    }
    const searchBox =
      [...document.querySelectorAll("input")].find((el) => {
        if (el.closest("#ve-bulk-root")) return false;
        return /enter value/i.test(el.placeholder || "");
      }) || document.querySelector("input[placeholder='Enter value']");
    if (!searchBox) throw new Error("Search box not found");
    setInput(searchBox, username);
    await sleep(150);
    const searchBtn = [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^search$/i.test((b.textContent || "").trim());
    });
    if (!searchBtn) throw new Error("Search button not found");
    searchBtn.click();
    await sleep(400);
    await waitFor(() => findRowForUsername(username), 15000, "user row for " + username);
    await sleep(400);
  }

  function findActionsMenuItem(label) {
    const re = new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
    const openMenus = [...document.querySelectorAll(".MuiPopover-root .MuiMenu-list, .MuiMenu-paper [role='menu'], [role='presentation'] [role='menu']")].filter((menu) => {
      if (menu.closest("#ve-bulk-root, nav, .MuiDrawer-root")) return false;
      const style = window.getComputedStyle(menu);
      return style.display !== "none" && style.visibility !== "hidden" && menu.getClientRects().length > 0;
    });
    const items = (openMenus.length ? openMenus : [])
      .flatMap((menu) => [...menu.querySelectorAll('[role="menuitem"]')])
      .filter((el) => !el.closest("nav, .MuiDrawer-root, #ve-bulk-root"));
    return items.find((el) => {
      const firstLine = (el.textContent || "").trim().split("\n")[0].trim();
      return re.test(firstLine);
    });
  }

  function readBalanceFromRow(row) {
    if (!row) return 0;
    const text = (row.innerText || "").replace(/\s+/g, " ").trim();
    const m = text.match(/Player\s+(\d+(?:\.\d+)?)/i) || text.match(/\b(\d+(?:\.\d+)?)\s+\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (m) return Number(m[1]) || 0;
    const nums = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((x) => Number(x[1]));
    const candidates = nums.filter((n) => n >= 0 && n < 1000000);
    if (!candidates.length) return 0;
    return candidates.length >= 2 ? candidates[candidates.length - 2] : candidates[0];
  }

  async function openRowAction(username, actionLabel, log) {
    await searchUser(username, log);
    const row = findRowForUsername(username);
    if (!row) throw new Error("Row not found for " + username);
    const balance = readBalanceFromRow(row);
    const actionsBtn =
      [...row.querySelectorAll("button")].find((b) => /^actions$/i.test((b.textContent || "").trim())) ||
      row.querySelector("#user-actions-button");
    if (!actionsBtn) throw new Error("Actions button not found in row for " + username);
    log("opening " + actionLabel + " for " + username + " (balance " + balance + ") ...");
    actionsBtn.click();
    await sleep(450);
    const item = await waitFor(() => findActionsMenuItem(actionLabel), 10000, "Actions → " + actionLabel);
    item.click();
    await sleep(500);
    return { row, balance };
  }

  async function rechargeOne(username, amount, log) {
    await openRowAction(username, "Recharge", log);
    const amountEl = await waitFor(() => {
      const headingOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
        /recharge user/i.test(h.textContent || "")
      );
      if (!headingOpen) return null;
      return (
        document.querySelector("input#amount") ||
        document.querySelector('input[name="amount"]') ||
        [...document.querySelectorAll(".MuiDialog-root input, .MuiModal-root input")].find((el) =>
          /amount/i.test(el.id + el.name + (el.getAttribute("aria-label") || ""))
        )
      );
    }, 15000, "Recharge User dialog");
    setInput(amountEl, String(amount));
    await sleep(250);
    const confirm = [...document.querySelectorAll(".MuiDialog-root button, .MuiModal-root button")].find((b) =>
      /^confirm$/i.test((b.textContent || "").trim())
    ) || [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^confirm$/i.test((b.textContent || "").trim());
    });
    if (!confirm) throw new Error("Recharge Confirm missing");
    confirm.click();
    await sleep(500);
    await waitFor(() => {
      const bodyText = visibleText(pageRoot());
      const dialogOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
        /recharge user/i.test(h.textContent || "")
      );
      if (/recharged successfully/i.test(bodyText)) return true;
      if (!dialogOpen) return true;
      if (/cannot exceed|amount must|error/i.test(bodyText) && dialogOpen) return "err";
      return false;
    }, 20000, "recharge to finish");
    const bodyText = visibleText(pageRoot());
    const dialogOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
      /recharge user/i.test(h.textContent || "")
    );
    if (dialogOpen && /cannot exceed|amount must|error/i.test(bodyText)) {
      dismissOpenDialogs();
      throw new Error("Recharge failed for " + username + " (check admin balance)");
    }
    log("✓ " + username + " recharged +" + amount);
    await sleep(600);
  }

  async function redeemOne(username, log) {
    await searchUser(username, log);
    const row = findRowForUsername(username);
    if (!row) throw new Error("Row not found for " + username);
    let balance = readBalanceFromRow(row);
    if (!balance || balance <= 0) {
      log(username + " skipped (balance 0)");
      return { username, redeemed: 0, skipped: true };
    }
    const actionsBtn =
      [...row.querySelectorAll("button")].find((b) => /^actions$/i.test((b.textContent || "").trim())) ||
      row.querySelector("#user-actions-button");
    if (!actionsBtn) throw new Error("Actions button not found in row for " + username);
    log("opening Redeem for " + username + " (balance " + balance + ") ...");
    actionsBtn.click();
    await sleep(450);
    const item = await waitFor(() => findActionsMenuItem("Redeem"), 10000, "Actions → Redeem");
    item.click();
    await sleep(500);

    const amountEl = await waitFor(() => {
      const headingOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
        /redeem user/i.test(h.textContent || "")
      );
      if (!headingOpen) return null;
      return (
        document.querySelector(".MuiDialog-root input#amount, .MuiModal-root input#amount") ||
        document.querySelector(".MuiDialog-root input[name='amount'], .MuiModal-root input[name='amount']") ||
        document.querySelector("input#amount") ||
        document.querySelector('input[name="amount"]')
      );
    }, 15000, "Redeem User dialog");

    let redeemAmount = balance;
    const dialogText = [...document.querySelectorAll(".MuiDialog-root, .MuiModal-root")]
      .map((el) => el.innerText || "")
      .join("\n");
    const maxMatch = dialogText.match(/Maximum Amount Redeem:\s*(\d+(?:\.\d+)?)/i);
    if (maxMatch) redeemAmount = Number(maxMatch[1]) || balance;
    if (redeemAmount <= 0) {
      dismissOpenDialogs();
      log(username + " skipped (max redeem 0)");
      return { username, redeemed: 0, skipped: true };
    }

    setInput(amountEl, String(redeemAmount));
    await sleep(250);
    const confirm = [...document.querySelectorAll(".MuiDialog-root button, .MuiModal-root button")].find((b) =>
      /^confirm$/i.test((b.textContent || "").trim())
    ) || [...document.querySelectorAll("button")].find((b) => {
      if (b.closest("#ve-bulk-root")) return false;
      return /^confirm$/i.test((b.textContent || "").trim());
    });
    if (!confirm) throw new Error("Redeem Confirm missing");
    confirm.click();
    await sleep(500);
    await waitFor(() => {
      const bodyText = visibleText(pageRoot());
      const dialogOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
        /redeem user/i.test(h.textContent || "")
      );
      if (/redeemed successfully/i.test(bodyText)) return true;
      if (!dialogOpen) return true;
      if (/cannot exceed|amount must|must be in lobby|error|playing/i.test(bodyText) && dialogOpen) return "err";
      return false;
    }, 20000, "redeem to finish");
    const bodyText = visibleText(pageRoot());
    const dialogOpen = [...document.querySelectorAll("h1,h2,[role='heading'],.MuiDialogTitle-root")].some((h) =>
      /redeem user/i.test(h.textContent || "")
    );
    if (dialogOpen && /cannot exceed|amount must|must be in lobby|error|playing/i.test(bodyText)) {
      dismissOpenDialogs();
      throw new Error("Redeem failed for " + username);
    }
    log(username + " redeemed -" + redeemAmount);
    await sleep(700);
    return { username, redeemed: redeemAmount, skipped: false };
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
        #ve-bulk-tabs { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:8px; }
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
        #ve-bulk-go, #ve-bulk-recharge, #ve-bulk-redeem, #ve-bulk-sheet, #ve-bulk-x, #ve-bulk-pause, #ve-bulk-stop { width:100%; border:0; border-radius:9px; padding:9px; font-weight:700; cursor:pointer; margin-top:7px; }
        #ve-bulk-go, #ve-bulk-recharge, #ve-bulk-redeem { background:#f5c518; color:#111; }
        #ve-bulk-go:disabled, #ve-bulk-recharge:disabled, #ve-bulk-redeem:disabled, #ve-bulk-pause:disabled, #ve-bulk-stop:disabled { opacity:.55; cursor:wait; }
        #ve-bulk-pause { background:#1c1c28; color:#f5c518; border:1px solid rgba(245,197,24,.28); margin-top:0; }
        #ve-bulk-stop { background:#2a1515; color:#ff8e8e; border:1px solid rgba(255,100,100,.28); margin-top:0; }
        #ve-bulk-sheet { background:#1c1c28; color:#f5c518; border:1px solid rgba(245,197,24,.28); }
        #ve-bulk-sheet:disabled { opacity:.4; cursor:not-allowed; }
        #ve-bulk-x { background:transparent; color:#f5c518; border:1px solid rgba(245,197,24,.28); }
        .ve-pane { display:none; }
        .ve-pane.active { display:block; }
      </style>
      <div id="ve-bulk-card">
        <h3>Vegas Admin Helper</h3>
        <p>Production-grade create engine · pause / stop · unique usernames · checkpoint CSV.</p>
        <div id="ve-bulk-tabs">
          <button type="button" id="ve-tab-create" class="active">Create</button>
          <button type="button" id="ve-tab-recharge">Recharge list</button>
          <button type="button" id="ve-tab-redeem">Redeem list</button>
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
          <div id="ve-job-row">
            <button id="ve-bulk-pause" disabled>Pause</button>
            <button id="ve-bulk-stop" disabled>Stop</button>
          </div>
          <div id="ve-progress-wrap">
            <div id="ve-progress-bar"><div id="ve-progress-fill"></div></div>
            <div id="ve-stats">Idle</div>
          </div>
        </div>
        <div id="ve-pane-recharge" class="ve-pane">
          <label>Recharge list (username, amount or username amount)</label>
          <textarea id="ve-bulk-recharge-users" placeholder="asher205, 250&#10;madison919 150&#10;lucas275: 75"></textarea>
          <div id="ve-bulk-row" style="margin-top:8px">
            <div>
              <label>Default amount</label>
              <input id="ve-bulk-recharge-amount" type="number" min="1" step="0.01" value="5" />
            </div>
            <div></div>
          </div>
          <button id="ve-bulk-recharge">Recharge list</button>
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
            <div></div>
          </div>
          <button id="ve-bulk-redeem">Redeem full balance</button>
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
      document.getElementById("ve-pane-create").classList.toggle("active", tab === "create");
      document.getElementById("ve-pane-recharge").classList.toggle("active", tab === "recharge");
      document.getElementById("ve-pane-redeem").classList.toggle("active", tab === "redeem");
      sheetMode = tab;
      if (tab === "create") sheetBtn.disabled = !lastCreated.length;
      else if (tab === "recharge") sheetBtn.disabled = !lastRecharges.length;
      else sheetBtn.disabled = !lastRedeems.length;
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

    function setJobUi(state) {
      const running = state === "running" || state === "paused";
      goBtn.disabled = running;
      pauseBtn.disabled = !running;
      stopBtn.disabled = !running;
      pauseBtn.textContent = state === "paused" ? "Resume" : "Pause";
      progressWrap.classList.toggle("on", running || state === "done");
    }

    function renderStats(stats) {
      const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
      progressFill.style.width = pct + "%";
      const eta = stats.avgMs && stats.remaining
        ? formatEta(stats.avgMs * stats.remaining)
        : "--:--";
      statsEl.textContent =
        pct + "% · " + stats.ok + " ok · " + stats.fail + " fail · " + stats.dups + " dup-retry · ETA " + eta +
        (stats.state === "paused" ? " · PAUSED" : "") +
        (stats.state === "stopped" ? " · STOPPED" : "");
    }

    async function waitIfPaused() {
      while (job && job.state === "paused") {
        await sleep(200);
      }
      if (!job || job.state === "stopped") throw new Error("__STOP__");
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
                await rechargeOne(account.username, CFG.balance, log);
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
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = "Pause";
      }
    }

    document.getElementById("ve-tab-create").onclick = () => setTab("create");
    document.getElementById("ve-tab-recharge").onclick = () => setTab("recharge");
    document.getElementById("ve-tab-redeem").onclick = () => setTab("redeem");
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
          total: job.total,
          done: job.done,
          ok: job.ok,
          fail: job.fail,
          dups: job.dups,
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

    document.getElementById("ve-bulk-recharge").onclick = async () => {
      const btn = document.getElementById("ve-bulk-recharge");
      const defaultAmount = Math.max(0, Number(document.getElementById("ve-bulk-recharge-amount").value) || 0);
      const entries = parseRechargeEntries(document.getElementById("ve-bulk-recharge-users").value, defaultAmount);
      if (!entries.length) {
        log("Paste usernames with amounts first, or use the default amount field.");
        return;
      }
      btn.disabled = true;
      sheetBtn.disabled = true;
      const results = [];
      try {
        for (let i = 0; i < entries.length; i++) {
          const { username, amount } = entries[i];
          log((i + 1) + "/" + entries.length + "  " + username + " → " + amount);
          try {
            await rechargeOne(username, amount, log);
            results.push({
              username,
              amount,
              status: "ok",
              at: new Date().toLocaleString()
            });
          } catch (err) {
            results.push({
              username,
              amount,
              status: "failed",
              error: (err && err.message) || String(err),
              at: new Date().toLocaleString()
            });
            log("Failed " + username + ": " + ((err && err.message) || err));
          }
          lastRecharges = results.slice();
          sheetMode = "recharge";
          sheetBtn.disabled = false;
        }
        const total = results.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        log("Done. Recharged total " + total + " across " + results.length + " users.");
        downloadRechargeSheet(results);
        log("Sheet downloaded: vegas-recharges-*.csv");
        console.table(results);
      } catch (e) {
        log("Stopped: " + (e && e.message ? e.message : e));
        if (results.length) {
          lastRecharges = results.slice();
          sheetBtn.disabled = false;
          downloadRechargeSheet(results);
        }
      } finally {
        btn.disabled = false;
      }
    };

    document.getElementById("ve-bulk-redeem").onclick = async () => {
      const btn = document.getElementById("ve-bulk-redeem");
      const users = parseUsernameList(document.getElementById("ve-bulk-users").value);
      const autoRechargeEnabled = document.getElementById("ve-bulk-auto-recharge").checked;
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

      btn.disabled = true;
      sheetBtn.disabled = true;
      const results = [];
      try {
        for (let i = 0; i < users.length; i++) {
          const username = users[i];
          log((i + 1) + "/" + users.length + "  " + username);
          try {
            const r = await redeemOne(username, log);
            r.at = new Date().toLocaleString();

            if (autoRechargeEnabled && !r.skipped && Number(r.redeemed) > 0) {
              try {
                await rechargeOne(username, autoRechargeAmount, log);
                r.recharged = autoRechargeAmount;
                r.rechargeStatus = "ok";
                log(username + " auto-recharged +" + autoRechargeAmount);
              } catch (rechargeErr) {
                r.recharged = 0;
                r.rechargeStatus = "failed";
                r.rechargeError = (rechargeErr && rechargeErr.message) || String(rechargeErr);
                log("Auto recharge failed for " + username + ": " + r.rechargeError);
              }
            } else {
              r.recharged = 0;
              r.rechargeStatus = "not-needed";
            }

            results.push(r);
          } catch (err) {
            results.push({
              username,
              redeemed: 0,
              recharged: 0,
              rechargeStatus: "not-needed",
              skipped: false,
              error: (err && err.message) || String(err),
              at: new Date().toLocaleString()
            });
            log("Failed " + username + ": " + ((err && err.message) || err));
          }
          lastRedeems = results.slice();
          sheetMode = "redeem";
          sheetBtn.disabled = false;
        }
        const total = results.reduce((s, r) => s + (Number(r.redeemed) || 0), 0);
        const rechargedTotal = results.reduce((s, r) => s + (Number(r.recharged) || 0), 0);
        log("Done. Redeemed total " + total + " from " + results.length + " users. Auto recharged " + rechargedTotal + ".");
        downloadRedeemSheet(results);
        log("Sheet downloaded: vegas-redeems-*.csv");
        console.table(results);
      } catch (e) {
        log("Stopped: " + (e && e.message ? e.message : e));
        if (results.length) {
          lastRedeems = results.slice();
          sheetBtn.disabled = false;
          downloadRedeemSheet(results);
        }
      } finally {
        btn.disabled = false;
      }
    };
  }

  mount();
})();
