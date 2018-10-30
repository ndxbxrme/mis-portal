(function() {
  'use strict';
  var app, appKey, dotty, e, fs, load, loaded, path, portalKey, portalUrl, save, settings, settingsPath;

  ({app} = require('electron'));

  path = require('path');

  dotty = require('dotty');

  fs = require('fs-extra');

  portalKey = process.env.MIS_PORTAL_KEY;

  appKey = {};

  try {
    appKey = JSON.parse(new Buffer(portalKey, 'base64').toString('binary'));
  } catch (error) {
    e = error;
  }

  settings = {
    mainWindow: {
      width: 1280,
      height: 800
    },
    autoDownload: true,
    autoUpload: true
  };

  settingsPath = path.join(app.getPath('userData'), 'settings.json');

  loaded = false;

  portalUrl = '';

  load = function() {
    return new Promise(async function(resolve, reject) {
      var exists;
      exists = (await fs.exists(settingsPath));
      if (exists) {
        settings = JSON.parse((await fs.readFile(settingsPath, 'utf8')));
        loaded = true;
        return resolve();
      } else {
        await save();
        loaded = true;
        return resolve();
      }
    });
  };

  save = function() {
    return fs.writeFile(settingsPath, JSON.stringify(settings), 'utf8');
  };

  module.exports = {
    badKey: function() {
      return Object.keys(appKey).length < 1;
    },
    load: load,
    save: save,
    get: function(key) {
      return dotty.get(settings, key);
    },
    set: function(key, value) {
      return dotty.put(settings, key, value);
    },
    loaded: function() {
      return loaded;
    },
    portalUrl: function(url) {
      return appKey.url;
    },
    aws: function(field) {
      return appKey[field];
    },
    userIsAdmin: function() {
      var user;
      user = dotty.get(settings, 'user');
      if (user) {
        return user.profile.type.code === '00' || user.profile.type.code === '01';
      }
      return false;
    },
    userIsClientMaster: function() {
      var user;
      user = dotty.get(settings, 'user');
      if (user) {
        return user.profile.type.code === '03';
      }
      return false;
    }
  };

}).call(this);

//# sourceMappingURL=settings.js.map
