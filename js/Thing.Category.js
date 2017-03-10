;(function(Thing, ThingDebug, ThingCategoryDebug, debug, undefined) {

var me = Thing;

// "Extend" Category to Thing
var Category = function(params) {
  me.debug && this.log(' new', params);
  Thing.apply(this, arguments);
};

// Set Category's prototype to Thing's prototype
Category.prototype = Object.create(Thing.prototype);

// Set constructor back to Category
Category.prototype.constructor = Category;

// Category prototypes

Category.prototype.name = 'Thing.Category';

// Set up attrs
Category.prototype.setup = function(params) {
  //me.debug && this.log('.setup');

  this.type = 'category';

  this.attrs.push(
    {property: 'title', alias: 't'},
    {property: 'todo', alias: 'l'},
    {property: 'nodelete', alias: 'n'}
  );
};

// Nothing yet
Category.prototype.init = function(params) {
  //me.debug && this.log('.init');
};

window.Thing.Category = Category;

})(window.Thing, window.ThingDebug, window.ThingCategoryDebug, window.debug);