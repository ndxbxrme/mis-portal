(function() {
  'use strict';
  var BrowserWindow, app, autoUpdater, mainWindow, portalUrl, ready;

  ({app, BrowserWindow} = require('electron'));

  ({autoUpdater} = require('electron-updater'));

  portalUrl = 'https://backofficesupportservicesportal.co.uk';

  if (process.argv.includes('local')) {
    portalUrl = 'http://localhost:3000';
  }

  if (process.argv.includes('test')) {
    portalUrl = 'http://misportal-test.backofficesupportservices.co.uk';
  }

  mainWindow = null;

  ready = function() {
    autoUpdater.checkForUpdatesAndNotify();
    BrowserWindow.addDevToolsExtension('C:\\Users\\lewis\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\ighdmehidhipcmcojjgiloacoafjmpfk\\0.10.9_0');
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720
    });
    mainWindow.on('closed', function() {
      return mainWindow = null;
    });
    mainWindow.loadURL(portalUrl);
    return mainWindow.openDevTools();
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
