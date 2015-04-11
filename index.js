"use strict";

var chalk = require('chalk');
var Table = require('cli-table');
var extend = require('node.extend');
var cardinal = require('cardinal');


var TABLE_CELL_SPLIT = '^*||*^';
var TABLE_ROW_WRAP = '*|*|*|*';
var TABLE_ROW_WRAP_REGEXP = new RegExp(escapeRegExp(TABLE_ROW_WRAP), 'g');

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
  tableOptions: {}
};

function Renderer(options, highlightOptions) {
  this.o = extend(defaultOptions, options);
  this.tableSettings = this.o.tableOptions;
  this.highlightOptions = highlightOptions || {};
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
  var e = this.o.unescape ? unescapeEntities : identity;
  text = e(text);

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
  var e = this.o.unescape ? unescapeEntities : identity;
  body = e(body);

  if (ordered) {
    body = changeToOrdered(body);
  }
  return indentLines(body);
};

function indentLines (text) {
  return text.replace(/\n/g, '\n' + tab()) + '\n\n';
}

Renderer.prototype.listitem = function(text) {
  var e = this.o.unescape ? unescapeEntities : identity;
  var isNested = ~text.indexOf('\n');
  if (isNested) {
    text = text.trim();
  }
  return '\n' + this.o.listitem('* ' + e(text));
};

Renderer.prototype.paragraph = function(text) {
  var e = this.o.unescape ? unescapeEntities : identity;
  return this.o.paragraph(e(text)) + '\n\n';
};

Renderer.prototype.table = function(header, body) {
  var e = this.o.unescape ? unescapeEntities : identity;
  var table = new Table(extend({
      head: generateTableRow(header)[0]
  }, this.tableSettings));

  generateTableRow(body, e).forEach(function (row) {
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
  return this.o.codespan(text);
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
  if (hasText) out += text + ' (';
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


function changeToOrdered(text) {
  var i = 1;
  return text.split('\n').reduce(function (acc, line) {
    if (!line) return acc;
    return acc + tab() + (i++) + '.' + line.substring(tab().length + 1) + '\n';
  }, '');
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

function hr(inputHrStr) {
  return (new Array(process.stdout.columns)).join(inputHrStr);
}

function tab(size) {
  size = size || 4;
  return (new Array(size)).join(' ');
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
