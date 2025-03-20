const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const myfiles = require('../my_modules/my_files');
const mynetwork = require('../my_modules/my_network');

// 全局常量定义
const BROADCAST_PORT = 32145; // 端口号
const BROADCAST_ADDR = '255.255.255.255'; // 子网掩码
const Broadcast_Time = 5000;  // 广播时间间隔

// 全局路径定义
const DataPath = path.join(__dirname, `${path.sep}Database${path.sep}`);
const PagePath = path.join(__dirname, `${path.sep}Pages.${path.sep}`);


// 创建界面函数
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js')
    }
  });
  win.loadFile(path.join(PagePath, "index.html"));
}



// 准备就绪，开始渲染页面
app.whenReady().then(() => {
  // 监听分享文件夹获取消息
  ipcMain.handle('retShareDir', async () => {
    return await myfiles.retDatabaseDir(DataPath);
  });
  // 创建窗口
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})