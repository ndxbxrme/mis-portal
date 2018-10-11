'use strict'

{app, BrowserWindow} = require 'electron'
{autoUpdater} = require 'electron-updater'

portalUrl = 'https://backofficesupportservicesportal.co.uk'
portalUrl = 'http://localhost:3000' if process.argv.includes 'local'
portalUrl = 'http://misportal-test.backofficesupportservices.co.uk' if process.argv.includes 'test'

mainWindow = null
ready = ->
  autoUpdater.checkForUpdatesAndNotify()
  BrowserWindow.addDevToolsExtension 'C:\\Users\\lewis\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\ighdmehidhipcmcojjgiloacoafjmpfk\\0.10.9_0'
  mainWindow = new BrowserWindow
    width: 1280
    height: 720
  mainWindow.on 'closed', ->
    mainWindow = null
  mainWindow.loadURL portalUrl
  mainWindow.openDevTools()
app.on 'ready', ready
app.on 'window-all-closed', ->
  process.platform is 'darwin' or app.quit()
app.on 'activiate', ->
  mainWindow or ready()