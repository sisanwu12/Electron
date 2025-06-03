const path = require('path');
const { app } = require('electron');

const isPackaged = app.isPackaged;
const basePath = isPackaged ? process.resourcesPath : __dirname;

const TheElectron = path.join(basePath, '../');
const ModulePath = path.join(TheElectron, 'my_modules');
const dbPath = path.join(TheElectron, 'db');

let homePath
app.whenReady().then(() => {
    homePath = app.getPath('home');
})

module.exports = {
    ModulePath,
    homePath,
    PagesPath: path.join(TheElectron, './Pages'),
    connectionPath: path.join(ModulePath, 'connection.js'),
    fileTransferPath: path.join(ModulePath, 'fileTransfer.js'),
    dbWorkerPath: path.join(ModulePath, 'dbworker.js'),
    filesdbPath: path.join(dbPath, 'files.db'),
    fileWatcherPath: path.join(ModulePath, 'fileWatcher.js'),
};