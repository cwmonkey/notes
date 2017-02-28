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

  this.attrs = [
    {property: 'category', alias: 'c'},
    {property: 'body', alias: 'b'},
    {property: 'image', alias: 'i'},
    // {property: 'width', alias: 'w'},
    // {property: 'height', alias: 'e'},
    {property: 'deletehash', alias: 'h'}, // specific to imgur images
    {property: 'deleted', alias: 'd'},
    {property: 'updated', alias: 'u'}
  ];
};

// Nothing yet
Note.prototype.init = function(params) {
  debug && console.log('Note.init');
};

window.Thing.Note = Note;

})(window.Thing, window.ThingDebug, window.ThingNoteDebug, window.debug);