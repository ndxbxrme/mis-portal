(function() {
  'use strict';
  var BrowserWindow, alertBadKey, app, appReady, autoUpdater, badKey, config, dialog, fileSystem, init, ipcMain, mainWindow, path, ready, settings, shouldQuit, url, webApp;

  ({app, BrowserWindow, ipcMain, dialog} = require('electron'));

  ({autoUpdater} = require('electron-updater'));

  url = require('url');

  path = require('path');

  settings = require('./settings');

  fileSystem = require('./file-system');

  webApp = require('./web-app');

  config = require('./config');

  appReady = false;

  badKey = true;

  mainWindow = null;

  init = async function() {
    badKey = settings.badKey();
    console.log('got key', badKey);
    await settings.load();
    console.log('loaded settings');
    await fileSystem.init();
    console.log('initted filestystem');
    return ready();
  };

  init();

  alertBadKey = function() {
    return new Promise(function(resolve) {
      return dialog.showMessageBox({
        type: 'error',
        title: 'Key Error',
        message: 'There was a problem with your MIS Portal key'
      }, function() {
        return app.exit();
      });
    });
  };

  ready = async function() {
    if (settings.loaded() && appReady) {
      if (badKey) {
        await alertBadKey();
      }
      config.init();
      //BrowserWindow.addExtension path.join app.getAppPath(), '\\extensions\\gbkeegbaiigmenfmjfclcdgdpimamgkj\\127.2195.2197_0'
      autoUpdater.checkForUpdatesAndNotify();
      BrowserWindow.addDevToolsExtension(path.join(app.getAppPath(), '\\extensions\\ighdmehidhipcmcojjgiloacoafjmpfk\\0.10.9_0'));
      mainWindow = new BrowserWindow({
        width: settings.get('mainWindow.width'),
        height: settings.get('mainWindow.height'),
        x: settings.get('mainWindow.x'),
        y: settings.get('mainWindow.y'),
        webPreferences: {
          plugins: true
        }
      });
      config.setMainWindow(mainWindow);
      config.setWebApp(webApp);
      config.setFileSystem(fileSystem);
      webApp.setMainWindow(mainWindow);
      webApp.setFileSystem(fileSystem);
      mainWindow.on('close', function(event) {
        var bounds;
        bounds = mainWindow.getBounds();
        ['width', 'height', 'x', 'y'].forEach(function(setting) {
          return settings.set('mainWindow.' + setting, bounds[setting]);
        });
        settings.save();
        event.preventDefault();
        return mainWindow.hide();
      });
      mainWindow.on('closed', function() {
        return mainWindow = null;
      });
      mainWindow.webContents.on('new-window', function(event) {
        return event.defaultPrevented = true;
      });
      mainWindow.loadURL(settings.portalUrl());
      return mainWindow.openDevTools();
    }
  };

  shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      return mainWindow.focus();
    }
  });

  if (shouldQuit) {
    app.quit();
    return;
  }

  app.on('ready', function() {
    appReady = true;
    return ready();
  });

  app.on('window-all-closed', function() {
    return process.platform === 'darwin' || app.quit();
  });

  app.on('activiate', function() {
    return mainWindow || ready();
  });

}).call(this);

//# sourceMappingURL=main.js.map
