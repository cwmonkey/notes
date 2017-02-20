(function(debug, undefined) {

var Note = function(params, note_tpl, md) {
  debug && console.log('Note');
  this.note_tpl = note_tpl;
  this.md = md;

  this.init(params);
};

Note.prototype.init = function(params) {
  debug && console.log('Note.init');
  var self = this;

  this.editing = false;

  this.attrs = [
    {p: 'section', s: 's'},
    {p: 'body', s: 'b'},
    {p: 'deleted', s: 'd'},
    {p: 'updated', s: 'u'}
  ];

  this.attrs.forEach(function(val) {
    self[val.p] = params[val.p] || params[val.s] || undefined;
  });

  this.id = params.id;

  if ( !this.id ) {
    this.id = Date.now().toString(36);
  }

  this.md_body = this.md(this.body);

  this.$el = $(this.note_tpl(this).trim());
  this.$el.data('__notes-object', this);
};

Note.prototype.update = function(name, value, ignore) {
  debug && console.log('Note.update');
  if ( this[name] !== value ) {
    this[name] = value;
    this.updated = Date.now().toString(36);
  }
};

Note.prototype.save = function(params) {
  debug && console.log('Note.save');
  this.editing = false;
  var self = this;
  var modified = false;

  params.forEach(function(val) {
    var value = val.value || undefined;

    if ( value !== self[val.name] ) {
      self[val.name] = value;
      modified = true;
    }
  });

  if ( modified ) {
    this.updated = Date.now().toString(36);
  }

  if ( ignore_next_update === this.id ) {
    ignore_next_update = null;
  } else {
    this.$el
      .find('.__notes--body').html(this.md(this.body)).end()
      ;
  }

  if ( this.deleted ) {
    this.del();
  }
};

// TODO delete flag
Note.prototype.del = function() {
  debug && console.log('Note.del');
  if ( confirm('Wanna delete?') ) {
    var del_params = [];
    this.attrs.forEach(function(val) {
      del_params.push({name: val.p, value: undefined});
    });

    this.save(del_params, null, true);

    this.update('deleted', 1);

    return true;
  }

  return false;
};

Note.prototype.export = function() {
  debug && console.log('Note.export');
  var ret = {};
  var self = this;

  this.attrs.forEach(function(val) {
    if ( self[val.p] !== undefined ) {
      ret[val.s] = self[val.p];
    }
  });

  return ret;
};

window.Note = Note;

})(window.debug);