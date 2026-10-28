import type { MarkedExtension } from 'marked';
import { describe, expectTypeOf, it } from 'vitest';
import TerminalRenderer, {
  type HighlightOptions,
  markedTerminal,
  TerminalRenderer as NamedTerminalRenderer,
  type TerminalRendererOptions
} from '../src/index.ts';

describe('public types', () => {
  it('markedTerminal returns a marked extension', () => {
    expectTypeOf(markedTerminal()).toEqualTypeOf<MarkedExtension>();
    expectTypeOf(markedTerminal)
      .parameter(0)
      .toEqualTypeOf<TerminalRendererOptions | undefined>();
    expectTypeOf(markedTerminal)
      .parameter(1)
      .toEqualTypeOf<HighlightOptions | undefined>();
  });

  it('exports the renderer as default and named export', () => {
    expectTypeOf(NamedTerminalRenderer).toEqualTypeOf<
      typeof TerminalRenderer
    >();
  });

  it('accepts any string function as style', () => {
    expectTypeOf<{
      code: (s: string) => string;
    }>().toExtend<TerminalRendererOptions>();
    // @ts-expect-error tab must be number or string
    markedTerminal({ tab: true });
  });
});
