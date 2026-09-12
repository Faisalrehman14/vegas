(() => {
  if (!/games\.vegasempire\.(co|ca)$/i.test(location.hostname)) {
    alert("Open https://games.vegasempire.co/ first, then paste this.");
    return;
  }

  const CFG = window.__VE_GAME_LOGIN__ || { username: "", password: "" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Screen / canvas vision flow (no Unity SendMessage login):
  // 1) Find canvas
  // 2) Click username field → type username
  // 3) Click password field → type password
  // 4) Find gold LOGIN button (pixel scan) → click

  function canvasEl() {
    return document.querySelector("#unity-canvas") || document.querySelector("canvas");
  }

  function contentRect(c) {
    // Match CSS box (object-fit can letterbox; use layout rect for clicks)
    return c.getBoundingClientRect();
  }

  function clientXY(c, nx, ny) {
    const r = contentRect(c);
    return { x: r.left + r.width * nx, y: r.top + r.height * ny, r };
  }

  function dispatchPointer(c, x, y, types) {
    c.focus();
    for (const type of types) {
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        button: 0,
        buttons: type === "pointerup" || type === "mouseup" ? 0 : 1,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      };
      try {
        if (type.startsWith("pointer")) c.dispatchEvent(new PointerEvent(type, opts));
        else c.dispatchEvent(new MouseEvent(type, opts));
      } catch (_e) {
        c.dispatchEvent(new MouseEvent(type.replace("pointer", "mouse"), opts));
      }
    }
  }

  async function clickNorm(c, nx, ny, log, label) {
    const { x, y } = clientXY(c, nx, ny);
    dispatchPointer(c, x, y, [
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click"
    ]);
    log((label || "click") + " @" + nx.toFixed(2) + "," + ny.toFixed(2));
    await sleep(180);
  }

  function keyEvent(c, type, key, code, keyCode) {
    const opts = {
      key,
      code,
      keyCode,
      which: keyCode,
      charCode: type === "keypress" ? keyCode : 0,
      bubbles: true,
      cancelable: true,
      view: window
    };
    c.dispatchEvent(new KeyboardEvent(type, opts));
  }

  async function typeText(c, text, log) {
    c.focus();
    // Clear field (Ctrl+A, Backspace)
    for (const type of ["keydown", "keyup"]) {
      c.dispatchEvent(
        new KeyboardEvent(type, {
          key: "a",
          code: "KeyA",
          keyCode: 65,
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        })
      );
    }
    await sleep(80);
    keyEvent(c, "keydown", "Backspace", "Backspace", 8);
    keyEvent(c, "keyup", "Backspace", "Backspace", 8);
    await sleep(80);

    for (const ch of String(text)) {
      const isLetter = /^[a-zA-Z]$/.test(ch);
      const isDigit = /^[0-9]$/.test(ch);
      let code = "Unidentified";
      let keyCode = ch.charCodeAt(0);
      if (isLetter) {
        code = "Key" + ch.toUpperCase();
        keyCode = ch.toUpperCase().charCodeAt(0);
      } else if (isDigit) {
        code = "Digit" + ch;
        keyCode = ch.charCodeAt(0);
      } else if (ch === "@") {
        code = "Digit2";
        keyCode = 50;
      } else if (ch === ".") {
        code = "Period";
        keyCode = 190;
      } else if (ch === "_") {
        code = "Minus";
        keyCode = 189;
      }

      keyEvent(c, "keydown", ch, code, keyCode);
      keyEvent(c, "keypress", ch, code, keyCode);
      try {
        c.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: ch
          })
        );
        c.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: ch
          })
        );
      } catch (_e) {}
      try {
        document.execCommand("insertText", false, ch);
      } catch (_e2) {}
      keyEvent(c, "keyup", ch, code, keyCode);
      await sleep(45 + Math.floor(Math.random() * 30));
    }
    log("Typed " + text.length + " chars");
  }

  /** Scan canvas pixels for bright gold LOGIN button center (right-side form). */
  function findLoginButton(c, log) {
    try {
      const w = c.width;
      const h = c.height;
      if (!w || !h) return null;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        log("No 2d context — using default LOGIN coords");
        return null;
      }
      // Reading WebGL canvas often needs preserveDrawingBuffer; try anyway.
      let img;
      try {
        img = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        log("Canvas read blocked (" + (e && e.message ? e.message : e) + ") — default coords");
        return null;
      }
      const data = img.data;
      // Search lower-middle of right panel for gold pixels
      const x0 = Math.floor(w * 0.62);
      const x1 = Math.floor(w * 0.92);
      const y0 = Math.floor(h * 0.48);
      const y1 = Math.floor(h * 0.78);
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Gold / amber LOGIN button
          if (r > 180 && g > 120 && b < 100 && r > g && g > b) {
            sumX += x;
            sumY += y;
            count += 1;
          }
        }
      }
      if (count < 40) {
        log("Gold LOGIN pixels not found (" + count + ") — default coords");
        return null;
      }
      const nx = sumX / count / w;
      const ny = sumY / count / h;
      log("LOGIN button found @" + nx.toFixed(3) + "," + ny.toFixed(3) + " (n=" + count + ")");
      return { nx, ny };
    } catch (e) {
      log("findLogin fail: " + (e && e.message ? e.message : e));
      return null;
    }
  }

  /** Default layout for VegasEmpire USER LOGIN panel (right side). */
  const LAYOUT = {
    username: [
      [0.78, 0.42],
      [0.76, 0.44],
      [0.8, 0.43]
    ],
    password: [
      [0.78, 0.5],
      [0.76, 0.52],
      [0.8, 0.51]
    ],
    login: [
      [0.78, 0.6],
      [0.76, 0.62],
      [0.8, 0.58],
      [0.78, 0.64]
    ]
  };

  async function runScreenLogin(username, password, log, statusEl) {
    const c = canvasEl();
    if (!c) throw new Error("canvas not found");
    c.tabIndex = 0;
    c.focus();

    statusEl.textContent = "1/4 Click username field...";
    for (const [nx, ny] of LAYOUT.username) {
      await clickNorm(c, nx, ny, log, "username");
    }
    await sleep(250);
    statusEl.textContent = "2/4 Typing username...";
    await typeText(c, username, log);
    await sleep(300);

    statusEl.textContent = "3/4 Click password field...";
    for (const [nx, ny] of LAYOUT.password) {
      await clickNorm(c, nx, ny, log, "password");
    }
    await sleep(250);
    statusEl.textContent = "Typing password...";
    await typeText(c, password, log);
    await sleep(350);

    statusEl.textContent = "4/4 Find + click LOGIN...";
    const found = findLoginButton(c, log);
    const loginPts = found ? [[found.nx, found.ny], ...LAYOUT.login] : LAYOUT.login;
    for (const [nx, ny] of loginPts) {
      await clickNorm(c, nx, ny, log, "LOGIN");
      await sleep(220);
    }

    statusEl.textContent = "Done — check lobby / Network functions/login.";
    log("Screen login sequence finished.");
  }

  function mount() {
    const old = document.getElementById("ve-game-login");
    if (old) old.remove();
    const root = document.createElement("div");
    root.id = "ve-game-login";
    root.innerHTML =
      "<style>" +
      "#ve-game-login{position:fixed;left:12px;bottom:12px;z-index:2147483646;width:min(360px,calc(100vw - 24px));font-family:Inter,system-ui,sans-serif}" +
      "#ve-game-card{background:#14141c;color:#f4f1ea;border:1px solid rgba(245,197,24,.35);border-radius:14px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.55)}" +
      "#ve-game-card h3{margin:0 0 4px;color:#f5c518;font-size:15px}" +
      "#ve-game-card p{margin:0 0 8px;color:#9a9488;font-size:11px;line-height:1.4}" +
      "#ve-game-card label{display:block;font-size:10px;color:#9a9488;margin:6px 0 3px}" +
      "#ve-game-card input{width:100%;box-sizing:border-box;background:#0e0e14;color:#f4f1ea;border:1px solid rgba(245,197,24,.22);border-radius:8px;padding:8px}" +
      "#ve-game-log{margin-top:8px;height:130px;overflow:auto;background:#0e0e14;border-radius:8px;padding:7px;font:11px ui-monospace,monospace;white-space:pre-wrap}" +
      "#ve-game-status{margin-top:6px;font-size:11px;color:#f5c518;min-height:16px}" +
      "#ve-game-go,#ve-game-x{width:100%;margin-top:7px;border:0;border-radius:9px;padding:9px;font-weight:700;cursor:pointer}" +
      "#ve-game-go{background:#f5c518;color:#111}" +
      "#ve-game-go:disabled{opacity:.55;cursor:wait}" +
      "#ve-game-x{background:transparent;color:#f5c518;border:1px solid rgba(245,197,24,.28)}" +
      "</style>" +
      '<div id="ve-game-card">' +
      "<h3>Screen Login</h3>" +
      "<p>Screen dekho → username click+type → password click+type → gold LOGIN find+click. (Unity SendMessage nahi)</p>" +
      "<label>Username</label>" +
      '<input id="ve-game-user" type="text" value="' +
      String(CFG.username || "").replace(/"/g, "&quot;") +
      '" />' +
      "<label>Password</label>" +
      '<input id="ve-game-pass" type="password" value="' +
      String(CFG.password || "").replace(/"/g, "&quot;") +
      '" />' +
      '<div id="ve-game-status">Ready.</div>' +
      '<div id="ve-game-log">Ready.</div>' +
      '<button id="ve-game-go" type="button">Click fields + type + LOGIN</button>' +
      '<button id="ve-game-x" type="button">Close</button>' +
      "</div>";
    document.body.appendChild(root);

    const logEl = document.getElementById("ve-game-log");
    const statusEl = document.getElementById("ve-game-status");
    const log = (m) => {
      logEl.textContent += "\n" + m;
      logEl.scrollTop = logEl.scrollHeight;
    };

    document.getElementById("ve-game-x").onclick = () => root.remove();
    document.getElementById("ve-game-go").onclick = async () => {
      const btn = document.getElementById("ve-game-go");
      const username = document.getElementById("ve-game-user").value.trim();
      const password = document.getElementById("ve-game-pass").value;
      if (!username || !password) {
        log("Username + password required.");
        return;
      }
      btn.disabled = true;
      try {
        await runScreenLogin(username, password, log, statusEl);
      } catch (e) {
        log("Failed: " + (e && e.message ? e.message : e));
        statusEl.textContent = "Failed.";
      }
      btn.disabled = false;
    };
  }

  mount();
})();
