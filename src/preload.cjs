try {
  const { contextBridge, ipcRenderer } = require('electron');
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const versionInfo = require('win-version-info');
  const extract = require('extract-zip');
  const { spawn } = require('child_process');
  const processManager = new Map();

  contextBridge.exposeInMainWorld('electron', {

    ipcRenderer: {
      send: (channel, data) => ipcRenderer.send(channel, data),
      invoke: (channel, data) => ipcRenderer.invoke(channel, data),
      on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
      removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
    },

    pathJoin: (...args) => path.join(...args),
    pathResolve: (...args) => path.resolve(...args),
    pathNormalize: (p) => path.normalize(p),
    pathRelative: (from, to) => path.relative(from, to),
    pathIsAbsolute: (p) => path.isAbsolute(p),

    // App Updates (not working, needs attention at some point)
    getUserDataPath: () => {
      return ipcRenderer.sendSync('get-user-data-path');
    },

    downloadFile: async (url, savePath) => {
      return new Promise((resolve, reject) => {
        const fs = require('fs');
        const https = require('https');

        const file = fs.createWriteStream(savePath);
        https
          .get(url, (response) => {
            if (response.statusCode !== 200) {
              return reject(new Error(`Failed to download file: ${response.statusCode}`));
            }

            const totalBytes = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;

            // console.log(`Starting download. Total size: ${totalBytes} bytes`);

            response.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              ipcRenderer.send('download-progress', progress);
            });

            response.pipe(file);

            file.on('finish', () => {
              file.close(() => {
                console.log('Download complete');
                resolve(savePath);
              });
            });
          })
          .on('error', (err) => {
            fs.unlink(savePath, () => reject(err));
          });
      });
    },

    // Expose the function to restart and install the app
    installUpdate: () => {
      ipcRenderer.invoke("install-update");
    },

    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

    storeToken: (token) => ipcRenderer.invoke('store-token', token),
    retrieveToken: () => ipcRenderer.invoke('retrieve-token'),
    clearToken: () => ipcRenderer.invoke('clear-token'),

    storeUser: (user) => ipcRenderer.invoke('store-user', user),
    retrieveUser: () => ipcRenderer.invoke('retrieve-user'),
    clearUser: () => ipcRenderer.invoke('clear-user'),

    // Launch an executable
    launchExe: (exePath) => {
      if (!fs.existsSync(exePath)) {
        throw new Error('Executable file not found.');
      }

      if (processManager.has(exePath)) {
        throw new Error('The process is already running.');
      }

      const processInstance = spawn(exePath, [], {
        detached: true,
        stdio: 'ignore',
      });

      processInstance.unref();
      processManager.set(exePath, processInstance.pid);

      // Emit status when the process starts
      ipcRenderer.send('process-status-update', { exePath, running: true });

      // Listen for process exit or error events
      processInstance.on('exit', (code) => {
        console.log(`Process exited: ${exePath}, code: ${code}`);
        processManager.delete(exePath);
        ipcRenderer.send('process-status-update', { exePath, running: false });
      });

      processInstance.on('error', (error) => {
        console.error(`Process error: ${exePath}, error: ${error.message}`);
        processManager.delete(exePath);
        ipcRenderer.send('process-status-update', { exePath, running: false });
      });

      return processInstance.pid;
    },

    // Check if a process is running
    isProcessRunning: (exePath) => {
      const pid = processManager.get(exePath);
      if (!pid) return false;

      try {
        process.kill(pid, 0); // Check if the process is alive
        return true;
      } catch {
        processManager.delete(exePath); // Cleanup if the process is not running
        return false;
      }
    },

    // Terminate a process
    terminateProcess: (exePath) => {
      const pid = processManager.get(exePath);
      if (!pid) {
        throw new Error('No process found to terminate.');
      }

      try {
        process.kill(pid);
        processManager.delete(exePath);
        ipcRenderer.send('process-status-update', { exePath, running: false });
        return true;
      } catch (error) {
        throw new Error(`Failed to terminate process: ${error.message}`);
      }
    },

    checkWowVersion: (filePath) => {
      try {
        const fileName = path.basename(filePath);
        const fileDir = path.dirname(filePath);

        // Read version info for the selected file
        const versionData = versionInfo(filePath);
        const productName = versionData.ProductName || '';
        const fileDescription = versionData.FileDescription || '';

        // Strict check for "World of Warcraft" in either field
        const isWowExecutable = /world of warcraft/i.test(productName) || /world of warcraft/i.test(fileDescription);

        if (isWowExecutable) {
          console.log(`Matched WoW executable: ${fileName}`);

          // Check for WoW-specific directories in the same directory as the .exe file
          const requiredDirs = ['Data', 'Interface', 'WTF'];
          const hasRequiredDirs = requiredDirs.some(dirName => fs.existsSync(path.join(fileDir, dirName)));

          if (hasRequiredDirs) {
            console.log('Valid WoW installation directory detected.');
            return versionData.ProductVersion; // Return version if valid WoW executable
          } else {
            console.warn('WoW executable found, but required directories (Data, Interface, WTF) are missing.');
            return null; // Invalid if directories are missing
          }
        } else {
          console.warn('The selected file is not a valid World of Warcraft executable.');
          return null; // Explicitly return null for non-WoW executables
        }
      } catch (error) {
        console.error(`Error reading version info for ${filePath}:`, error);
        return null; // Explicitly return null on error
      }
    },

    saveZipFile: async (zipBlob, fileName) => {
      try {
        const userDataPath = ipcRenderer.sendSync('get-user-data-path');
        const filePath = path.join(userDataPath, fileName);

        const buffer = await zipBlob.arrayBuffer();
        await fs.promises.writeFile(filePath, Buffer.from(buffer));
        return filePath;
      } catch (err) {
        console.error('Error writing file:', err);
        throw err;
      }
    },

    extractZip: async (zipPath, extractPath) => {
      try {
        await extract(zipPath, { dir: extractPath });
      } catch (err) {
        console.error("Error extracting ZIP file:", err);
        throw err;
      }
    },

    writeFile: async (filePath, fileData) => {
      try {
        // Check if file already exists before writing
        const fileExists = await fs.promises.access(filePath).then(() => true).catch(() => false);
        if (fileExists) {
          return;  // Skip if the file already exists
        }

        // Proceed to write the file if it does not exist
        await fs.promises.writeFile(filePath, fileData);
      } catch (err) {
        console.error(`Error writing file: ${filePath}`, err);
        throw err;
      }
    },

    createFolder: async (folderPath) => {
      try {
        await fs.promises.mkdir(folderPath, { recursive: true });
      } catch (err) {
        console.error("Error creating folder:", err);
        throw err;
      }
    },

    readDir: async (dirPath) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
      } catch (err) {
        console.error("Error reading directory:", err);
        throw err;
      }
    },

    readFile: async (filePath) => {
      try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return data;
      } catch (err) {
        console.error('Error reading file:', err);
        throw err;
      }
    },

    readDirAndFiles: async (dirPath) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const files = entries
          .filter(entry => entry.isFile() && (entry.name.endsWith('.lua') || entry.name.endsWith('.toc')))
          .map(file => file.name);
        const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

        return { files, directories }; // Return both files and directories
      } catch (err) {
        console.error("Error reading directory and files:", err);
        throw err;
      }
    },

    deleteFolder: async (folderPath) => {
      try {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
      } catch (err) {
        console.error("Error deleting folder:", err);
        throw err;
      }
    },

    pathJoin: (...segments) => {
      return path.join(...segments);
    },

    deleteUnknownAddonFolder: async (folderPath) => {
      try {
        // Delete all files and subfolders first
        const files = await fs.promises.readdir(folderPath, { withFileTypes: true });
        await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(folderPath, file.name);
            if (file.isDirectory()) {
              await fs.promises.rm(filePath, { recursive: true, force: true });
            } else {
              await fs.promises.unlink(filePath);
            }
          })
        );

        // Then delete the folder itself
        await fs.promises.rmdir(folderPath);
      } catch (err) {
        console.error("Error deleting folder and its contents:", err);
        throw err;
      }
    },

    fileExists: async (filePath) => {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    },

    readTitleFromToc: async (tocFilePath) => {
      try {
        const data = await fs.promises.readFile(tocFilePath, 'utf8');
        const titleLine = data.split('\n').find(line => line.startsWith('## Title:'));
        if (titleLine) {
          let title = titleLine.replace('## Title:', '').trim();

          // Strip WoW-specific color codes and special characters
          title = title.replace(/\|c[0-9a-fA-F]{8}/g, '').replace(/\|r/g, '');
          title = title.replace(/(\|H.*?\|h|\|T.*?\|t|\|A.*?\|a)/g, '');

          return title.trim();
        }
        return null;
      } catch (error) {
        console.error('Error reading .toc file:', error);
        throw error;
      }
    },

    readVersionFromToc: async (tocFilePath) => {
      try {
        const content = await fs.promises.readFile(tocFilePath, 'utf-8');
        const versionLine = content.split('\n').find(line => line.startsWith('## Version:'));
        return versionLine ? versionLine.split(': ')[1].trim() : null;
      } catch (err) {
        console.error("Error reading version from TOC:", err);
        throw err;
      }
    },

    updateTocVersion: async (addonPath, version) => {
      try {
        const tocFilePath = path.join(addonPath, `${path.basename(addonPath)}.toc`);
        let tocContent = await fs.promises.readFile(tocFilePath, 'utf-8');
        const versionLine = tocContent.split('\n').find(line => line.startsWith('## Version:'));

        if (versionLine) {
          tocContent = tocContent.replace(versionLine, `## Version: ${version}`);
        } else {
          tocContent += `\n## Version: ${version}`;
        }

        await fs.promises.writeFile(tocFilePath, tocContent);
      } catch (err) {
        console.error('Error updating .toc file:', err);
        throw err;
      }
    },

    readDependenciesFromToc: async (tocFilePath) => {
      try {
        const data = await fs.promises.readFile(tocFilePath, 'utf8');
        const optionalDeps = data.split('\n').filter(line => line.startsWith('## OptionalDeps:')).map(line => line.replace('## OptionalDeps:', '').trim());
        const loadOnDemand = data.split('\n').filter(line => line.startsWith('## LoadOnDemand:')).map(line => line.replace('## LoadOnDemand:', '').trim());
        const dependencies = [...optionalDeps, ...loadOnDemand].flatMap(dep => dep.split(',').map(d => d.trim()));

        return dependencies;
      } catch (error) {
        console.error('Error reading dependencies from .toc file:', error);
        throw error;
      }
    },

    normalizePath: (filePath) => {
      const normalizedPath = path.normalize(filePath);
      return normalizedPath;
    }

  });
} catch (error) {
  console.error('Error in preload script:', error);
}