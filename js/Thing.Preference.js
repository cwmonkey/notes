;(function(Thing, ThingDebug, ThingPreferenceDebug, debug, undefined) {

var me = Thing;

// "Extend" Preference to Preference
var Preference = function(params) {
  me.debug && this.log(' new', params);
  Thing.apply(this, arguments);
};

// Set Preference's prototype to Preference's prototype
Preference.prototype = Object.create(Thing.prototype);

// Set constructor back to Preference
Preference.prototype.constructor = Preference;

// Preference prototypes

Preference.prototype.name = 'Thing.Preference';

// Set up attrs
Preference.prototype.setup = function(params) {
  //me.debug && this.log('.setup');

  this.type = 'preference';

  this.attrs.push(
    {property: 'value', alias: 'v'}
  );
};

// Nothing yet
Preference.prototype.init = function(params) {
  //me.debug && this.log('.init');
};

window.Thing.Preference = Preference;

})(window.Thing, window.ThingDebug, window.ThingPreferenceDebug, window.debug);