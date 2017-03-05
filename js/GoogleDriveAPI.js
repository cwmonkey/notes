(function(GoogleDriveAPIDebug, debug) {

var src = 'https://apis.google.com/js/client.js?onload=';

var GoogleDriveAPI = function(params) {
  this.clientId = params.clientId;

  if ( !this.clientId ) {
    throw new Error('GoogleDriveAPI: clientId is required');
  }

  this.scriptTimeout = params.scriptTimeout || 1000;
  this.scopes = params.scopes || ['https://www.googleapis.com/auth/drive.appfolder'];
  if ( typeof this.scopes !== 'string' ) {
    this.scopes = this.scopes.join(' ');
  }
};

var me = GoogleDriveAPI;

// Debugging
me.debug = GoogleDriveAPIDebug || debug;

var debug_icon = String.fromCodePoint(128191);
var debug_name = '%cGoogle%cDrive%cAPI';
var debug_styles = {
  nameStart: 'background:#fff;color:#da3325', //#ea4335
  nameMiddle: 'background:#fff;color:#db9c05', //#fbbc05
  nameEnd: 'background:#fff;color:#249843', //#34a853
  method: 'background:#fff;color: #3275e4' //#4285f4
};

var debug_prepend = [debug_icon + ' ' + debug_name + '%c', debug_styles.nameStart, debug_styles.nameMiddle, debug_styles.nameEnd, debug_styles.method];

me.debug = debug || notesDebug;

me._print = function(cmd, args) {
  args = Array.prototype.slice.call(args);
  var arg1 = args.shift();
  args.unshift.apply(args, debug_prepend);
  args[0] = args[0] + arg1;
  console[cmd].apply(console, args);
};

me.log = function() {
  me._print.call(this, 'log', arguments);
};

me.trace = function() {
  me._print.call(this, 'trace', arguments);
};

// Prototypes

GoogleDriveAPI.prototype.errors = {
  manual_auth: {type: 'manual_auth', message: 'Manual authentication failed'},
  immediate_auth: {type: 'immediate_auth', message: 'Immediate authentication failed'},
  new_file: {type: 'new_file', message: 'Could not create new file'},
  update_file: {type: 'update_file', message: 'Could not update file'},
  read_file: {type: 'read_file', message: 'Could not read file contents'},
  delete_file: {type: 'delete_file', message: 'Could not delete file'},
  list_files: {type: 'list_files', message: 'Could not list files'}
};

GoogleDriveAPI.prototype.load = function(onload, onerror) {
  me.debug && me.log('.load');
  var self = this;
  var fn_name = '__GoogleDriveAPI_handleClientLoaded' + Date.now();
  var el = document.createElement('script');
  el.setAttribute('type', 'text/javascript');
  el.setAttribute('src', src + fn_name);

  window[fn_name] = function() {
    me.debug && me.log('.load', 'script loaded');
    self.checkAuth(onload, onerror);
  };

  el.onerror = function() {
    me.debug && me.log('.load', 'script load error');
    setTimeout(function() {
      self.loadScript(onload, onerror);
    }, self.scriptTimeout);
  };

  document.getElementsByTagName('head')[0].appendChild(el);
};

GoogleDriveAPI.prototype.checkAuth = function(onload, onerror) {
  me.debug && me.log('.checkAuth');
  var self = this;

  gapi.auth.authorize({
    'client_id': self.clientId,
    'scope': self.scopes,
    'immediate': true
  }, function(auth_result) {
    me.debug && me.log('.checkAuth', auth_result);

    if (auth_result && !auth_result.error) {
      me.debug && me.log('.checkAuth', 'success');
      gapi.client.load('drive', 'v3', function() {
        me.debug && me.log('.checkAuth', 'client loaded');
        // TODO: error checking?
        onload();
      });
    } else {
      me.debug && me.log('.checkAuth', 'failed');
      onerror(self.errors.immediate_auth);
    }
  });
};

GoogleDriveAPI.prototype.checkAuthManual = function(onload, onerror) {
  me.debug && me.log('.checkAuthManual');
  var self = this;

  gapi.auth.authorize({
    'client_id': self.clientId,
    'scope': self.scopes,
    'immediate': false
  }, function(auth_result) {
    me.debug && me.log('.checkAuthManual', auth_result);

    if (auth_result && !auth_result.error) {
      me.debug && me.log('.checkAuthManual', 'success');
      gapi.client.load('drive', 'v3', function() {
        me.debug && me.log('.checkAuthManual', 'client loaded');
        // TODO: error checking?
        onload();
      });
    } else {
      me.debug && me.log('.checkAuthManual', 'failed');
      onerror(self.errors.manual_auth);
    }
  });
};

GoogleDriveAPI.prototype.getFile = function(file, onload, onerror) {
  me.debug && me.log('.getFile', file);
  var self = this;

  var request = gapi.client.drive.files.get({
    fileId: file.id,
    alt: 'media'
  });

  request.execute(function (resp) {
    me.debug && me.log('.getFile', resp);
    if ( resp.error ) {
      me.debug && me.log('.getFile', 'failed');
      onerror(self.errors.read_file, resp);
    } else {
      me.debug && me.log('.getFile', 'success');
      onload(resp);
    }
  });
};

GoogleDriveAPI.prototype.loadAllFiles = function(onload, onerror, page_token) {
  me.debug && me.log('.loadAllFiles', page_token);
  var self = this;
  var request;

  if ( page_token ) {
    request = gapi.client.drive.files.list({
      'pageToken': page_token
    });
  } else {
    request = gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      fields: 'nextPageToken, files(id, name, modifiedTime, webContentLink)',
      pageSize: 1000,
      orderBy: 'name'
    });
  }

  request.execute(function (resp) {
    me.debug && me.log('.loadAllFiles', resp);
    if ( !resp || resp.error) {
      me.debug && me.log('.loadAllFiles', 'failed');
      onerror(self.errors.list_files, resp);
      return;
    }

    me.debug && me.log('.loadAllFiles', 'success');
    var page_token = resp.nextPageToken;
    var found = false;
    var file;
    var files = {};

    if ( resp.files.length > 0 ) {
      for ( var i = 0; (file = resp.files[i]); i++ ) {
        files[file.id] = file;
      }
    }

    if ( page_token ) {
      // recursion
      self._loadAllFiles(onload, onerror, page_token);
      onload(files);
    } else {
      onload(files, true);
    }

  });
};

// TODO: DRY
GoogleDriveAPI.prototype.addFile = function(filename, content, onload, onerror) {
  me.debug && me.log('.addFile', filename, content);
  var self = this;
  var boundary = '-------314159265358979323846264';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";

  var contentType = 'text/plain';
  var metadata = {
    'title': filename,
    'mimeType': contentType,
    'parents': [{'id': 'appfolder'}]
  };

  var base64Data = btoa(content);
  var multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    close_delim;

  var request = gapi.client.request({
    'path': '/upload/drive/v2/files',
    'method': 'POST',
    'params': {
      uploadType: 'multipart'
    },
    'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody
  });

  request.execute(function(resp) {
    me.debug && me.log('.addFile', resp);
    if ( !resp || resp.error ) {
      me.debug && me.log('.addFile', 'failed');
      onerror(self.errors.new_file, resp);
    } else {
      me.debug && me.log('.addFile', 'success');
      onload(resp);
    }
  });
};

// TODO: DRY
GoogleDriveAPI.prototype.updateFile = function(file, content, onload, onerror) {
  me.debug && me.log('.updateFile', file, content);

  var self = this;
  var boundary = '-------314159265358979323846';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";

  var contentType = 'text/plain';
  var base64Data = btoa(content);
  var multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(file) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    close_delim;

  // TODO: v3
  var request = gapi.client.request({
    'path': '/upload/drive/v2/files/' + file.id,
    'method': 'PUT',
    'params': {
      uploadType: 'multipart',
      alt: 'json'
    },
    'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody
  });

  request.execute(function(resp) {
    me.debug && me.log('.updateFile', resp);
    if ( !resp || resp.error ) {
      me.debug && me.log('.updateFile', 'failed');
      onerror(self.errors.update_file, resp);
    } else {
      me.debug && me.log('.updateFile', 'success');
      onload(resp);
    }
  });
};

GoogleDriveAPI.prototype.deleteFile = function(file, onload, onerror) {
  me.debug && me.log('.deleteFile', file);
  var self = this;
  var request = gapi.client.drive.files.delete({
    'fileId': file.id
  });

  request.execute(function(resp) {
    me.debug && me.log('.deleteFile', resp);
    if ( !resp || resp.error ) {
      me.debug && me.log('.deleteFile', 'failed');
      onerror(self.errors.delete_file, resp);
    } else {
      me.debug && me.log('.deleteFile', 'success');
      onload(resp);
    }
  });
};

window.GoogleDriveAPI = GoogleDriveAPI;

})(window.GoogleDriveAPIDebug, window.debug);
