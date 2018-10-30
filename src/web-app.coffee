'use strict'

{ipcMain, shell} = require 'electron'
path = require 'path'
settings = require './settings'
fileSystem = null
config = require './config'

mainWindow = null

ipcMain.on 'login', (win, response) ->
  response.status = undefined
  response.services = undefined
  settings.set 'user', response
  await settings.save()
  fileSystem.init()
listLocalFiles = ->
  files = await fileSystem.listLocalFiles()
  mainWindow.webContents.send 'listLocalFiles', files
ipcMain.on 'listLocalFiles', listLocalFiles
ipcMain.on 'setMenus', (win, response) ->
  config.setMenus response
ipcMain.on 'listDownloads', (win, response) ->
  console.log 'list downloads'
  console.log reponse
ipcMain.on 'uploadsChanged', ->
  console.log 'uploads changed'
  fileSystem.checkForDownloads()
ipcMain.on 'openWithShell', (win, response) ->
  if response and response.length
    response.forEach (name) ->
      shell.openItem path.join fileSystem.getLocalFolder(), name
module.exports =
  setMainWindow: (window) ->
    mainWindow = window
  setFileSystem: (_fileSystem) ->
    fileSystem = _fileSystem
  listDownloads: (shortcodes, userId) ->
    mainWindow?.webContents.send 'listDownloads', 
      shortcodes: shortcodes
      userId: userId
  listLocalFiles: listLocalFiles
  goto: (name, params) ->
    mainWindow.webContents.send 'goto',
      name: name
      params: params