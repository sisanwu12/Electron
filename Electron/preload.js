const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld('MyAPI', {
    MyShareDir() {
        return ipcRenderer.invoke('retShareDir')
    },
})