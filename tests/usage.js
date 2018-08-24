
var assert = require('assert');
var Renderer = require('../');
var marked = require('marked');


var identity = function (o) {
  return o;
};

function stripTermEsc(str) {
  return str.replace(/\u001b\[\d{1,2}m/g, "");
}

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

var defaultOptions2 = {};
opts.forEach(function (opt) {
  defaultOptions[opt] = identity;
});
defaultOptions2.reflowText = true;
defaultOptions2.showSectionPrefix = false;
defaultOptions2.width = 10;


defaultOptions.tableOptions = {
  chars: { 'top': '@@@@TABLE@@@@@' }
}

function markup(str, gfm) {
  gfm || (gfm = false);
  var r = new Renderer(defaultOptions2);
  var markedOptions = {
    renderer: r,
    gfm: gfm
  };
  return stripTermEsc(marked(str, markedOptions));
}

describe('Renderer', function () {
  var r = new Renderer(defaultOptions);
  var markedOptions = {
    renderer: r
  };

  it('should render links', function () {
    var text = '[Google](http://google.com)';
    var expected = 'Google (http://google.com)';
    assert.equal(marked(text, markedOptions).trim(), expected);
  });

  it('should pass on options to table', function () {
    var text = '| Lorem | Ipsum | Sit amet     | Dolar  |\n' +
    '|------|------|----------|----------|\n' +
    '| Row 1  | Value    | Value  | Value |\n' +
    '| Row 2  | Value    | Value  | Value |\n' +
    '| Row 3  | Value    | Value  | Value |\n' +
    '| Row 4  | Value    | Value  | Value |';

    assert.notEqual(marked(text, markedOptions).indexOf('@@@@TABLE@@@@@'), -1);
  });

  it('should not show link href twice if link and url is equal', function () {
    var text = 'http://google.com';
    assert.equal(marked(text, markedOptions).trim(), text);
  });

  it('should render html as html', function () {
    var html = '<strong>foo</strong>';
    assert.equal(marked(html, markedOptions).trim(), html);
  });

  it('should not escape entities', function () {
    var text = '# This < is "foo". it\'s a & string\n' +
      '> This < is "foo". it\'s a & string\n\n' +
      'This < is **"foo"**. it\'s a & string\n' +
      'This < is "foo". it\'s a & string';

    var expected = '# This < is "foo". it\'s a & string\n\n' +
      '    This < is "foo". it\'s a & string\n\n' +
      'This < is "foo". it\'s a & string\n' +
      'This < is "foo". it\'s a & string';
    assert.equal(marked(text, markedOptions).trim(), expected);
  });

  it('should not translate emojis inside codespans', function () {
    var markdownText = 'Some `:+1:`';

    assert.notEqual(marked(markdownText, markedOptions).indexOf(':+1:'), -1);
  });

  it('should translate emojis', function () {
    var markdownText = 'Some :+1:';
    assert.equal(marked(markdownText, markedOptions).indexOf(':+1'), -1);
  });

  it('should show default if not supported emojis', function () {
    var markdownText = 'Some :someundefined:';
    assert.notEqual(marked(markdownText, markedOptions).indexOf(':someundefined:'), -1);
  });

  it('should not escape entities', function () {
    var markdownText = 'Usage | Syntax' + '\r\n' +
    '------|-------' + '\r\n' +
    'General |`$ shell <CommandParam>`';

    assert.notEqual(marked(markdownText, markedOptions).indexOf('<CommandParam>'), -1);
  });

  it('should reflow paragraph and split words that are too long (one break)', function () {
    text = 'Now is the time: 01234567890\n',
    expected = 'Now is the\ntime: 0123\n4567890\n\n';
    assert.equal(markup(text), expected);
  });

  it('should reflow paragraph and split words that are too long (two breaks)', function () {
    text = 'Now is the time: http://timeanddate.com\n',
    expected = 'Now is the\ntime: http\n://timeand\ndate.com\n\n';
    assert.equal(markup(text), expected);
  });

  it('should reflow paragraph', function () {
    text = 'Now is the time\n',
    expected = 'Now is the\ntime\n\n';
    assert.equal(markup(text), expected);
  });

  it('should nuke section header', function () {
    text = '# Contents\n',
    expected = 'Contents\n\n';
    assert.equal(markup(text), expected);
  });

  it('should reflow and nuke section header', function () {
    text = '# Now is the time\n',
    expected = 'Now is the\ntime\n\n';
    assert.equal(markup(text), expected);
  });

  it('should preserve line breaks (non gfm)', function () {
    text = 'Now  \nis    \nthe<br />time\n',
    expected = 'Now\nis\nthe<br\n/>time\n\n';
    assert.equal(markup(text, false), expected);
  });

  it('should preserve line breaks (gfm)', function () {
    text = 'Now  \nis    \nthe<br />time\n',
    expected = 'Now\nis\nthe\ntime\n\n';
    assert.equal(markup(text, true), expected);
  });

  it('should render ordered and unordered list with same newlines', function () {
    var ul = '* ul item\n' +
    '* ul item';
    var ol = '1. ol item\n' +
    '2. ol item';
    var before = '';
    var after = '\n\n';

    assert.equal(markup(ul),
      before +
      '    * ul item\n' +
      '    * ul item' +
      after
    );

    assert.equal(markup(ol),
      before +
      '    1. ol item\n' +
      '    2. ol item' +
      after
    );
  });

  it('should render nested lists', function () {
    var ul = '* ul item\n' +
    '    * ul item';
    var ol = '1. ol item\n' +
    '    1. ol item';
    var olul = '1. ol item\n' +
    '    * ul item';
    var ulol = '* ul item\n' +
    '    1. ol item';
    var before = '';
    var after = '\n\n';

    assert.equal(markup(ul),
      before +
      '    * ul item\n' +
      '        * ul item' +
      after
    );

    assert.equal(markup(ol),
      before +
      '    1. ol item\n' +
      '        1. ol item' +
      after
    );

    assert.equal(markup(olul),
      before +
      '    1. ol item\n' +
      '        * ul item' +
      after
    );

    assert.equal(markup(ulol),
      before +
      '    * ul item\n' +
      '        1. ol item' +
      after
    );
  });

  it('should render task items', function () {
    var tasks = '* [ ] task item\n' +
    '* [X] task item';
    var before = '';
    var after = '\n\n';

    assert.equal(markup(tasks),
      before +
      '    * [ ] task item\n' +
      '    * [X] task item' +
      after
    );
  });

});
