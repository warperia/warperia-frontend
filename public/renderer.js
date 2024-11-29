document.getElementById('refresh-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'refresh');
});

document.getElementById('minimize-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'minimize');
});

document.getElementById('maximize-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'maximize');
});

document.getElementById('close-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'close');
});

document.getElementById('back-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'back');
});

document.getElementById('forward-button').addEventListener('click', () => {
    window.electron.ipcRenderer.send('window-control', 'forward');
});