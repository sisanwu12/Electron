const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld('MyAPI', {
    retShareDir: async () => {
        return await ipcRenderer.invoke('retShareDir');
    },
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info')
})
