// Read-only extension. Existing native snapshot source is retained byte-for-byte.
import assert from 'node:assert/strict';
import {wood39TicketObserverSource} from './hd-wood-city4-snapshot-observer.mjs';
import {recruitmentHooksObserverSource} from './hd-wood-recruitment-hooks.mjs';
export const wood40TicketObserverSource = recruitmentHooksObserverSource + '\n' + wood39TicketObserverSource;
export function augmentV40RecruitmentMetaExpression(expression) {
    assert.equal(typeof expression, 'string');
    for (const marker of ['v32HookFence:', 'gameplayHooks:']) assert.equal(expression.split(marker).length, 2, marker+' appears once');
    assert.equal(expression.includes('recruitmentHookFence:'), false, 'No duplicate current-hook getter');
    return expression.replace('gameplayHooks:', 'recruitmentHookFence:window.__woodRecruitmentReadHookFence(),gameplayHooks:');
}
