'use strict'

{app, BrowserWindow, ipcMain, dialog} = require 'electron'
{autoUpdater} = require 'electron-updater'
url = require 'url'
path = require 'path'
settings = require './settings'
fileSystem = require './file-system'
webApp = require './web-app'
config = require './config'

appReady = false
badKey = true

mainWindow = null
init = ->
  badKey = settings.badKey()
  console.log 'got key', badKey
  await settings.load()
  console.log 'loaded settings'
  await fileSystem.init()
  console.log 'initted filestystem'
  ready()
init()
alertBadKey = ->
  new Promise (resolve) ->
    dialog.showMessageBox
      type: 'error'
      title: 'Key Error'
      message: 'There was a problem with your MIS Portal key'
    , ->
      app.exit()
ready = ->
  if settings.loaded() and appReady
    if badKey
      await alertBadKey()
    config.init()
    #BrowserWindow.addExtension path.join app.getAppPath(), '\\extensions\\gbkeegbaiigmenfmjfclcdgdpimamgkj\\127.2195.2197_0'
    autoUpdater.checkForUpdatesAndNotify()
    #BrowserWindow.addDevToolsExtension path.join app.getAppPath(), '\\extensions\\ighdmehidhipcmcojjgiloacoafjmpfk\\0.10.9_0'
    mainWindow = new BrowserWindow
      width: settings.get 'mainWindow.width'
      height: settings.get 'mainWindow.height'
      x: settings.get 'mainWindow.x'
      y: settings.get 'mainWindow.y'
      webPreferences:
        plugins: true
    config.setMainWindow mainWindow
    config.setWebApp webApp
    config.setFileSystem fileSystem
    webApp.setMainWindow mainWindow
    webApp.setFileSystem fileSystem
    mainWindow.on 'close', (event) ->
      bounds = mainWindow.getBounds()
      ['width','height','x','y'].forEach (setting) ->
        settings.set 'mainWindow.' + setting, bounds[setting]
      settings.save()
      event.preventDefault()
      mainWindow.hide()
    mainWindow.on 'closed', ->
      mainWindow = null
    mainWindow.webContents.on 'new-window', (event) ->
      event.defaultPrevented = true
    mainWindow.loadURL settings.portalUrl()
    #mainWindow.openDevTools()
shouldQuit = app.makeSingleInstance (commandLine, workingDirectory) ->
  if mainWindow
    mainWindow.restore() if mainWindow.isMinimized()
    mainWindow.focus()
if shouldQuit
  app.quit()
  return
app.on 'ready', ->
  appReady = true
  ready()
app.on 'window-all-closed', ->
  process.platform is 'darwin' or app.quit()
app.on 'activiate', ->
  mainWindow or ready()