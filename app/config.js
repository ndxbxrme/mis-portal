(function() {
  'use strict';
  var BrowserWindow, Menu, Tray, app, click, ctxTemplate, fileSystem, ipcMain, mainMenu, mainTemplate, mainWindow, menus, path, settings, tray, webApp;

  ({app, BrowserWindow, Tray, Menu, ipcMain} = require('electron'));

  path = require('path');

  settings = require('./settings');

  fileSystem = null;

  webApp = null;

  mainWindow = null;

  mainMenu = null;

  ctxTemplate = [
    {
      type: 'separator'
    },
    {
      label: 'Exit MIS Portal',
      click: function() {
        return app.exit();
      }
    }
  ];

  mainTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Auto Download',
          type: 'checkbox',
          checked: settings.get('autoDownload'),
          click: function(event) {
            settings.set('autoDownload',
        !settings.get('autoDownload'));
            settings.save();
            Menu.setApplicationMenu(mainMenu);
            return fileSystem.init();
          }
        },
        {
          label: 'Auto Upload',
          type: 'checkbox',
          checked: settings.get('autoUpload'),
          click: function(event) {
            settings.set('autoUpload',
        !settings.get('autoUpload'));
            settings.save();
            Menu.setApplicationMenu(mainMenu);
            return fileSystem.init();
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Exit MIS Portal',
          click: function() {
            return app.exit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          role: 'undo'
        },
        {
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          role: 'cut'
        },
        {
          role: 'copy'
        },
        {
          role: 'paste'
        },
        {
          role: 'pasteandmatchstyle'
        },
        {
          role: 'delete'
        },
        {
          role: 'selectall'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: function(item,
        focusedWindow) {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'resetzoom'
        },
        {
          role: 'zoomin'
        },
        {
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: function() {
            require('electron').shell.openExternal('http://electron.atom.io');
          }
        }
      ]
    }
  ];

  menus = {
    ctx: [],
    main: []
  };

  click = function(event) {
    if (event.group) {
      webApp.goto('app.view-files', {
        groupId: event.id
      });
    } else {
      webApp.goto(event.id);
    }
    return mainWindow.show();
  };

  tray = null;

  module.exports = {
    setMainWindow: function(window) {
      return mainWindow = window;
    },
    setWebApp: function(_webApp) {
      return webApp = _webApp;
    },
    setFileSystem: function(_fileSystem) {
      return fileSystem = _fileSystem;
    },
    setMenus: function(_menus) {
      menus = _menus;
      return this.init();
    },
    init: function() {
      var addClick, contextMenu, myCtxMenu, myMainMenu;
      if (!tray) {
        tray = new Tray(path.join(__dirname, 'ctxicon.png'));
      }
      myMainMenu = Object.assign([], mainTemplate);
      Array.prototype.splice.apply(myMainMenu, [3, 0].concat(menus.main));
      myCtxMenu = Object.assign([], ctxTemplate);
      Array.prototype.splice.apply(myCtxMenu, [0, 0].concat(menus.ctx));
      addClick = function(menu) {
        var i, item, j, len, results;
        results = [];
        for (i = j = 0, len = menu.length; j < len; i = ++j) {
          item = menu[i];
          if (item.submenu || item.click || item.role || item.type) {

          } else {
            //do nothing
            item.click = click;
          }
          if (item.submenu) {
            results.push(addClick(item.submenu));
          } else {
            results.push(void 0);
          }
        }
        return results;
      };
      addClick(myMainMenu);
      addClick(myCtxMenu);
      mainMenu = Menu.buildFromTemplate(myMainMenu);
      contextMenu = Menu.buildFromTemplate(myCtxMenu);
      if (settings.userIsAdmin()) {
        mainMenu.items[0].submenu.items[1].visible = false;
      }
      if (settings.userIsClientMaster()) {
        mainMenu.items[0].submenu.items[0].visible = false;
      }
      mainMenu.items[0].submenu.items[0].checked = settings.get('autoDownload');
      mainMenu.items[0].submenu.items[1].checked = settings.get('autoUpload');
      tray.setToolTip('MIS Portal');
      tray.setContextMenu(contextMenu);
      tray.on('click', function() {
        return mainWindow.show();
      });
      return Menu.setApplicationMenu(mainMenu);
    }
  };

}).call(this);

//# sourceMappingURL=config.js.map
