;(function(Thing, ThingDebug, ThingNoteDebug, debug, undefined) {

debug = debug || ThingDebug || ThingNoteDebug;

// "Extend" Note to Thing
var Note = function(params) {
  debug && console.log('Note', params);
  Thing.call(this, params);
};

// Set Note's prototype to Thing's prototype
Note.prototype = Object.create(Thing.prototype);

// Set constructor back to Note
Note.prototype.constructor = Note;

// Note prototypes

// Set up attrs
Note.prototype.setup = function(params) {
  debug && console.log('Note.setup');

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
  debug && console.log('Note.init');
};

window.Thing.Note = Note;

})(window.Thing, window.ThingDebug, window.ThingNoteDebug, window.debug);