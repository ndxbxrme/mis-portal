'use strict'

{app, Notification} = require 'electron'
fs = require 'fs-extra'
path = require 'path'
glob = require 'glob'
diff = require 'arr-diff'
chokidar = require 'chokidar'
settings = require './settings'
webApp = require './web-app'
Mimer = require 'mimer'
JSZip = require 'jszip'
superagent = require 'superagent'
AWS = require 'aws-sdk'
AWS.config.bucket = settings.aws('bucket')#awsKey.bucket
AWS.config.region = settings.aws('region')#'eu-west-1'
AWS.config.accessKeyId = settings.aws('id')#awsKey.id
AWS.config.secretAccessKey = settings.aws('key')#awsKey.key
S3 = new AWS.S3()

MAX_FILE_SIZE = 200000
PATTERN = 'image/*,.xls,.xlsx,.xlsm,.doc,.docx,.pdf,.txt,.csv,.zip,.rar'
uploadPath = null
uploadReplacePath = null
uploadGlobPath = null
downloadPath = path.join app.getPath('downloads'), 'MIS Portal Downloads'
downloadReplacePath = (downloadPath + path.sep).replace(/\\/g, '/') 
downloadGlobPath = path.join downloadPath, '**/*'
sanitizedClientName = ''
watching = false
uploading = false
downloading = false
validFiles = []
invalidFiles = []
pad = (n) ->
  if n < 10 then '0' + n else n.toString()
sanitizeName = (name) ->
  name.replace(/\//g, '_')
debounce = (func, delay) ->
  inDebounce = null
  ->
    context = @
    args = arguments
    clearTimeout inDebounce
    inDebounce = setTimeout ->
      func.apply context, args
    , delay
watch = (dir, cb) ->
  if not watching
    chokidar.watch dir
    .on 'change', (path) ->
      cb 'change', path if watching
    .on 'add', (path) ->
      cb 'add', path if watching
    .on 'unlink', (path) ->
      cb 'unlink', path if watching
    .on 'ready', ->
      watching = true
globStringToRegex = (str) ->
  regexp = ''
  excludes = []
  if str.length > 2 and str[0] == '/' and str[str.length - 1] == '/'
    regexp = str.substring(1, str.length - 1)
  else
    split = str.split(',')
    if split.length > 1
      i = 0
      while i < split.length
        r = globStringToRegex(split[i])
        if r.regexp
          regexp += '(' + r.regexp + ')'
          if i < split.length - 1
            regexp += '|'
        else
          excludes = excludes.concat(r.excludes)
        i++
    else
      if str.indexOf('!') == 0
        excludes.push '^((?!' + globStringToRegex(str.substring(1)).regexp + ').)*$'
      else
        if str.indexOf('.') == 0
          str = '*' + str
        regexp = '^' + str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&') + '$'
        regexp = regexp.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
  regexp: regexp
  excludes: excludes
validatePattern = (file, val) ->
  if !val
    return true
  pattern = globStringToRegex(val)
  valid = true
  if pattern.regexp and pattern.regexp.length
    regexp = new RegExp(pattern.regexp, 'i')
    valid = file.mimeType and regexp.test(file.mimeType) or file.name and regexp.test(file.name)
  len = pattern.excludes.length
  while len--
    exclude = new RegExp(pattern.excludes[len], 'i')
    valid = valid and (!file.mimeType or exclude.test(file.mimeType)) and (!file.name or exclude.test(file.name))
  valid
checkFile = (file) ->
  file.mimeType = Mimer file.name
  file.path = file.path or file.name
  if file.size > MAX_FILE_SIZE
    file.error = 'MAX_SIZE'
    return false
  if not validatePattern file, PATTERN
    file.error = 'PATTERN'
    return false
  return true
checkAndAddFile = (file) ->
  new Promise (resolve, reject) ->
    if file.type is 'directory'
      return resolve()
    if /\.zip$/.test file.name
      data = await fs.readFile file.path
      zip = await JSZip.loadAsync data
      zfiles = []
      zip.forEach (key, zfile) ->
        return if zfile.dir
        zfiles.push 
          key: key
          file: zfile
      for zfile in zfiles
        u8 = await zfile.file.async 'nodebuffer'
        myfile =
          name: sanitizedClientName + '/' + file.name.replace('.zip', '') + '/' + zfile.key
          path: zfile.key
          type: zfile.file
          parent: file.name
          data: u8
          size: u8.length
        await checkAndAddFile myfile
      resolve()
    else
      if checkFile file
        validFiles.unshift file
        await sendToS3 file
      else
        invalidFiles.unshift file
      resolve()
sendToS3 = (file) ->
  new Promise (resolve, reject) ->
    if file.data
      m =
        Bucket: AWS.config.bucket
        Key: file.name.replace(/\\/g, '/')
        Body: file.data
      S3.putObject m, (e, r) ->
        resolve()
    else
      data = await fs.readFile file.path
      m =
        Bucket: AWS.config.bucket
        Key: file.name
        Body: data
      S3.putObject m, (e, r) ->
        resolve()
getKey = (user) ->    
  b = (((Math.random() * 9999999) + 50000 | 0).toString(36) + ((Math.random() * 9999999) + 50000 | 0).toString(36))
  b.substr(0,4) + user._id.substr(0,2) + b.substr(4)
reportToPortal = ->
  new Promise (resolve, reject) ->
    if validFiles.length + invalidFiles.length is 0
      return resolve()
    validFilesData = validFiles.map (file) ->
      name: file.name
      path: file.path
      size: file.size
      mimeType: file.mimeType
      date: new Date()
    invalidFilesData = invalidFiles.map (file) ->
      name: file.name
      path: file.path
      size: file.size
      mimeType: file.mimeType
      error: file.error
      date: new Date()
    user = settings.get 'user'
    data = JSON.stringify
      user: user
      valid: validFilesData
      invalid: invalidFilesData
    superagent.post settings.portalUrl() + '/report-uploads/' + getKey user
    .send
      data: (new Buffer(data, 'binary')).toString('base64')
    .end (err, response) ->
      resolve()
listDownloads = (date) ->
  new Promise (resolve, reject) ->
    user = settings.get 'user'
    data = JSON.stringify
      user: user
      shortcodes: Object.keys user.profile.payrollClients
      date: date
    console.log settings.portalUrl() + '/list-downloads/' + getKey user
    superagent.post settings.portalUrl() + '/list-downloads/' + getKey user
    .send 
      data: (new Buffer(data, 'binary')).toString('base64')
    .end (err, response) ->
      #console.log err, response
      resolve response.body
    
doUpload = (fileName) ->
  new Promise (resolve, reject) ->
    stats = await fs.stat fileName
    file =
      name: fileName.replace uploadReplacePath, ''
      path: fileName
      type: if stats.isDirectory() then 'directory' else 'file'
      size: stats.size
    await checkAndAddFile file
    resolve()
checkForChanges = ->
  if uploading
    return setTimeout checkForChanges
    , 100
  validFiles = []
  invalidFiles = []
  user = settings.get 'user'
  if files = settings.get user._id + '.files'
    glob uploadGlobPath, (err, globFiles) ->
      deleted = diff files, globFiles
      added = diff globFiles, files
      uploading = true
      for file in added
        await doUpload file
      await reportToPortal files
      uploading = false
      settings.set user._id + '.files', globFiles
      settings.save()
  else
    glob uploadGlobPath, (err, files) ->
      settings.set user._id + '.files', files
      settings.save()
downloadFile = (key) ->
  new Promise (resolve, reject) ->
    filePath = path.join downloadPath, key
    if not await fs.exists filePath
      dirPath = path.dirname filePath
      await fs.ensureDir dirPath if not await fs.exists dirPath
      m =
        Bucket: AWS.config.bucket
        Key: key
      rs = S3.getObject(m).createReadStream()
      ws = fs.createWriteStream filePath
      rs.on 'error', (e) ->
        console.log 'read error', e
      rs.on 'close', ->
        console.log 'read stream closed'
      ws.on 'close', ->
        console.log 'write stream closed'
        resolve()
      ws.on 'end', ->
        resolve()
      ws.on 'error', ->
        resolve()
      rs.pipe ws
    else
      resolve()
checkForDownloads = ->
  console.log 'check', settings.get 'lastDownload'
  downloads = await listDownloads settings.get 'lastDownload'
  console.log 'downloads length', downloads.length
  maxDate = new Date(0)
  for download in downloads
    #console.log 'downloading', download.document
    if new Date(download.createdat) > new Date(maxDate)
      maxDate = download.createdat
    console.log download.document
    await downloadFile download.document
    #console.log 'completed download'
  if downloads.length > 0
    settings.set 'lastDownload', maxDate
    notification = new Notification
      title: 'MIS Portal'
      body: 'New files have been downloaded'
    notification.show()
  settings.save()
  webApp.listLocalFiles()
module.exports =
  listLocalFiles: ->
    new Promise (resolve, reject) ->
      if user = settings.get 'user'
        glob uploadGlobPath, (err, files) ->
          resolve files.map (file) ->
            file.replace uploadReplacePath, ''
      else
        resolve []
  getLocalFolder: ->
    uploadPath
  checkForDownloads: ->
    if settings.get 'autoDownload'
      checkForDownloads()
  init: ->
    new Promise (resolve, reject) ->
      if user = settings.get 'user'
        ###
        m =
          Bucket: AWS.config.bucket
          Prefix: 'N_A/2018/01'
        S3.listObjects m, (e, r) ->
        ###
        if user.profile.type 
          if (user.profile.type.code is '00' or user.profile.type.code is '01') and Object.keys(user.profile.payrollClients).length > 0
            uploadPath = path.join app.getPath('downloads'), 'MIS Portal Downloads'
            uploadReplacePath = (uploadPath + path.sep).replace(/\\/g, '/') 
            uploadGlobPath = path.join uploadPath, '**/*'
            #admin user
            if settings.get 'autoDownload'
              await fs.mkdir downloadPath if not await fs.exists downloadPath
              if user.profile.payrollClients
                ###
                for shortcode, client of user.profile.payrollClients
                  clientPath = path.join downloadPath, sanitizeName(client.name)
                  await fs.mkdir clientPath if not await fs.exists clientPath
                ###
                checkForDownloads()
              #get files to download
          if user.profile.type.code is '03'
            uploadPath = path.join app.getPath('documents'), 'MIS Portal Upload'
            sanitizedClientName = sanitizeName user.profile.clientID.clientname
            clientPath = path.join uploadPath, sanitizedClientName
            uploadReplacePath = (clientPath + path.sep).replace(/\\/g, '/') 
            uploadGlobPath = path.join clientPath, '**/*'
            if settings.get 'autoUpload'
              await fs.mkdir uploadPath if not await fs.exists uploadPath
              await fs.mkdir clientPath if not await fs.exists clientPath
              yearPath = path.join clientPath, new Date().getFullYear().toString()
              await fs.mkdir yearPath if not await fs.exists yearPath
              i = 0
              while i++ < 53
                weekPath = path.join yearPath, pad i
                await fs.mkdir weekPath if not await fs.exists weekPath
              sundryPath = path.join yearPath, 'sundry'
              await fs.mkdir sundryPath if not await fs.exists sundryPath
              debounced = debounce checkForChanges, 1000
              watch uploadPath.replace(/\\/g, '/'), debounced
              checkForChanges()
      resolve()