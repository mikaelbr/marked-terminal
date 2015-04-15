
var assert = require('assert');
var Renderer = require('../');
var marked = require('marked');


var identity = function (o) {
  return o;
};

var opts = [
  'code', 'blockquote', 'html', 'heading',
  'firstHeading', 'hr', 'listitem', 'table',
  'paragraph', 'strong', 'em', 'codespan',
  'del', 'link', 'href'
];

var defaultOptions = {};
opts.forEach(function (opt) {
  defaultOptions[opt] = identity;
});

defaultOptions.emoji = false;

describe('Options', function () {
  var r = new Renderer(defaultOptions);

  it('should not translate emojis', function () {
    var markdownText = 'Some :emoji:';

    assert.notEqual(marked(markdownText, {
      renderer: r
    }).indexOf(':emoji:'), -1);
  });

});