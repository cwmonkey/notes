// Requires GoogleDriveSaver
// //cwmonkey.github.io/js/GoogleDriveSaver.js

(function(debug) {

  /////////////////////////////
 // GDSaver
/////////////////////////////

var GDSaver = function(gd, gd_auth_name, name, limit) {
  this.gd = gd;
  this.gd_auth_name = gd_auth_name;
  this.name = name;
  this.limit = limit || 30 * 1000;
  this.lastSavedName = '__GDSaver_' + name + '_last_saved';
  this.savingName = '__GDSaver_' + name + '_saving';
  localStorage.removeItem(this.savingName);
};

GDSaver.prototype.save = function(data) {
  debug && console.log('GDSaver.save', this.name, data);
  var self = this;
  data = data || self.data || {};

  if ( localStorage.getItem(this.gd_auth_name) ) {
    debug && console.log('GDSaver.save', this.name, 'trying to save to google drive');
    var gd_last_saved = parseInt(localStorage.getItem(self.lastSavedName));
    var gd_saving = parseInt(localStorage.getItem(self.savingName));

    // See if we are already saving
    if ( !gd_saving ) {
      // Make sure we don't spam
      if ( !gd_last_saved || (Date.now() - gd_last_saved > self.limit) ) {
        localStorage.setItem(self.savingName, 1);

        this.gd.save(this.name, data)
          .then(function() {
            debug && console.log('GDSaver.save', self.name, 'then');
            localStorage.removeItem(self.savingName);
            localStorage.setItem(self.lastSavedName, Date.now());
          })
          .catch(function(reason) {
            debug && console.log('GDSaver.save', self.name, 'catch', reason);
          });
      } else {
        // try again later
        this.data = data;
        setTimeout(self.save, Date.now() - gd_last_saved - self.limit);
        debug && console.log('GDSaver.save', this.name, 'too soon');
      }
    } else {
      debug && console.log('GDSaver.save', this.name, 'already saving');
    }
  } else {
    debug && console.log('GDSaver.save', this.name, 'no gd_auth_name');
  }
};

  /////////////////////////////
 // Google Drive Loader
/////////////////////////////

var GDLoader = function(gd, name, limit, cb) {
  debug && console.log('GDLoader', name, limit, cb);

  this.gd = gd;
  this.name = name;
  this.limit = limit;
  this.cb = cb;
  this.lastLoadName = '__GDLoader_' + name + '_last_loaded';
  this.loadingName = '__GDLoader_' + name + '_loading';
  this.loadingStartedName = '__GDLoader_' + name + '_loading_started';
  // In case loading gets stuck or the browser is closed while loading, etc
  this.loadingStartedTimeout = 60 * 1000;
  this.timeout = null;
};

GDLoader.prototype.setTimeout = function() {
  debug && console.log('GDLoader.setTimeout', this.name);
  var self = this;

  if ( !this.limit ) {
    return;
  }

  this.clearTimeout();
  this.timeout = setTimeout(function() {
    self.tryLoad();
  }, this.limit + 100);
};

GDLoader.prototype.clearTimeout = function() {
  debug && console.log('GDLoader.clearTimeout', this.name);
  clearTimeout(this.timeout);
};

GDLoader.prototype.tryLoad = function(force) {
  debug && console.log('GDLoader.tryLoad', this.name);
  var last_load = parseInt(localStorage.getItem(this.lastLoadName));
  var loading = parseInt(localStorage.getItem(this.loadingName));

  if ( loading ) {
    var loading_started = parseInt(localStorage.getItem(this.loadingStartedName));

    if ( !loading_started || Date.now() - loading_started > this.loadingStartedTimeout ) {
      loading = false;
    }
  }

  if (
    force ||
    (
      !loading &&
      (!last_load || (last_load && Date.now() - last_load > this.limit) )
    )
  ) {
    return this.load();
  } else {
    return Promise.reject('GDLoader.tryLoad, too soon', this.name, loading, last_load, (last_load && Date.now() - last_load > this.limit));
  }
};

GDLoader.prototype.load = function() {
  debug && console.log('GDLoader.load', this.name);
  var self = this;

  localStorage.setItem(this.loadingName, 1);

  return new Promise(function(resolve, reject) {
    self.gd.load(self.name)
      .then(function(data) {
        debug && console.log('GDLoader.load then', self.name, data);
        var ldata = localStorage.getItem(self.name);

        if ( self.cb && ldata !== data ) {
          self.cb(data);
        }

        /*if ( data !== localStorage.getItem(self.name) ) {
          gdsaver_notes.save();
        }*/

        localStorage.setItem(self.lastLoadName, Date.now());
        self.setTimeout();
        localStorage.removeItem(self.loadingName);
        resolve(data);
      })
      .catch(function(reason) {
        debug && console.log('GDLoader.load catch', self.name, reason);
        self.setTimeout();
        reject('load failed');
      });
  });
};

window.GDSaver = GDSaver;
window.GDLoader = GDLoader;

})(window.debug);