const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld('MyAPI', {
    retShareDir: async () => {
        return await ipcRenderer.invoke('retShareDir');
    },
    // 接收主进程发送的本机信息
    LocalInfo: () => {
        return ipcRenderer.invoke('localInfo');
    },

    // 向主进程发送连接请求（目标 IP 与端口）
    connectToPeer: (remoteIp, remotePort) => {
        ipcRenderer.send('connect-to-peer', { remoteIp, remotePort });
    },
    haveLink: (callback) => ipcRenderer.on('data-channel-open', (event, data) => callback(data)),
    Download: (fileInfo) => ipcRenderer.send('Download-request', fileInfo),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath)
})
