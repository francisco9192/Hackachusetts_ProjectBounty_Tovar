/**
 * Property-based test for submission and URL validation in
 * `src/domain/validation.ts`.
 *
 * Covers design Correctness Property 7: Submission and URL validation.
 *
 * Feature: bounty-platform, Property 7: Submission and URL validation
 *
 * Validates: Requirements 7.1, 7.2, 7.7, 10.4
 *
 * The oracle recomputes expected validity from the raw input per Req 7.1 / 7.2
 * / 7.7 (description 10-2000 trimmed; 1-5 URLs; each http/https with non-empty
 * host and <=2048 chars) and tests `isHttpUrl` directly (Req 10.4). The oracle
 * never calls the functions under test to decide expected results.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { isHttpUrl, validateSubmission } from '../../src/domain/validation';
import { LIMITS } from '../../src/domain/constants';
import { submissionInput, urlEntry } from './arbitraries';

const RUNS = { numRuns: 200 };

// ---------------------------------------------------------------------------
// Independent URL oracle (mirrors Req 7.2 / 10.4; does not call the SUT)
// ---------------------------------------------------------------------------

/**
 * True only for an absolute http/https URL with a non-empty host and total
 * length <= 2048. Reimplemented here from the requirement rather than from the
 * implementation: an absolute URL the WHATWG parser accepts, http(s) scheme,
 * and a host.
 */
function oracleIsHttpUrl(s: string): boolean {
  if (s.length === 0 || s.length > LIMITS.submissionUrls.maxLength) return false;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.hostname.length > 0;
}

function trimLen(s: string): number {
  return s.trim().length;
}

/** Expected invalid-key set for `validateSubmission`, per Req 7.1 / 7.7. */
function oracleSubmissionInvalid(input: { description: string; urls: string[] }): Set<string> {
  const bad = new Set<string>();

  const dLen = trimLen(input.description);
  if (dLen < LIMITS.submissionDescription.min || dLen > LIMITS.submissionDescription.max) {
    bad.add('description');
  }

  const { minCount, maxCount } = LIMITS.submissionUrls;
  if (input.urls.length < minCount || input.urls.length > maxCount) {
    bad.add('urls');
  }

  input.urls.forEach((raw, i) => {
    if (!oracleIsHttpUrl(raw.trim())) bad.add(`url.${i}`);
  });

  return bad;
}

describe('validation.ts - validateSubmission (Property 7)', () => {
  it('Property 7 (Req 7.1, 7.2, 7.7): validateSubmission.ok iff description is 10-2000 trimmed AND 1-5 URLs each pass the http(s)/host/<=2048 rule, and errors name exactly the failing fields', () => {
    fc.assert(
      fc.property(
        submissionInput,
        (input: { description: string; urls: string[] }) => {
          const expectedInvalid = oracleSubmissionInvalid(input);
          const expectedOk = expectedInvalid.size === 0;

          const result = validateSubmission(input);
          expect(result.ok).toBe(expectedOk);

          if (!result.ok) {
            expect(new Set(Object.keys(result.errors))).toEqual(expectedInvalid);
          }
        },
      ),
      RUNS,
    );
  });

  it('Property 7 (Req 10.4): isHttpUrl agrees with the independent oracle for arbitrary URL strings', () => {
    fc.assert(
      fc.property(urlEntry, (raw: string) => {
        const url = raw.trim();
        expect(isHttpUrl(url)).toBe(oracleIsHttpUrl(url));
      }),
      RUNS,
    );
  });

  it('Property 7 (Req 10.4): explicit examples - unsafe/relative/overlong schemes are rejected, http(s) accepted', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('mailto:someone@example.com')).toBe(false);
    expect(isHttpUrl('ftp://files.example.com/x')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('example.com')).toBe(false); // relative, no scheme
    expect(isHttpUrl('/relative/path')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('http://')).toBe(false); // empty host
    expect(isHttpUrl(`https://a.com/${'x'.repeat(2048)}`)).toBe(false); // > 2048 chars
    expect(isHttpUrl('https://example.com/path')).toBe(true);
    expect(isHttpUrl('http://example.org')).toBe(true);
  });

  it('Property 7 (Req 7.1): explicit example - valid description with one good URL passes', () => {
    const result = validateSubmission({
      description: 'Here is the finished landing page for your review.',
      urls: ['https://example.com/work'],
    });
    expect(result.ok).toBe(true);
  });

  it('Property 7 (Req 7.7): explicit example - zero URLs and a short description fail with the right keys', () => {
    const result = validateSubmission({ description: 'short', urls: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveProperty('description');
      expect(result.errors).toHaveProperty('urls');
    }
  });
});
