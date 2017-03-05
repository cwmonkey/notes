;(function(Thing, ThingDebug, ThingCategoryDebug, debug, undefined) {

debug = debug || ThingDebug || ThingCategoryDebug;

// "Extend" Category to Thing
var Category = function(params) {
  debug && console.log('Category', params);
  Thing.call(this, params);
};

// Set Category's prototype to Thing's prototype
Category.prototype = Object.create(Thing.prototype);

// Set constructor back to Category
Category.prototype.constructor = Category;

// Category prototypes

// Set up attrs
Category.prototype.setup = function(params) {
  debug && console.log('Category.setup');

  this.type = 'category';

  this.attrs.push(
    {property: 'title', alias: 't'}
  );
};

// Nothing yet
Category.prototype.init = function(params) {
  debug && console.log('Category.init');
};

window.Thing.Category = Category;

})(window.Thing, window.ThingDebug, window.ThingCategoryDebug, window.debug);