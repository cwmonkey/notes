;(function(Thing, ThingDebug, ThingPreferenceDebug, debug, undefined) {

debug = debug || ThingDebug || ThingPreferenceDebug;

// "Extend" Preference to Preference
var Preference = function(params) {
  debug && console.log('Preference', params);
  Thing.call(this, params);
};

// Set Preference's prototype to Preference's prototype
Preference.prototype = Object.create(Thing.prototype);

// Set constructor back to Preference
Preference.prototype.constructor = Preference;

// Preference prototypes

// Set up attrs
Preference.prototype.setup = function(params) {
  debug && console.log('Preference.setup');

  this.type = 'preference';

  this.attrs.push(
    {property: 'value', alias: 'v'}
  );
};

// Nothing yet
Preference.prototype.init = function(params) {
  debug && console.log('Preference.init');
};

window.Thing.Preference = Preference;

})(window.Thing, window.ThingDebug, window.ThingPreferenceDebug, window.debug);