
var assert = require('assert');
var assign = require('lodash.assign');
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

  it('should change tabs by space size', function () {
    var options = assign({}, defaultOptions, { tab: 4 });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote'
    assert.equal(
      marked(blockquoteText, { renderer: r }),
      '\n    Blockquote\n\n'
    );

    var listText = '* List Item'
    assert.equal(
      marked(listText, { renderer: r }),
      '\n     * List Item\n\n'
    );
  });

  it('should change tabs by allowed characters', function () {
    var options = assign({}, defaultOptions, { tab: '\t' });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote'
    assert.equal(
      marked(blockquoteText, { renderer: r }),
      '\n\tBlockquote\n\n'
    );

    var listText = '* List Item'
    assert.equal(
      marked(listText, { renderer: r }),
      '\n\t * List Item\n\n'
    );
  });

});
