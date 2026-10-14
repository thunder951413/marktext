// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

describe('inline renderer document batch', () => {
    it('collects reference definitions once for a full setContent render', () => {
        const muya = bootMuya('initial\n');
        const getState = vi.spyOn(muya.editor.jsonState, 'getState');

        const paragraphs = Array.from(
            { length: 100 },
            (_, index) => `paragraph ${index}`,
        );
        const markdown = [
            '[linked text][docs]',
            ...paragraphs,
            '[docs]: https://example.com/docs "Docs"',
        ].join('\n\n');

        muya.setContent(markdown);

        expect(getState).toHaveBeenCalledTimes(1);
        const link = muya.domNode.querySelector<HTMLAnchorElement>(
            'a[href="https://example.com/docs"]',
        );
        expect(link?.textContent).toContain('linked text');
    });

    it('keeps force-render and image-cache refresh on the same batch boundary', () => {
        const markdown = Array.from(
            { length: 100 },
            (_, index) => `paragraph ${index}`,
        ).join('\n\n');
        const muya = bootMuya(markdown);
        const getState = vi.spyOn(muya.editor.jsonState, 'getState');

        muya.setOptions({ superSubScript: true }, true);
        // One snapshot drives rendering; a second is permitted for the
        // cursor-offset event emitted after the render. The count must remain
        // constant rather than growing with the 100 content blocks.
        expect(getState.mock.calls.length).toBeLessThanOrEqual(2);

        getState.mockClear();
        muya.invalidateImageCache();
        expect(getState.mock.calls.length).toBeLessThanOrEqual(2);
    });
});
