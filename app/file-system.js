(function() {
  'use strict';
  var AWS, JSZip, MAX_FILE_SIZE, Mimer, Notification, PATTERN, S3, app, checkAndAddFile, checkFile, checkForChanges, checkForDownloads, chokidar, debounce, diff, doUpload, downloadFile, downloadGlobPath, downloadPath, downloadReplacePath, downloading, fs, getKey, glob, globStringToRegex, invalidFiles, listDownloads, pad, path, reportToPortal, sanitizeName, sanitizedClientName, sendToS3, settings, superagent, uploadGlobPath, uploadPath, uploadReplacePath, uploading, validFiles, validatePattern, watch, watching, webApp;

  ({app, Notification} = require('electron'));

  fs = require('fs-extra');

  path = require('path');

  glob = require('glob');

  diff = require('arr-diff');

  chokidar = require('chokidar');

  settings = require('./settings');

  webApp = require('./web-app');

  Mimer = require('mimer');

  JSZip = require('jszip');

  superagent = require('superagent');

  AWS = require('aws-sdk');

  AWS.config.bucket = settings.aws('bucket'); //awsKey.bucket

  AWS.config.region = settings.aws('region'); //'eu-west-1'

  AWS.config.accessKeyId = settings.aws('id'); //awsKey.id

  AWS.config.secretAccessKey = settings.aws('key'); //awsKey.key

  S3 = new AWS.S3();

  MAX_FILE_SIZE = 200000;

  PATTERN = 'image/*,.xls,.xlsx,.xlsm,.doc,.docx,.pdf,.txt,.csv,.zip,.rar';

  uploadPath = null;

  uploadReplacePath = null;

  uploadGlobPath = null;

  downloadPath = path.join(app.getPath('downloads'), 'MIS Portal Downloads');

  downloadReplacePath = (downloadPath + path.sep).replace(/\\/g, '/');

  downloadGlobPath = path.join(downloadPath, '**/*');

  sanitizedClientName = '';

  watching = false;

  uploading = false;

  downloading = false;

  validFiles = [];

  invalidFiles = [];

  pad = function(n) {
    if (n < 10) {
      return '0' + n;
    } else {
      return n.toString();
    }
  };

  sanitizeName = function(name) {
    return name.replace(/\//g, '_');
  };

  debounce = function(func, delay) {
    var inDebounce;
    inDebounce = null;
    return function() {
      var args, context;
      context = this;
      args = arguments;
      clearTimeout(inDebounce);
      return inDebounce = setTimeout(function() {
        return func.apply(context, args);
      }, delay);
    };
  };

  watch = function(dir, cb) {
    if (!watching) {
      return chokidar.watch(dir).on('change', function(path) {
        if (watching) {
          return cb('change', path);
        }
      }).on('add', function(path) {
        if (watching) {
          return cb('add', path);
        }
      }).on('unlink', function(path) {
        if (watching) {
          return cb('unlink', path);
        }
      }).on('ready', function() {
        return watching = true;
      });
    }
  };

  globStringToRegex = function(str) {
    var excludes, i, r, regexp, split;
    regexp = '';
    excludes = [];
    if (str.length > 2 && str[0] === '/' && str[str.length - 1] === '/') {
      regexp = str.substring(1, str.length - 1);
    } else {
      split = str.split(',');
      if (split.length > 1) {
        i = 0;
        while (i < split.length) {
          r = globStringToRegex(split[i]);
          if (r.regexp) {
            regexp += '(' + r.regexp + ')';
            if (i < split.length - 1) {
              regexp += '|';
            }
          } else {
            excludes = excludes.concat(r.excludes);
          }
          i++;
        }
      } else {
        if (str.indexOf('!') === 0) {
          excludes.push('^((?!' + globStringToRegex(str.substring(1)).regexp + ').)*$');
        } else {
          if (str.indexOf('.') === 0) {
            str = '*' + str;
          }
          regexp = '^' + str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&') + '$';
          regexp = regexp.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
        }
      }
    }
    return {
      regexp: regexp,
      excludes: excludes
    };
  };

  validatePattern = function(file, val) {
    var exclude, len, pattern, regexp, valid;
    if (!val) {
      return true;
    }
    pattern = globStringToRegex(val);
    valid = true;
    if (pattern.regexp && pattern.regexp.length) {
      regexp = new RegExp(pattern.regexp, 'i');
      valid = file.mimeType && regexp.test(file.mimeType) || file.name && regexp.test(file.name);
    }
    len = pattern.excludes.length;
    while (len--) {
      exclude = new RegExp(pattern.excludes[len], 'i');
      valid = valid && (!file.mimeType || exclude.test(file.mimeType)) && (!file.name || exclude.test(file.name));
    }
    return valid;
  };

  checkFile = function(file) {
    file.mimeType = Mimer(file.name);
    file.path = file.path || file.name;
    if (file.size > MAX_FILE_SIZE) {
      file.error = 'MAX_SIZE';
      return false;
    }
    if (!validatePattern(file, PATTERN)) {
      file.error = 'PATTERN';
      return false;
    }
    return true;
  };

  checkAndAddFile = function(file) {
    return new Promise(async function(resolve, reject) {
      var data, j, len1, myfile, u8, zfile, zfiles, zip;
      if (file.type === 'directory') {
        return resolve();
      }
      if (/\.zip$/.test(file.name)) {
        data = (await fs.readFile(file.path));
        zip = (await JSZip.loadAsync(data));
        zfiles = [];
        zip.forEach(function(key, zfile) {
          if (zfile.dir) {
            return;
          }
          return zfiles.push({
            key: key,
            file: zfile
          });
        });
        for (j = 0, len1 = zfiles.length; j < len1; j++) {
          zfile = zfiles[j];
          u8 = (await zfile.file.async('nodebuffer'));
          myfile = {
            name: sanitizedClientName + '/' + file.name.replace('.zip', '') + '/' + zfile.key,
            path: zfile.key,
            type: zfile.file,
            parent: file.name,
            data: u8,
            size: u8.length
          };
          await checkAndAddFile(myfile);
        }
        return resolve();
      } else {
        if (checkFile(file)) {
          validFiles.unshift(file);
          await sendToS3(file);
        } else {
          invalidFiles.unshift(file);
        }
        return resolve();
      }
    });
  };

  sendToS3 = function(file) {
    return new Promise(async function(resolve, reject) {
      var data, m;
      if (file.data) {
        m = {
          Bucket: AWS.config.bucket,
          Key: file.name.replace(/\\/g, '/'),
          Body: file.data
        };
        return S3.putObject(m, function(e, r) {
          return resolve();
        });
      } else {
        data = (await fs.readFile(file.path));
        m = {
          Bucket: AWS.config.bucket,
          Key: file.name,
          Body: data
        };
        return S3.putObject(m, function(e, r) {
          return resolve();
        });
      }
    });
  };

  getKey = function(user) {
    var b;
    b = ((Math.random() * 9999999) + 50000 | 0).toString(36) + ((Math.random() * 9999999) + 50000 | 0).toString(36);
    return b.substr(0, 4) + user._id.substr(0, 2) + b.substr(4);
  };

  reportToPortal = function() {
    return new Promise(function(resolve, reject) {
      var data, invalidFilesData, user, validFilesData;
      if (validFiles.length + invalidFiles.length === 0) {
        return resolve();
      }
      validFilesData = validFiles.map(function(file) {
        return {
          name: file.name,
          path: file.path,
          size: file.size,
          mimeType: file.mimeType,
          date: new Date()
        };
      });
      invalidFilesData = invalidFiles.map(function(file) {
        return {
          name: file.name,
          path: file.path,
          size: file.size,
          mimeType: file.mimeType,
          error: file.error,
          date: new Date()
        };
      });
      user = settings.get('user');
      data = JSON.stringify({
        user: user,
        valid: validFilesData,
        invalid: invalidFilesData
      });
      return superagent.post(settings.portalUrl() + '/report-uploads/' + getKey(user)).send({
        data: (new Buffer(data, 'binary')).toString('base64')
      }).end(function(err, response) {
        return resolve();
      });
    });
  };

  listDownloads = function(date) {
    return new Promise(function(resolve, reject) {
      var data, user;
      user = settings.get('user');
      data = JSON.stringify({
        user: user,
        shortcodes: Object.keys(user.profile.payrollClients),
        date: date
      });
      console.log(settings.portalUrl() + '/list-downloads/' + getKey(user));
      return superagent.post(settings.portalUrl() + '/list-downloads/' + getKey(user)).send({
        data: (new Buffer(data, 'binary')).toString('base64')
      }).end(function(err, response) {
        //console.log err, response
        return resolve(response.body);
      });
    });
  };

  doUpload = function(fileName) {
    return new Promise(async function(resolve, reject) {
      var file, stats;
      stats = (await fs.stat(fileName));
      file = {
        name: fileName.replace(uploadReplacePath, ''),
        path: fileName,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size
      };
      await checkAndAddFile(file);
      return resolve();
    });
  };

  checkForChanges = function() {
    var files, user;
    if (uploading) {
      return setTimeout(checkForChanges, 100);
    }
    validFiles = [];
    invalidFiles = [];
    user = settings.get('user');
    if (files = settings.get(user._id + '.files')) {
      return glob(uploadGlobPath, async function(err, globFiles) {
        var added, deleted, file, j, len1;
        deleted = diff(files, globFiles);
        added = diff(globFiles, files);
        uploading = true;
        for (j = 0, len1 = added.length; j < len1; j++) {
          file = added[j];
          await doUpload(file);
        }
        await reportToPortal(files);
        uploading = false;
        settings.set(user._id + '.files', globFiles);
        return settings.save();
      });
    } else {
      return glob(uploadGlobPath, function(err, files) {
        settings.set(user._id + '.files', files);
        return settings.save();
      });
    }
  };

  downloadFile = function(key) {
    return new Promise(async function(resolve, reject) {
      var dirPath, filePath, m, rs, ws;
      filePath = path.join(downloadPath, key);
      if (!(await fs.exists(filePath))) {
        dirPath = path.dirname(filePath);
        if (!(await fs.exists(dirPath))) {
          await fs.ensureDir(dirPath);
        }
        m = {
          Bucket: AWS.config.bucket,
          Key: key
        };
        rs = S3.getObject(m).createReadStream();
        ws = fs.createWriteStream(filePath);
        rs.on('error', function(e) {
          return console.log('read error', e);
        });
        rs.on('close', function() {
          return console.log('read stream closed');
        });
        ws.on('close', function() {
          console.log('write stream closed');
          return resolve();
        });
        ws.on('end', function() {
          return resolve();
        });
        ws.on('error', function() {
          return resolve();
        });
        return rs.pipe(ws);
      } else {
        return resolve();
      }
    });
  };

  checkForDownloads = async function() {
    var download, downloads, j, len1, maxDate, notification;
    console.log('check', settings.get('lastDownload'));
    downloads = (await listDownloads(settings.get('lastDownload')));
    console.log('downloads length', downloads.length);
    maxDate = new Date(0);
    for (j = 0, len1 = downloads.length; j < len1; j++) {
      download = downloads[j];
      //console.log 'downloading', download.document
      if (new Date(download.createdat) > new Date(maxDate)) {
        maxDate = download.createdat;
      }
      console.log(download.document);
      await downloadFile(download.document);
    }
    //console.log 'completed download'
    if (downloads.length > 0) {
      settings.set('lastDownload', maxDate);
      notification = new Notification({
        title: 'MIS Portal',
        body: 'New files have been downloaded'
      });
      notification.show();
    }
    settings.save();
    return webApp.listLocalFiles();
  };

  module.exports = {
    listLocalFiles: function() {
      return new Promise(function(resolve, reject) {
        var user;
        if (user = settings.get('user')) {
          return glob(uploadGlobPath, function(err, files) {
            return resolve(files.map(function(file) {
              return file.replace(uploadReplacePath, '');
            }));
          });
        } else {
          return resolve([]);
        }
      });
    },
    getLocalFolder: function() {
      return uploadPath;
    },
    checkForDownloads: function() {
      if (settings.get('autoDownload')) {
        return checkForDownloads();
      }
    },
    init: function() {
      return new Promise(async function(resolve, reject) {
        var client, clientPath, debounced, i, ref, shortcode, sundryPath, user, weekPath, yearPath;
        if (user = settings.get('user')) {
          /*
          m =
            Bucket: AWS.config.bucket
            Prefix: 'N_A/2018/01'
          S3.listObjects m, (e, r) ->
          */
          if (user.profile.type) {
            if ((user.profile.type.code === '00' || user.profile.type.code === '01') && Object.keys(user.profile.payrollClients).length > 0) {
              uploadPath = path.join(app.getPath('downloads'), 'MIS Portal Downloads');
              uploadReplacePath = (uploadPath + path.sep).replace(/\\/g, '/');
              uploadGlobPath = path.join(uploadPath, '**/*');
              //admin user
              if (settings.get('autoDownload')) {
                if (!(await fs.exists(downloadPath))) {
                  await fs.mkdir(downloadPath);
                }
                if (user.profile.payrollClients) {
                  ref = user.profile.payrollClients;
                  for (shortcode in ref) {
                    client = ref[shortcode];
                    clientPath = path.join(downloadPath, sanitizeName(client.name));
                    if (!(await fs.exists(clientPath))) {
                      await fs.mkdir(clientPath);
                    }
                  }
                  checkForDownloads();
                }
              }
            }
            //get files to download
            if (user.profile.type.code === '03') {
              uploadPath = path.join(app.getPath('documents'), 'MIS Portal Upload');
              sanitizedClientName = sanitizeName(user.profile.clientID.clientname);
              clientPath = path.join(uploadPath, sanitizedClientName);
              uploadReplacePath = (clientPath + path.sep).replace(/\\/g, '/');
              uploadGlobPath = path.join(clientPath, '**/*');
              if (settings.get('autoUpload')) {
                if (!(await fs.exists(uploadPath))) {
                  await fs.mkdir(uploadPath);
                }
                if (!(await fs.exists(clientPath))) {
                  await fs.mkdir(clientPath);
                }
                yearPath = path.join(clientPath, new Date().getFullYear().toString());
                if (!(await fs.exists(yearPath))) {
                  await fs.mkdir(yearPath);
                }
                i = 0;
                while (i++ < 53) {
                  weekPath = path.join(yearPath, pad(i));
                  if (!(await fs.exists(weekPath))) {
                    await fs.mkdir(weekPath);
                  }
                }
                sundryPath = path.join(yearPath, 'sundry');
                if (!(await fs.exists(sundryPath))) {
                  await fs.mkdir(sundryPath);
                }
                debounced = debounce(checkForChanges, 1000);
                watch(uploadPath.replace(/\\/g, '/'), debounced);
                checkForChanges();
              }
            }
          }
        }
        return resolve();
      });
    }
  };

}).call(this);

//# sourceMappingURL=file-system.js.map
