;(function(Thing, ThingDebug, ThingNoteDebug, debug, undefined) {

debug = debug || ThingDebug || ThingNoteDebug;

var me = Thing;

// "Extend" Note to Thing
var Note = function(params) {
  me.debug && this.log(' new', params);
  Thing.apply(this, arguments);
};

// Set Note's prototype to Thing's prototype
Note.prototype = Object.create(Thing.prototype);

// Set constructor back to Note
Note.prototype.constructor = Note;

// Note prototypes

Note.prototype.name = 'Thing.Note';

// Set up attrs
Note.prototype.setup = function(params) {
  //me.debug && this.log('.setup');

  this.type = 'note';

  this.attrs.push(
    {property: 'category', alias: 'c'},
    {property: 'body', alias: 'b'},
    {property: 'image', alias: 'i'},
    {property: 'deletehash', alias: 'h'} // specific to imgur images
  );
};

// Nothing yet
Note.prototype.init = function(params) {
  //me.debug && this.log('.init');
};

window.Thing.Note = Note;

})(window.Thing, window.ThingDebug, window.ThingNoteDebug, window.debug);