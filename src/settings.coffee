'use strict'

{app} = require 'electron'
path = require 'path'
dotty = require 'dotty'
fs = require 'fs-extra'

portalKey = process.env.MIS_PORTAL_KEY
appKey = {}
try
  appKey = JSON.parse new Buffer(portalKey, 'base64').toString('binary')
catch e

settings = 
  mainWindow:
    width: 1280
    height: 800
  autoDownload: true
  autoUpload: true
settingsPath = path.join app.getPath('userData'), 'settings.json'
loaded = false
portalUrl = ''

load = ->
  new Promise (resolve, reject) ->
    exists = await fs.exists settingsPath
    if exists
      settings = JSON.parse await fs.readFile settingsPath, 'utf8'
      loaded = true
      resolve()
    else
      await save()
      loaded = true
      resolve()
save = ->
  fs.writeFile settingsPath, JSON.stringify(settings), 'utf8'

module.exports =
  badKey: ->
    Object.keys(appKey).length < 1
  load: load
  save: save
  get: (key) ->
    dotty.get settings, key
  set: (key, value) ->
    dotty.put settings, key, value
  loaded: ->
    loaded
  portalUrl: (url) ->
    appKey.url
  aws: (field) ->
    appKey[field]
  userIsAdmin: ->
    user = dotty.get settings, 'user'
    if user
      return user.profile.type.code is '00' or user.profile.type.code is '01'
    false
  userIsClientMaster: ->
    user = dotty.get settings, 'user'
    if user
      return user.profile.type.code is '03'
    false