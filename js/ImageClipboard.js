/**
 * image pasting into canvas
 * http://stackoverflow.com/questions/18377891/how-can-i-let-user-paste-image-data-from-the-clipboard-into-a-canvas-element-in
 * 
 * @param string canvas_id canvas id
 * @param boolean autoresize if canvas will be resized
 */
(function(undefined) {

var ImageClipboard = function(cb) {
  var _self = this;

  //handlers
  document.addEventListener('paste', function (e) { _self.paste_auto(e); }, false);

  //on paste
  this.paste_auto = function (e) {
    if (e.clipboardData) {
      var items = e.clipboardData.items;
      if (!items) return;
      
      //access data directly
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          //image
          e.preventDefault();
          var blob = items[i].getAsFile();
          var URLObj = window.URL || window.webkitURL;
          var source = URLObj.createObjectURL(blob);
          this.paste_createImage(source);
        }
      }
    }
  };
  //draw pasted image to canvas
  this.paste_createImage = function (source) {
    var pastedImage = new Image();

    pastedImage.onload = function () {
      if ( cb ) {
        cb(pastedImage);
      }
    };

    pastedImage.src = source;
  };
};

window.ImageClipboard = ImageClipboard;

})();