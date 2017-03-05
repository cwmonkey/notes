(function() {

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
	var self = this;
	var fn_name = '__GoogleDriveAPI_handleClientLoaded' + Date.now();
	var el = document.createElement('script');
	el.setAttribute('type', 'text/javascript');
	el.setAttribute('src', src + fn_name);

	window[fn_name] = function() {
		self.checkAuth(onload, onerror);
	};

	el.onerror = function() {
		setTimeout(function() {
			self.loadScript(onload, onerror);
		}, self.scriptTimeout);

		// onerror(self.errors.script_error);
	};

	document.getElementsByTagName('head')[0].appendChild(el);
};

GoogleDriveAPI.prototype.checkAuth = function(onload, onerror) {
	var self = this;

	gapi.auth.authorize({
		'client_id': self.clientId,
		'scope': self.scopes,
		'immediate': true
	}, function(auth_result) {
		console.log(auth_result);

		if (auth_result && !auth_result.error) {
			gapi.client.load('drive', 'v3', function() {
				// TODO: error checking?
				onload();
			});
		} else {
			onerror(self.errors.immediate_auth);
		}
	});
};

GoogleDriveAPI.prototype.checkAuthManual = function(onload, onerror) {
	var self = this;

	gapi.auth.authorize({
		'client_id': self.clientId,
		'scope': self.scopes,
		'immediate': false
	}, function(auth_result) {
		console.log(auth_result);
		if (auth_result && !auth_result.error) {
			gapi.client.load('drive', 'v3', function() {
				// TODO: error checking?
				onload();
			});
		} else {
			onerror(self.errors.manual_auth);
		}
	});
};

GoogleDriveAPI.prototype.getFile = function(file, onload, onerror) {
	var self = this;

	var request = gapi.client.drive.files.get({
		fileId: file.id,
		alt: 'media'
	});

	request.execute(function (resp) {
		if ( resp.error ) {
			onerror(self.errors.read_file, resp);
		} else {
			onload(resp);
		}
	});
};

GoogleDriveAPI.prototype.loadAllFiles = function(onload, onerror, page_token) {
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
		if ( !resp || resp.error) {
			onerror(self.errors.list_files, resp);
			return;
		}

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

GoogleDriveAPI.prototype.addFile = function(filename, content, onload, onerror) {
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
		if ( !resp || resp.error ) {
			onerror(self.errors.new_file, resp);
		} else {
			onload(resp);
		}
	});
};

GoogleDriveAPI.prototype.updateFile = function(file, content, onload, onerror) {
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
		if ( !resp || resp.error ) {
			onerror(self.errors.update_file, resp);
		} else {
			onload(resp);
		}
	});
};

GoogleDriveAPI.prototype.deleteFile = function(file, onload, onerror) {
	var self = this;
	var request = gapi.client.drive.files.delete({
		'fileId': file.id
	});

	request.execute(function(resp) {
		if ( !resp || resp.error ) {
			onerror(self.errors.delete_file, resp);
		} else {
			onload(resp);
		}
	});
};

window.GoogleDriveAPI = GoogleDriveAPI;

})();
