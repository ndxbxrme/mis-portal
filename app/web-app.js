(function() {
  'use strict';
  var config, fileSystem, ipcMain, listLocalFiles, mainWindow, path, settings, shell;

  ({ipcMain, shell} = require('electron'));

  path = require('path');

  settings = require('./settings');

  fileSystem = null;

  config = require('./config');

  mainWindow = null;

  ipcMain.on('login', async function(win, response) {
    response.status = void 0;
    response.services = void 0;
    settings.set('user', response);
    await settings.save();
    return fileSystem.init();
  });

  listLocalFiles = async function() {
    var files;
    files = (await fileSystem.listLocalFiles());
    return mainWindow.webContents.send('listLocalFiles', files);
  };

  ipcMain.on('listLocalFiles', listLocalFiles);

  ipcMain.on('setMenus', function(win, response) {
    return config.setMenus(response);
  });

  ipcMain.on('listDownloads', function(win, response) {
    console.log('list downloads');
    return console.log(reponse);
  });

  ipcMain.on('uploadsChanged', function() {
    console.log('uploads changed');
    return fileSystem.checkForDownloads();
  });

  ipcMain.on('openWithShell', function(win, response) {
    if (response && response.length) {
      return response.forEach(function(name) {
        return shell.openItem(path.join(fileSystem.getLocalFolder(), name));
      });
    }
  });

  module.exports = {
    setMainWindow: function(window) {
      return mainWindow = window;
    },
    setFileSystem: function(_fileSystem) {
      return fileSystem = _fileSystem;
    },
    listDownloads: function(shortcodes, userId) {
      return mainWindow != null ? mainWindow.webContents.send('listDownloads', {
        shortcodes: shortcodes,
        userId: userId
      }) : void 0;
    },
    listLocalFiles: listLocalFiles,
    goto: function(name, params) {
      return mainWindow.webContents.send('goto', {
        name: name,
        params: params
      });
    }
  };

}).call(this);

//# sourceMappingURL=web-app.js.map
