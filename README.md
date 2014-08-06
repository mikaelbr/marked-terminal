marked-terminal
===

Early release of a custom Renderer for [marked](https://github.com/chjj/marked)
allowing for printing Markdown to the Terminal.

Could for instance be used to print usage information.

## Install

```
npm install marked marked-terminal
```

## Example

```javascript
var marked = require('marked');
var TerminalRenderer = require('../');

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

// Show the parsed data
console.log(marked('# Hello \n This is **markdown** printed in the `terminal`'));
```

This will produce the following:

![Screenshot of marked-terminal](./screenshot.png)


## API

### Constructur: `new TerminalRenderer([options])`
Options: Optional
Used to override default styling.

Default values are:

```javascript
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
};
```

#### Example of overriding defaults
```javascript
marked.setOptions({
  renderer: new TerminalRenderer({
    codespan: chalk.underline.magenta,
  })
});
```

See [more examples](./example/)