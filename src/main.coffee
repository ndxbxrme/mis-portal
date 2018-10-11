'use strict'

{app, BrowserWindow} = require 'electron'
{autoUpdater} = require 'electron-updater'

portalUrl = 'https://backofficesupportservicesportal.co.uk'
portalUrl = 'http://localhost:3000' if process.argv.includes 'local'
portalUrl = 'http://misportal-test.backofficesupportservices.co.uk'

mainWindow = null
ready = ->
  autoUpdater.checkForUpdatesAndNotify()
  mainWindow = new BrowserWindow
    width: 800
    height: 600
  mainWindow.on 'closed', ->
    mainWindow = null
  mainWindow.loadURL portalUrl
app.on 'ready', ready
app.on 'window-all-closed', ->
  process.platform is 'darwin' or app.quit()
app.on 'activiate', ->
  mainWindow or ready()