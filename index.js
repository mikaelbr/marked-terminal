"use strict";

var chalk = require('chalk');
var Table = require('cli-table');
var assign = require('lodash.assign');
var cardinal = require('cardinal');
var emoji = require('node-emoji');


var TABLE_CELL_SPLIT = '^*||*^';
var TABLE_ROW_WRAP = '*|*|*|*';
var TABLE_ROW_WRAP_REGEXP = new RegExp(escapeRegExp(TABLE_ROW_WRAP), 'g');

var COLON_REPLACER = '*#COLON|*';
var COLON_REPLACER_REGEXP = new RegExp(escapeRegExp(COLON_REPLACER), 'g');

var defaultOptions = {
  code: chalk.yellow,
  blockquote: chalk.gray.italic,
  html: chalk.gray,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.underline.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  table: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue,
  href: chalk.blue.underline,
  unescape: true,
  emoji: true,
  tableOptions: {}
};

function Renderer(options, highlightOptions) {
  this.o = assign({}, defaultOptions, options);
  this.tableSettings = this.o.tableOptions;
  this.emoji = this.o.emoji ? insertEmojis : identity;
  this.unescape = this.o.unescape ? unescapeEntities : identity;
  this.highlightOptions = highlightOptions || {};

  this.transform = compose(undoColon, this.unescape, this.emoji);
}

Renderer.prototype.code = function(code, lang, escaped) {
  return '\n' + indentify(highlight(code, lang, this.o.code, this.highlightOptions)) + '\n\n';
};

Renderer.prototype.blockquote = function(quote) {
  return '\n' + this.o.blockquote(indentify(quote.trim())) + '\n\n';
};

Renderer.prototype.html = function(html) {
  return this.o.html(html);
};

Renderer.prototype.heading = function(text, level, raw) {
  text = this.transform(text);

  var prefix = (new Array(level + 1)).join('#');
  if (level === 1) {
    return this.o.firstHeading(prefix + ' ' + text) + '\n';
  }
  return this.o.heading(prefix + ' ' + text) + '\n';
};

Renderer.prototype.hr = function() {
  return this.o.hr(hr('-')) + '\n';
};

Renderer.prototype.list = function(body, ordered) {
  body = indentLines(this.o.listitem(body));
  if (!ordered) return body;
  return changeToOrdered(body);
};

Renderer.prototype.listitem = function(text) {
  var isNested = ~text.indexOf('\n');
  if (isNested) text = text.trim();
  return '\n * ' + this.transform(text);
};

Renderer.prototype.paragraph = function(text) {
  var transform = compose(this.o.paragraph, this.transform);
  return transform(text) + '\n\n';
};

Renderer.prototype.table = function(header, body) {
  var table = new Table(assign({}, {
      head: generateTableRow(header)[0]
  }, this.tableSettings));

  generateTableRow(body, this.transform).forEach(function (row) {
    table.push(row);
  });
  return this.o.table(table.toString()) + '\n\n';
};

Renderer.prototype.tablerow = function(content) {
  return TABLE_ROW_WRAP + content + TABLE_ROW_WRAP + '\n';
};

Renderer.prototype.tablecell = function(content, flags) {
  return content + TABLE_CELL_SPLIT;
};

// span level renderer
Renderer.prototype.strong = function(text) {
  return this.o.strong(text);
};

Renderer.prototype.em = function(text) {
  return this.o.em(text);
};

Renderer.prototype.codespan = function(text) {
  return this.o.codespan(text.replace(/:/g, COLON_REPLACER));
};

Renderer.prototype.br = function() {
  return '\n';
};

Renderer.prototype.del = function(text) {
  return this.o.del(text);
};

Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0) {
      return '';
    }
  }

  var hasText = text && text !== href;

  var out = '';
  if (hasText) out += this.emoji(text) + ' (';
  out +=  this.o.href(href);
  if (hasText) out += ')';

  return this.o.link(out);
};

Renderer.prototype.image = function(href, title, text) {
  var out = '!['+text;
  if (title) out += ' – ' + title;
  return out + '](' + href + ')\n';
};

module.exports = Renderer;

function indentLines (text) {
  return text.replace(/\n/g, '\n' + tab()) + '\n\n';
}

function changeToOrdered(text) {
  var i = 1;
  return text.split('\n').reduce(function (acc, line) {
    if (!line) return '\n' + acc;
    return acc + line.replace(/(\s*)\*/, '$1' + (i++) + '.') + '\n';
  });
}

function highlight(code, lang, style, opts) {
  if (lang !== 'javascript' && lang !== 'js') {
    return style(code);
  }

  try {
    return cardinal.highlight(code, opts);
  } catch (e) {
    return style(code);
  }
}

function insertEmojis(text) {
  return text.replace(/:([A-Za-z0-9_\-\+]+?):/g, function (emojiString) {
    return emoji.get(emojiString) + ' ';
  });
}

function hr(inputHrStr) {
  return (new Array(process.stdout.columns)).join(inputHrStr);
}

function tab(size) {
  size = size || 4;
  return (new Array(size)).join(' ');
}

function undoColon (str) {
  return str.replace(COLON_REPLACER_REGEXP, ':');
}

function indentify(text) {
  if (!text) return text;
  return tab() + text.split('\n').join('\n' + tab());
}

function generateTableRow(text, escape) {
  if (!text) return [];
  escape = escape || identity;
  var lines = escape(text).split('\n');

  var data = [];
  lines.forEach(function (line) {
    if (!line) return;
    var parsed = line.replace(TABLE_ROW_WRAP_REGEXP, '').split(TABLE_CELL_SPLIT);

    data.push(parsed.splice(0, parsed.length - 1));
  });
  return data;
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function unescapeEntities(html) {
  return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
}

function identity (str) {
  return str;
}

function compose () {
  var funcs = arguments;
  return function() {
    var args = arguments;
    for (var i = funcs.length; i-- > 0;) {
      args = [funcs[i].apply(this, args)];
    }
    return args[0];
  };
}