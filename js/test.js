(function($, GoogleDriveAPI) {

var filename = '__newtest--data';

var gd = new GoogleDriveAPI({
	clientId: '935193854133-pt3okf2v2qo7mbds6as2l6sll7in68kb.apps.googleusercontent.com'
});

var onload = function() {
	$("#login_wrapper").hide();
	$("#gdrive_wrapper").show();

	gd.loadFile(filename, '{}', function(text) {
		console.log('File content:', text);
	}, function(error, resp) {
		console.log(error, resp);
	});
};

var onerror = function(error, resp) {
	$("#login_wrapper").show();
	$("#gdrive_wrapper").hide();

	console.log(error, resp);
};

gd.load(onload, onerror);

$(document)
	.delegate('#login', 'click', function() {
		gd.checkAuthManual(onload, onerror);
	})
	.delegate('#update', 'click', function() {
		gd.updateFile(filename, '{date: ' + Date.now() + '}', function() {
			console.log('saved!');
		}, function(error, resp) {
			console.log(error, resp);
		});
	})
	.delegate('#read', 'click', function() {
		gd.loadFile(filename, '', function(text) {
			console.log('File content:', text);
		}, function(error, resp) {
			console.log(error, resp);
		});
	})
	;


})(window.jQuery, window.GoogleDriveAPI);