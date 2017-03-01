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

	this.files = {};
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
			onload();
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
			onload();
		} else {
			onerror(self.errors.manual_auth);
		}
	});
};

GoogleDriveAPI.prototype._readFile = function(file, onload, onerror) {
	var self = this;
	var token = gapi.auth.getToken();

	if ( !token ) {
		this.checkAuth(function() {
			self._readFile(file, onload, onerror);
		}, onerror);
		return;
	}

	var accessToken = token.access_token;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', file.downloadUrl);
	xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

	xhr.onload = function() {
		onload(xhr.responseText);
	};

	xhr.onerror = function(resp) {
		onerror(this.errors.read_file, resp);
	};

	xhr.send();
};

GoogleDriveAPI.prototype.loadFile = function(filename, content, onload, onerror) {
	var self = this;

	if ( this.files[filename] ) {
		this._readFile(this.files[filename], onload, onerror);
		return;
	}

	gapi.client.load('drive', 'v2', function() {
		var query = "trashed=false and 'appfolder' in parents";

		var request = gapi.client.drive.files.list({
			'maxResults': 10,
			'q': query
		});

		request.execute(function (resp) {
			if (!resp.error) {
				var found = false;
				var file;

				if ( resp.items.length > 0 ) {
					for ( var i = 0; i < resp.items.length; i++ ) {
						file = resp.items[i];
						if ( resp.items[i].title !== filename ) continue;
						self.files[filename] = file;
						self._readFile(file, onload, onerror);
						found = true;
						break;
					}
				}

				if ( !found ) {
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
						if ( resp && !resp.error ) {
							self.files[filename] = resp;
							onload(content);
						} else {
							onerror(self.errors.new_file, resp);
						}
					});
				}
			} else {
				onerror(self.errors.list_files, resp);
			}
		});
	});
};

GoogleDriveAPI.prototype.updateFile = function(filename, content, onload, onerror) {
	var self = this;
	var file = this.files[filename];
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
			onload();
		}
	});
};

GoogleDriveAPI.prototype.deleteFile = function(filename, onload, onerror) {
	var self = this;
	var file = this.files[filename];
	var request = gapi.client.drive.files.delete({
		'fileId': file.id
	});

	request.execute(function(resp) {
		if (resp.error) {
			onerror(self.errors.delete_file, resp);
		} else {
			onload();
		}
	});
};

window.GoogleDriveAPI = GoogleDriveAPI;

})();
