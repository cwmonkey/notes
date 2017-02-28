/*
--------------------------------
imgur Upload
--------------------------------
+ https://github.com/pinceladasdaweb/imgur-upload
+ version 1.1
+ Copyright 2014 Pedro Rogerio
+ Licensed under the MIT license

+ Documentation: https://github.com/pinceladasdaweb/imgur-upload
*/

(function(undefined) {
"use strict";

var xhr = function () {
  return new XMLHttpRequest();
};

var Imgur = function (id) {
  this.id = id;
};

Imgur.prototype.upload = function(file, cb) {
  var xhttp = xhr();
  var fd    = new FormData();

  fd.append('image', file);
  xhttp.open('POST', 'https://api.imgur.com/3/image');
  xhttp.setRequestHeader('Authorization', 'Client-ID ' + this.id); //Get yout Client ID here: http://api.imgur.com/
  xhttp.onreadystatechange = function () {
    if ( xhttp.status === 200 && xhttp.readyState === 4 ) {
      var res = JSON.parse(xhttp.responseText);

      if ( cb ) {
        cb(res);
      }
    }
  };

  xhttp.send(fd);
};

Imgur.prototype.delete = function(deletehash) {
  var xhttp  = xhr();

  xhttp.open('DELETE', 'https://api.imgur.com/3/image/' + deletehash);
  xhttp.setRequestHeader('Authorization', 'Client-ID ' + this.id); //Get yout Client ID here: http://api.imgur.com/
  xhttp.send();
};

window.Imgur = Imgur;

})();