'use strict'

{app, BrowserWindow, Tray, Menu, ipcMain} = require 'electron'
path = require 'path'
settings = require './settings'
fileSystem = null
webApp = null

mainWindow = null
mainMenu = null
ctxTemplate = [
  { type: 'separator' }
  {
    label: 'Exit MIS Portal'
    click: ->
      app.exit()
  }
]
mainTemplate = [
  {
    label: 'File'
    submenu: [
      {
        label: 'Auto Download'
        type: 'checkbox'
        checked: settings.get 'autoDownload'
        click: (event) ->
          settings.set 'autoDownload', not settings.get 'autoDownload'
          settings.save()
          Menu.setApplicationMenu mainMenu
          fileSystem.init()
      }
      {
        label: 'Auto Upload'
        type: 'checkbox'
        checked: settings.get 'autoUpload'
        click: (event) ->
          settings.set 'autoUpload', not settings.get 'autoUpload'
          settings.save()
          Menu.setApplicationMenu mainMenu
          fileSystem.init()
      }
      { type: 'separator' }
      {
        label: 'Exit MIS Portal'
        click: ->
          app.exit()
      }
    ]
  }
  {
    label: 'Edit'
    submenu: [
      { role: 'undo' }
      { role: 'redo' }
      { type: 'separator' }
      { role: 'cut' }
      { role: 'copy' }
      { role: 'paste' }
      { role: 'pasteandmatchstyle' }
      { role: 'delete' }
      { role: 'selectall' }
    ]
  }
  {
    label: 'View'
    submenu: [
      {
        label: 'Reload'
        accelerator: 'CmdOrCtrl+R'
        click: (item, focusedWindow) ->
          if focusedWindow
            focusedWindow.reload()
          return

      }
      { type: 'separator' }
      { role: 'resetzoom' }
      { role: 'zoomin' }
      { role: 'zoomout' }
      { type: 'separator' }
      { role: 'togglefullscreen' }
    ]
  }
  {
    role: 'window'
    submenu: [
      { role: 'minimize' }
      { role: 'close' }
    ]
  }
  {
    role: 'help'
    submenu: [ {
      label: 'Learn More'
      click: ->
        require('electron').shell.openExternal 'http://electron.atom.io'
        return

    } ]
  }
]

menus =
  ctx: []
  main: []
click = (event) ->
  if event.group
    webApp.goto 'app.view-files', groupId: event.id
  else
    webApp.goto event.id
  mainWindow.show()
tray = null
module.exports =
  setMainWindow: (window) ->
    mainWindow = window
  setWebApp: (_webApp) ->
    webApp = _webApp
  setFileSystem: (_fileSystem) ->
    fileSystem = _fileSystem
  setMenus: (_menus) ->
    menus = _menus
    @.init()
  init: ->
    tray = new Tray path.join __dirname, 'ctxicon.png' if not tray
    myMainMenu = Object.assign [], mainTemplate
    Array.prototype.splice.apply myMainMenu, [3, 0].concat(menus.main)
    myCtxMenu = Object.assign [], ctxTemplate
    Array.prototype.splice.apply myCtxMenu, [0, 0].concat(menus.ctx)
    addClick = (menu) ->
      for item, i in menu
        if item.submenu or item.click or item.role or item.type
          #do nothing
        else
          item.click = click
        addClick item.submenu if item.submenu
    addClick myMainMenu
    addClick myCtxMenu
    mainMenu = Menu.buildFromTemplate myMainMenu
    contextMenu = Menu.buildFromTemplate myCtxMenu
    if settings.userIsAdmin()
      mainMenu.items[0].submenu.items[1].visible = false
    if settings.userIsClientMaster()
      mainMenu.items[0].submenu.items[0].visible = false
    mainMenu.items[0].submenu.items[0].checked = settings.get 'autoDownload'
    mainMenu.items[0].submenu.items[1].checked = settings.get 'autoUpload'
    tray.setToolTip 'MIS Portal'
    tray.setContextMenu contextMenu
    tray.on 'click', ->
      mainWindow.show()
    Menu.setApplicationMenu mainMenu