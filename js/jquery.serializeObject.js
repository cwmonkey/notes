;(function($, undefined) {

// Get form as {name: value...}
$.fn.serializeObject = function() {
  var obj = {};

  this.serializeArray().forEach(function(val) {
    obj[val.name] = val.value;
  });

  return obj;
};

})(window.jQuery);