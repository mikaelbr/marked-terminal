import { notEqual, equal } from 'assert';
import Renderer from '../index.js';
import marked from './_marked.js';

var identity = function (o) {
  return o;
};

var opts = [
  'code',
  'blockquote',
  'html',
  'heading',
  'firstHeading',
  'hr',
  'listitem',
  'table',
  'paragraph',
  'strong',
  'em',
  'codespan',
  'del',
  'link',
  'href'
];

var defaultOptions = {};
opts.forEach(function (opt) {
  defaultOptions[opt] = identity;
});

defaultOptions.emoji = false;

describe('Options', function () {
  var r = new Renderer(defaultOptions);

  it('should not translate emojis', function () {
    var markdownText = 'Some :emoji:';

    notEqual(
      marked(markdownText, {
        renderer: r
      }).indexOf(':emoji:'),
      -1
    );
  });

  it('should change tabs by space size', function () {
    var options = Object.assign({}, defaultOptions, { tab: 4 });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote';
    equal(marked(blockquoteText, { renderer: r }), '    Blockquote\n\n');

    var listText = '* List Item';
    equal(marked(listText, { renderer: r }), '    * List Item\n\n');
  });

  it('should use default tabs if passing not supported string', function () {
    var options = Object.assign({}, defaultOptions, { tab: 'dsakdskajhdsa' });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote';
    equal(marked(blockquoteText, { renderer: r }), '    Blockquote\n\n');

    var listText = '* List Item';
    equal(marked(listText, { renderer: r }), '    * List Item\n\n');
  });

  it('should change tabs by allowed characters', function () {
    var options = Object.assign({}, defaultOptions, { tab: '\t' });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote';
    equal(marked(blockquoteText, { renderer: r }), '\tBlockquote\n\n');

    var listText = '* List Item';
    equal(marked(listText, { renderer: r }), '\t* List Item\n\n');
  });

  it('should support mulitple tab characters', function () {
    var options = Object.assign({}, defaultOptions, { tab: '\t\t' });
    var r = new Renderer(options);

    var blockquoteText = '> Blockquote';
    equal(marked(blockquoteText, { renderer: r }), '\t\tBlockquote\n\n');

    var listText = '* List Item';
    equal(marked(listText, { renderer: r }), '\t\t* List Item\n\n');
  });

  it('should support overriding image handling', function () {
    var options = Object.assign({}, defaultOptions, {
      image: function () {
        return 'IMAGE';
      }
    });
    var r = new Renderer(options);

    var text = `
# Title
![Alt text](./img.jpg)`;
    equal(
      marked(text, { renderer: r }),
      `# Title

IMAGE

`
    );
  });
});
