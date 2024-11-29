const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { execFile } = require('child_process');

let Store, isDev;
let mainWindow;

async function initializeApp() {
    // Dynamically import `electron-store` and `electron-is-dev`
    const importedStore = await import('electron-store');
    Store = importedStore.default;

    const importedIsDev = await import('electron-is-dev');
    isDev = importedIsDev.default;

    if (isDev) {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
        });
    }

    // Initialize electron-store
    const store = new Store();

    // Define all ipcMain handlers
    ipcMain.handle('store-token', async (event, token) => {
        if (safeStorage.isEncryptionAvailable()) {
            const encryptedToken = safeStorage.encryptString(token);
            store.set('auth_token', encryptedToken.toString('base64'));
            return { success: true };
        } else {
            console.error('Encryption not available');
            return { success: false, error: 'Encryption not available' };
        }
    });

    ipcMain.handle('retrieve-token', () => {
        const encryptedTokenBase64 = store.get('auth_token');
        if (encryptedTokenBase64 && safeStorage.isEncryptionAvailable()) {
            try {
                const encryptedToken = Buffer.from(encryptedTokenBase64, 'base64');
                const decryptedToken = safeStorage.decryptString(encryptedToken);
                return { success: true, token: decryptedToken };
            } catch (error) {
                console.error('Failed to decrypt token:', error);
                return { success: false, error: 'Failed to decrypt token' };
            }
        } else {
            return { success: false, error: 'Token not found or encryption unavailable' };
        }
    });

    ipcMain.handle('clear-token', () => {
        store.delete('auth_token');
        return { success: true };
    });

    ipcMain.handle('store-user', async (event, user) => {
        store.set('user', user);
        return { success: true };
    });

    ipcMain.handle('retrieve-user', () => {
        const user = store.get('user');
        if (user) {
            return { success: true, user };
        } else {
            return { success: false, error: 'User not found' };
        }
    });

    ipcMain.handle('clear-user', () => {
        store.delete('user');
        return { success: true };
    });

    ipcMain.on('download-progress', (event, progress) => {
        mainWindow.webContents.send('download-progress', progress);
      });

    ipcMain.handle("install-update", () => {
        app.quit(); // Quit the app
        autoUpdater.quitAndInstall(false, true);
    });

    // Create the main app window
    const createWindow = () => {
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
                devTools: isDev
            },
        });

        mainWindow.setMinimumSize(1280, 720);

        if (isDev) {
            // In development mode, load from the localhost server
            mainWindow.loadURL('http://localhost:9000').catch((error) => {
                console.error('Failed to load development URL:', error);
                dialog.showErrorBox(
                    'Application Load Error',
                    'Unable to load the development server. Please make sure it is running.'
                );
            });
        } else {
            // In production, load the packaged index.html file
            mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html')).catch((error) => {
                console.error('Failed to load index.html:', error);
                dialog.showErrorBox(
                    'Application Load Error',
                    'Unable to load the main application. Please contact support.'
                );
            });
        }

        ipcMain.handle('show-open-dialog', async (event, options) => {
            const result = await dialog.showOpenDialog(mainWindow, options);
            return result.filePaths;
        });

        ipcMain.on('get-user-data-path', (event) => {
            event.returnValue = app.getPath('userData');
        });

        ipcMain.on('window-control', (event, action) => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (!focusedWindow) return;

            switch (action) {
                case 'refresh':
                    mainWindow.reload();
                    break;
                case 'minimize':
                    focusedWindow.minimize();
                    break;
                case 'maximize':
                    if (focusedWindow.isMaximized()) {
                        focusedWindow.unmaximize();
                    } else {
                        focusedWindow.maximize();
                    }
                    break;
                case 'close':
                    focusedWindow.close();
                    break;
                case 'back':
                    if (focusedWindow.webContents.canGoBack()) {
                        focusedWindow.webContents.goBack();
                    }
                    break;
                case 'forward':
                    if (focusedWindow.webContents.canGoForward()) {
                        focusedWindow.webContents.goForward();
                    }
                    break;
            }
        });

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
            if (!navigationUrl.startsWith('http://localhost:9000') && !navigationUrl.startsWith('file://')) {
                event.preventDefault();
                shell.openExternal(navigationUrl);
            }
        });

    };

    createWindow();
}

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