/* main.cjs */
const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    safeStorage,
    shell
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');

let Store, isDev;
let mainWindow;

// Keep intervals for monitoring
const monitoringIntervals = new Map();

/** 
 * Session states:
 * {
 *   [exePath]: {
 *      currentlyRunning: boolean,
 *      sessionStart: Date | null
 *   }
 * }
 */
const sessionState = {};

/** 
 * If the user triggers a restart, we set pendingRestarts[exePath] = true
 * Then we skip the session-end event if the game closes while in that state.
 * Once we see the game running again, we clear that flag. 
 */
const pendingRestarts = {};

/** For production, skip sessions < 5 min. For dev, skip 0 min. */
const SKIP_MINUTES = app.isPackaged ? 5 : 0;

async function initializeApp() {
    const importedStore = await import('electron-store');
    Store = importedStore.default;

    const importedIsDev = await import('electron-is-dev');
    isDev = importedIsDev.default;

    if (isDev) {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron')
        });
    }

    const store = new Store();

    // ================
    // TOKEN/USER IPC
    // ================
    ipcMain.handle('store-token', (event, token) => {
        if (!safeStorage.isEncryptionAvailable()) {
            return { success: false, error: 'Encryption not available' };
        }
        const encrypted = safeStorage.encryptString(token);
        store.set('auth_token', encrypted.toString('base64'));
        return { success: true };
    });

    ipcMain.handle('retrieve-token', () => {
        const encB64 = store.get('auth_token');
        if (encB64 && safeStorage.isEncryptionAvailable()) {
            try {
                const enc = Buffer.from(encB64, 'base64');
                const dec = safeStorage.decryptString(enc);
                return { success: true, token: dec };
            } catch (err) {
                return { success: false, error: 'Decrypt token failed.' };
            }
        }
        return { success: false, error: 'No token' };
    });

    ipcMain.handle('clear-token', () => {
        store.delete('auth_token');
        return { success: true };
    });

    ipcMain.handle('store-user', (event, user) => {
        store.set('user', user);
        return { success: true };
    });

    ipcMain.handle('retrieve-user', () => {
        const user = store.get('user');
        return user ? { success: true, user } : { success: false, error: 'Not found' };
    });

    ipcMain.handle('clear-user', () => {
        store.delete('user');
        return { success: true };
    });

    ipcMain.on('download-progress', (event, progress) => {
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', progress);
        }
    });

    ipcMain.handle('install-update', () => {
        app.quit();
        autoUpdater.quitAndInstall(false, true);
    });

    createMainWindow();
    setupAutoUpdater();
}

/** 
 * CREATE MAIN WINDOW
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        icon: path.join(__dirname, '../assets/icon.png'),
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: true,
            devTools: true,
            webSecurity: false
        }
    });

    mainWindow.setMinimumSize(1280, 720);

    if (isDev) {
        mainWindow.loadURL('http://localhost:9000').catch((error) => {
            console.error('Failed to load dev URL:', error);
            dialog.showErrorBox(
                'App Load Error',
                'Check dev server is running.'
            );
        });
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html')).catch((error) => {
            console.error('Failed to load index.html:', error);
            dialog.showErrorBox(
                'App Load Error',
                'Please contact support.'
            );
        });
    }

    ipcMain.handle('show-open-dialog', async (event, opts) => {
        const result = await dialog.showOpenDialog(mainWindow, opts);
        return result.filePaths;
    });

    ipcMain.handle('open-directory', async (event, directoryPath) => {
        try {
            const norm = path.normalize(directoryPath);
            const out = await shell.openPath(norm);
            if (out) {
                console.error('[open-directory] shell.openPath error:', out);
            }
        } catch (err) {
            console.error('[open-directory] error:', err);
        }
    });

    ipcMain.on('get-user-data-path', (event) => {
        event.returnValue = app.getPath('userData');
    });

    ipcMain.on('window-control', (event, action) => {
        const focused = BrowserWindow.getFocusedWindow();
        if (!focused) return;

        switch (action) {
            case 'refresh':
                mainWindow.reload();
                break;
            case 'minimize':
                focused.minimize();
                break;
            case 'maximize':
                if (focused.isMaximized()) {
                    focused.unmaximize();
                } else {
                    focused.maximize();
                }
                break;
            case 'close':
                focused.close();
                break;
            case 'back':
                if (focused.webContents.canGoBack()) {
                    focused.webContents.goBack();
                }
                break;
            case 'forward':
                if (focused.webContents.canGoForward()) {
                    focused.webContents.goForward();
                }
                break;
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (e, navUrl) => {
        if (!navUrl.startsWith('http://localhost:9000') && !navUrl.startsWith('file://')) {
            e.preventDefault();
            shell.openExternal(navUrl);
        }
    });
}

ipcMain.on('process-status-update', (event, status) => {
    if (mainWindow) {
        mainWindow.webContents.send('process-status-update', status);
    }
});

/* =========================================
   LIST PROCESSES using Powershell
*/
function listProcessesWithPaths() {
    if (process.platform !== 'win32') {
        // Non-Windows: just return an empty array or implement another method.
        return Promise.resolve([]);
    }

    // PowerShell command that outputs JSON
    const script = `Get-WmiObject Win32_Process | Select ProcessId, ExecutablePath | ConvertTo-Json`;

    return new Promise((resolve) => {
        const ps = spawn('powershell', ['-command', script], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        ps.stdout.on('data', (chunk) => {
            stdout += chunk;
        });

        ps.stderr.on('data', (chunk) => {
            stderr += chunk;
        });

        ps.on('close', (code) => {
            if (stderr && stderr.trim()) {
                console.error('[listProcessesWithPaths] PowerShell error:', stderr);
            }
            if (!stdout) {
                console.warn('[listProcessesWithPaths] PowerShell returned empty stdout. Possibly no processes or missing PowerShell?');
                return resolve([]);
            }

            let parsed;
            try {
                parsed = JSON.parse(stdout);
            } catch (err) {
                console.error('[listProcessesWithPaths] invalid JSON output from PowerShell:', err);
                return resolve([]);
            }

            // Convert single object to array if needed
            if (!Array.isArray(parsed)) {
                parsed = [parsed];
            }

            const results = [];
            for (const item of parsed) {
                const exePath = item.ExecutablePath;
                const pid = item.ProcessId;
                if (exePath && pid) {
                    results.push({ pid, exePath });
                }
            }
            resolve(results);
        });
    });
}

/* 
   isGameRunning => same fallback approach
*/
async function isGameRunning(exePath) {
    const all = await listProcessesWithPaths();  // <-- now asynchronous
    const serverDir = path.normalize(path.dirname(exePath)).toLowerCase();
    const serverExeName = path.basename(exePath).toLowerCase();
    const baseName = serverExeName.replace(/\.exe$/i, '');

    // exact
    const exact = all.find(proc => {
        const norm = path.normalize(proc.exePath || '').toLowerCase();
        if (!norm.startsWith(serverDir)) return false;
        return (path.basename(norm) === serverExeName);
    });
    if (exact) return true;

    // fallback
    const fallback = all.find(proc => {
        const norm = path.normalize(proc.exePath || '').toLowerCase();
        if (!norm.startsWith(serverDir)) return false;
        return path.basename(norm).startsWith(baseName);
    });
    if (fallback) return true;

    return false;
}

/*
   findMatchingPIDsForExe => KILL fallback logic
   so if user typed "Wow.exe" but real is "Wow-64.exe"
*/
async function findMatchingPIDsForExe(exePath) {
    const all = await listProcessesWithPaths();  // <-- now async
    const serverDir = path.normalize(path.dirname(exePath)).toLowerCase();
    const serverExeName = path.basename(exePath).toLowerCase();
    const baseName = serverExeName.replace(/\.exe$/i, '');

    // 1) exact
    let matched = all.filter(proc => {
        const norm = path.normalize(proc.exePath || '').toLowerCase();
        if (!norm.startsWith(serverDir)) return false;
        return path.basename(norm) === serverExeName;
    });
    if (matched.length > 0) {
        return matched.map(m => m.pid);
    }

    // 2) startsWith fallback
    matched = all.filter(proc => {
        const norm = path.normalize(proc.exePath || '').toLowerCase();
        if (!norm.startsWith(serverDir)) return false;
        return path.basename(norm).startsWith(baseName);
    });
    if (matched.length > 0) {
        return matched.map(m => m.pid);
    }

    // 3) final includes fallback
    matched = all.filter(proc => {
        const norm = path.normalize(proc.exePath || '').toLowerCase();
        if (!norm.startsWith(serverDir)) return false;
        return path.basename(norm).includes(baseName);
    });
    return matched.map(m => m.pid);
}

// Handler for restarting the game exe
ipcMain.handle('restart-exe', async (event, exePath) => {
    try {
        // Mark pending restart
        pendingRestarts[exePath] = true;

        // Find all PIDs to kill in that folder (async)
        const matchedPIDs = await findMatchingPIDsForExe(exePath);
        console.log('[restart-exe] matchedPIDs:', matchedPIDs);

        // If none found, we'll just spawn a new instance
        if (matchedPIDs.length === 0) {
            console.log('[restart-exe] No running process found, just launching new...');
            spawn(exePath, { detached: true, stdio: 'ignore' }).unref();
            return { success: true, message: 'Launched new instance.' };
        }

        // Kill them all
        for (const pid of matchedPIDs) {
            spawnSync('taskkill', ['/PID', String(pid), '/F']);
        }

        // After short delay, spawn the typed exe
        setTimeout(() => {
            console.log(`[restart-exe] Re-launching ${exePath} after kill...`);
            spawn(exePath, { detached: true, stdio: 'ignore' }).unref();
        }, 1000);

        return { success: true, message: `Restarted. Killed ${matchedPIDs.length} processes.` };
    } catch (err) {
        console.error('[restart-exe] Error:', err);
        return { success: false, error: err.message };
    }
});

/* ====================================
   SESSION FILES
*/
function getSessionsFilePath(exePath) {
    const serverDir = path.dirname(exePath);
    const sessionsDir = path.join(serverDir, 'GameSessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    return path.join(sessionsDir, 'sessions.json');
}
function loadSessionsFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error('Error loading sessions file:', err);
        return [];
    }
}
function saveSessionsFile(filePath, sessions) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving sessions file:', err);
    }
}
function saveSessionToFile(exePath, sessionObj) {
    const filePath = getSessionsFilePath(exePath);
    const sessions = loadSessionsFile(filePath);
    sessions.push(sessionObj);
    saveSessionsFile(filePath, sessions);
}

// IPC to load / delete / clear sessions
ipcMain.handle('load-sessions', (event, exePath) => {
    const filePath = getSessionsFilePath(exePath);
    return loadSessionsFile(filePath);
});
ipcMain.handle('delete-session', (event, { exePath, index }) => {
    const filePath = getSessionsFilePath(exePath);
    const sessions = loadSessionsFile(filePath);
    if (index >= 0 && index < sessions.length) {
        sessions.splice(index, 1);
        saveSessionsFile(filePath, sessions);
    }
    return sessions;
});
ipcMain.handle('clear-sessions', (event, exePath) => {
    const filePath = getSessionsFilePath(exePath);
    saveSessionsFile(filePath, []);
    return [];
});
ipcMain.on('update-realmlist', (event, { exePath, realmlist }) => {
    // If we already have a sessionState for this exePath, store it
    // so that when the session ends, we can include that realmlist.
    if (!sessionState[exePath]) {
        sessionState[exePath] = {
            currentlyRunning: false,
            sessionStart: null,
            realmlist: ''
        };
    }
    sessionState[exePath].realmlist = realmlist || '';
});

/* ====================================
   START MONITORING => doCheck => 
   skip session end if pendingRestarts[exePath] is true
*/
ipcMain.on('start-process-monitoring', (event, { exePath, serverId, intervalMs = 5000 }) => {
    if (monitoringIntervals.has(exePath)) {
        clearInterval(monitoringIntervals.get(exePath));
        monitoringIntervals.delete(exePath);
    }

    if (!sessionState[exePath]) {
        sessionState[exePath] = {
            currentlyRunning: false,
            sessionStart: null
        };
    }

    // Make doCheck async so we can await isGameRunning
    const doCheck = async () => {
        const isRunning = await isGameRunning(exePath);
        const st = sessionState[exePath];

        if (!st.currentlyRunning && isRunning) {
            // game just launched (or re-launched)
            st.currentlyRunning = true;

            // If we previously set pendingRestarts[exePath], that means we just re-launched after a restart
            // => continue the session, do not create a new start time
            if (pendingRestarts[exePath] && st.sessionStart) {
                console.log('[SESSION] Resuming session after restart for', exePath);
                // Clear pending restart
                delete pendingRestarts[exePath];
            } else {
                // normal launch
                st.sessionStart = new Date();
                console.log('[SESSION] Game started at', st.sessionStart);
            }
        }
        else if (st.currentlyRunning && !isRunning) {
            // game just closed
            // check if we are skipping because user triggered a restart
            if (pendingRestarts[exePath]) {
                // skip ending session
                st.currentlyRunning = false;
                // do NOT reset sessionStart - so we keep counting
                return;
            }

            // normal closure => end session
            const sessionEnd = new Date();
            const sessionStart = st.sessionStart || new Date();
            st.currentlyRunning = false;
            st.sessionStart = null;

            // compute duration
            const ms = sessionEnd - sessionStart;
            const minutes = ms / 1000 / 60;

            if (minutes >= SKIP_MINUTES) {
                const realmlist = st.realmlist || '';

                const sessionObj = {
                    startTime: sessionStart.toISOString(),
                    endTime: sessionEnd.toISOString(),
                    durationMinutes: Math.round(minutes * 100) / 100,
                    realmlist
                };

                saveSessionToFile(exePath, sessionObj);

                if (mainWindow) {
                    mainWindow.webContents.send('session-ended', {
                        exePath,
                        serverId,
                        session: sessionObj
                    });
                }
            }

            // Restore the backup of Config.wtf after the game closes
            const configPath = path.join(path.dirname(exePath), 'WTF', 'Config.wtf');
            const backupPath = path.join(path.dirname(exePath), 'WTF', 'Config.wtf.backup');

            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, configPath);
                fs.unlinkSync(backupPath); // Delete the backup after restoring
            }
        }

        // normal process-status
        if (mainWindow) {
            mainWindow.webContents.send('process-status-update', {
                exePath,
                serverId,
                running: isRunning
            });
        }
    };

    // Run it once right away
    doCheck();

    // Then run at the given interval
    const handle = setInterval(() => {
        doCheck();
    }, intervalMs);

    monitoringIntervals.set(exePath, handle);
});

ipcMain.on('stop-process-monitoring', (event, { exePath }) => {
    if (monitoringIntervals.has(exePath)) {
        clearInterval(monitoringIntervals.get(exePath));
        monitoringIntervals.delete(exePath);
    }
});

/**
 * SETUP AUTO UPDATER
 */
function setupAutoUpdater() {
    // Set logger
    autoUpdater.logger = require("electron-log");
    autoUpdater.logger.transports.file.level = "info";
    autoUpdater.logger.transports.console.level = "info";

    // Listen for update events
    autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...');
        mainWindow.webContents.send('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info);
        mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('No updates available.');
        mainWindow.webContents.send('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
        console.error('Error in auto-updater:', err);
        mainWindow.webContents.send('update-error', err.message);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
        log_message += ` - Downloaded ${progressObj.percent}%`;
        log_message += ` (${progressObj.transferred}/${progressObj.total})`;
        console.log(log_message);
        mainWindow.webContents.send('update-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info);
        mainWindow.webContents.send('update-downloaded', info);
        // Attempt to automatically install the update
        autoUpdater.quitAndInstall(false, true);
    });

    // Check for updates after window is ready
    autoUpdater.checkForUpdatesAndNotify();
}

/* APP EVENTS */
app.on('ready', initializeApp);

ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion() };
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initializeApp();
    }
});