const { app, BrowserWindow, session, shell, Menu, screen, nativeImage } = require('electron');
const path = require('path');

const APP_NAME = 'Xorcist';
const ICON_PNG = path.join(__dirname, 'build-assets', 'icon-512.png');
const ICON_ICNS = path.join(__dirname, 'build-assets', 'icon.icns');

app.setName(APP_NAME);

const X_URL = 'https://x.com/home';
// Electron is genuinely Chromium; strip the "Electron/x.x.x" token so
// X's UA sniffing recognizes it as a real Chrome build.
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// The session/webContents-level UA overrides below aren't reliably applied
// to a brand-new popup window's very first navigation — verified live: the
// Apple/Google sign-in popup's first request went out with the real
// Electron default UA baked in, only correcting itself on the SECOND
// request. app.userAgentFallback changes Electron's own baseline default
// before any renderer process ever spawns, which fixes this at the root
// instead of racing to override it after the fact.
app.userAgentFallback = CHROME_UA;
const ALLOWED_HOSTS = [
  'x.com',
  'twitter.com',
  'twimg.com',
  'accounts.google.com',
  'appleid.apple.com',
];

// Proactively resolves Notification.permission instead of waiting on X's
// own banner click, then reloads once on the first real grant so X's init
// code (which likely only subscribes to push inside its own "Enable"
// button's click handler) re-runs seeing "granted" from page load and
// actually completes the push subscription.
const NOTIF_PROBE_JS = `
(() => {
  if (!window.Notification) return;
  if (Notification.permission === 'granted') return;
  Notification.requestPermission().then((result) => {
    if (result === 'granted' && !window.__xNotifReloaded) {
      window.__xNotifReloaded = true;
      setTimeout(() => location.reload(), 50);
    }
  }).catch(() => {});
})();
`;

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
}

function buildWindowBounds() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1200, width - 100);
  const h = Math.min(800, height - 100);
  return {
    width: w,
    height: h,
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
  };
}

function attachNavigationGuards(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname;
      if (isAllowedHost(hostname)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 480,
            height: 680,
            webPreferences: { session: win.webContents.session },
          },
        };
      }
    } catch (_) {}
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const hostname = new URL(url).hostname;
      if (!isAllowedHost(hostname)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) {}
  });
}

function createApp() {
  const bounds = buildWindowBounds();
  const xSession = session.fromPartition('persist:x-desktop');

  xSession.setUserAgent(CHROME_UA);

  const allowedPermissions = ['media', 'mediaKeySystem', 'notifications', 'clipboard-read', 'fullscreen'];
  const isAllowedPermissionOrigin = (originOrUrl) => {
    try {
      return isAllowedHost(new URL(originOrUrl).hostname);
    } catch (_) {
      return false;
    }
  };
  xSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (details && details.requestingUrl) || webContents.getURL();
    callback(allowedPermissions.includes(permission) && isAllowedPermissionOrigin(origin));
  });
  // Request handler alone only covers active Notification.requestPermission()
  // calls; the check handler covers passive `Notification.permission` reads,
  // which is what X's own "enable notifications" UI gates on — without this,
  // that UI never goes away no matter what we grant above.
  xSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return allowedPermissions.includes(permission) && isAllowedPermissionOrigin(requestingOrigin);
  });

  const splash = new BrowserWindow({
    ...bounds,
    show: true,
    resizable: false,
    backgroundColor: '#000000',
    webPreferences: { session: xSession },
  });
  splash.loadFile('splash.html');

  // A real (non-overlay) title bar, deliberately not hiddenInset: X's own
  // page controls its top-left/top-right UI and we can't guarantee it never
  // puts something under custom-positioned traffic lights. A genuine title
  // bar reserves OS chrome space that page content physically cannot render
  // into.
  const main = new BrowserWindow({
    ...bounds,
    show: false,
    minWidth: 480,
    minHeight: 480,
    title: APP_NAME,
    icon: ICON_PNG,
    backgroundColor: '#000000',
    webPreferences: {
      session: xSession,
      contextIsolation: true,
      sandbox: true,
    },
  });

  attachNavigationGuards(main);

  // Chromium syncs the window title to the page's own <title> (e.g. "(3)
  // Home / X") after every load, overwriting our initial title. Keep the
  // useful unread-count prefix but swap the branding text to stay consistent
  // with the dock icon/app name.
  main.webContents.on('page-title-updated', (event, title) => {
    event.preventDefault();
    const stripped = title.replace(/\s*\/\s*Twitter\s*$/i, '').replace(/\s*\/\s*X\s*$/i, '');
    main.setTitle(stripped && stripped !== title ? `${stripped} · ${APP_NAME}` : APP_NAME);
  });

  const swapIn = () => {
    if (main.isVisible()) return;
    main.show();
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close();
    }, 120);
  };

  main.webContents.once('did-finish-load', () => {
    setTimeout(swapIn, 350); // let the splash breathe briefly so it doesn't just flash
  });
  main.webContents.once('did-fail-load', swapIn);

  main.webContents.on('did-finish-load', () => {
    main.webContents.executeJavaScript(NOTIF_PROBE_JS).catch(() => {});
  });

  // Keep push/service-worker timers responsive while backgrounded (menu bar
  // only) so incoming notifications aren't delayed.
  main.webContents.setBackgroundThrottling(false);

  main.webContents.setUserAgent(CHROME_UA);
  main.loadURL(X_URL);

  return main;
}

function buildMenu(getMainWindow) {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => getMainWindow()?.webContents.reload(),
        },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(ICON_PNG));
  }

  let mainWindow = createApp();
  buildMenu(() => mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createApp();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
