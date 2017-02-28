// Super watered down version of Handlebars, similar syntax

;(function(debug, undefined) {

var if_reg = /\{\{ *#if +([a-z_][a-z_0-9A-Z]*) *\}\}/g;
var else_reg = /\{\{ *else *\}\}/g;
var endif_reg = /\{\{ *\/if *\}\}/g;
var each_reg = /\{\{ *#each +([a-z_][a-z_0-9A-Z]*) *\}\}/g;
var endeach_reg = /\{\{ *\/each *\}\}/g;
var trim_reg = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
var n_reg = /\n/g;
var this_reg = /\{\{ *this *\}\}/g;
var var_filter_reg = /\{\{ *([a-z_][a-z_0-9A-Z]*) *\| *([a-z_][a-z_0-9A-Z]*) *\}\}/g;
var var_raw_reg = /\{\{\{ *([a-z_][a-z_0-9A-Z]*) *\}\}\}/g;
var var_reg = /\{\{ *([a-z_][a-z_0-9A-Z]*) *\}\}/g;

// Use filters like {{ myvar | myfilter }}
var filters = {
  html: function(str) {
    if ( !str ) {
      return '';
    }

    return ('' + str).replace(/[\u00A0-\u9999\<\>\&\'\"\\\/]/gim, function(c) {
      return '&#' + c.charCodeAt(0) + ';' ;
    });
  }
};

var autofilter = filters.html;

var apply_filter = function(name, str) {
  if ( filters[name] ) {
    return filters[name](str);
  } else {
    return str;
  }
};

var apply_auto_filter = function(str) {
  if ( autofilter ) {
    return autofilter(str);
  } else {
    return str;
  }
};

var Tpl = {
  compile: function(html) {
    if ( !html ) return function() { return ''; };

    var fn = "function(d,undefined){d=d||{};var html='";
    fn += html
      .replace(trim_reg, '')
      .replace(n_reg,       '\\\n')
      .replace(if_reg,      "';if (d.$1) {html+='")
      .replace(else_reg,    "';}else{html+='")
      .replace(endif_reg,   "';}html+='")
      .replace(each_reg,    "';for(var i=0,l=d.$1.length,v;i<l;i++){v=d.$1[i];html+='")
      .replace(endeach_reg, "';};html+='")
      .replace(this_reg,    "';html+=v;html+='")
      .replace(var_filter_reg, "';if(d.$1!==undefined){html+=apply_filter('$2', d.$1)};html+='")
      .replace(var_raw_reg,    "';if(d.$1!==undefined){html+=d.$1};html+='")
      .replace(var_reg,        "';if(d.$1!==undefined){html+=apply_auto_filter(d.$1)};html+='")
      ;
    fn += "';return html}";

    debug && console.log('Tpl.compile-fn:', fn);

    eval('var func = ' + fn);
    return func;
  },
  addFilter: function(name, fn) {
    filters[name] = fn;
  }
};

window.Tpl = Tpl;

})(window.debug);