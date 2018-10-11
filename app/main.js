(function() {
  'use strict';
  var BrowserWindow, app, autoUpdater, mainWindow, portalUrl, ready;

  ({app, BrowserWindow} = require('electron'));

  ({autoUpdater} = require('electron-updater'));

  portalUrl = 'https://backofficesupportservicesportal.co.uk';

  if (process.argv.includes('local')) {
    portalUrl = 'http://localhost:3000';
  }

  portalUrl = 'http://misportal-test.backofficesupportservices.co.uk';

  mainWindow = null;

  ready = function() {
    autoUpdater.checkForUpdatesAndNotify();
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600
    });
    mainWindow.on('closed', function() {
      return mainWindow = null;
    });
    return mainWindow.loadURL(portalUrl);
  };

  app.on('ready', ready);

  app.on('window-all-closed', function() {
    return process.platform === 'darwin' || app.quit();
  });

  app.on('activiate', function() {
    return mainWindow || ready();
  });

}).call(this);

//# sourceMappingURL=main.js.map
