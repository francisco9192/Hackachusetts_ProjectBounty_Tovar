/**
 * ProfileEditPage — the owner-only profile editor at `/profile/edit`
 * (Req 1.10, 1.11, 1.12, 1.16). It is reached only behind `RequireAuth`, so a
 * Visitor is redirected to `/signin` (Req 1.17) before this ever renders.
 *
 * On mount it loads the signed-in member's own profile (via `getCurrentUserId`
 * then `getProfile`) and prefills the form. The editable fields are display
 * name, bio, skills, US state, and town. The Age_Bracket is intentionally NOT
 * editable (Req 1.10) and is not shown.
 *
 * SKILLS INPUT: skills are entered as a single comma-separated text field. On
 * submit the raw text is split on commas into a `string[]`; `validateProfile`
 * (via `normalizeSkills`) then trims each entry, drops blanks, and removes
 * case-insensitive duplicates keeping the first spelling (Req 1.12). This keeps
 * the UI simple while the domain layer owns normalization.
 *
 * On submit: build the `ProfileInput`, run `validateProfile`; on failure show
 * per-field errors and move focus to the first invalid field (Req 1.11 — a
 * basic focus-first-error; the full a11y pass is task 24). On success call
 * `api.upsertProfile` and show a success confirmation. Backend errors surface
 * their already-user-safe `error.message` in an inline alert. The submit button
 * is disabled while a save is in flight so one click saves at most once.
 *
 * All data access goes through `src/lib/api.ts`; all user text renders through
 * normal JSX so React escapes it.
 *
 * _Requirements: 1.10, 1.11, 1.12, 1.16_
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AppLayout,
  Button,
  ErrorState,
  Input,
  Loading,
  Select,
  Textarea,
  Toast,
} from '../components';
import {
  getCurrentUserId,
  getProfile,
  upsertProfile,
} from '../lib/api';
import { US_STATES } from '../domain/constants';
import { validateProfile } from '../domain/validation';

/** Load status for the initial prefill fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; ownId: string };

/** The field keys `validateProfile` can report, in display order. */
const FIELD_ORDER = ['displayName', 'bio', 'skills', 'usState', 'town'] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/**
 * Stable DOM ids per field. The Field primitives are plain function components
 * (they do not forward refs), so focus-first-invalid-field (Req 1.11) is done
 * by giving each control an explicit `id` and focusing it by id on failure.
 */
const FIELD_ID: Record<FieldKey, string> = {
  displayName: 'profile-display-name',
  bio: 'profile-bio',
  skills: 'profile-skills',
  usState: 'profile-us-state',
  town: 'profile-town',
};

/** The editable form values (all strings; skills is the raw comma-separated text). */
interface FormValues {
  displayName: string;
  bio: string;
  skills: string;
  usState: string;
  town: string;
}

const EMPTY_FORM: FormValues = {
  displayName: '',
  bio: '',
  skills: '',
  usState: '',
  town: '',
};

/** Split the raw comma-separated skills text into a list (domain layer normalizes). */
function splitSkills(raw: string): string[] {
  return raw.split(',');
}

export function ProfileEditPage() {
  const navigate = useNavigate();

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const prefill = useCallback(async () => {
    setLoad({ phase: 'loading' });
    try {
      const ownId = await getCurrentUserId();
      if (ownId === null) {
        // RequireAuth should prevent this, but guard anyway.
        setLoad({ phase: 'error', message: 'Please sign in to edit your profile.' });
        return;
      }
      const data = await getProfile(ownId);
      if (data !== null) {
        setValues({
          displayName: data.profile.displayName,
          bio: data.profile.bio,
          skills: data.profile.skills.join(', '),
          usState: data.profile.usState,
          town: data.profile.town,
        });
      }
      setLoad({ phase: 'ready', ownId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not load your profile.';
      setLoad({ phase: 'error', message });
    }
  }, []);

  useEffect(() => {
    void prefill();
  }, [prefill]);

  function setField(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  /** Move focus to the first field (in display order) that has an error. */
  function focusFirstError(fieldErrors: Partial<Record<FieldKey, string>>) {
    for (const key of FIELD_ORDER) {
      if (fieldErrors[key] !== undefined) {
        document.getElementById(FIELD_ID[key])?.focus();
        return;
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (load.phase !== 'ready' || saving) return;

    setSaveError(null);
    setSaved(false);

    const result = validateProfile({
      displayName: values.displayName,
      bio: values.bio,
      skills: splitSkills(values.skills),
      usState: values.usState,
      town: values.town,
    });

    if (!result.ok) {
      setErrors(result.errors as Partial<Record<FieldKey, string>>);
      focusFirstError(result.errors as Partial<Record<FieldKey, string>>);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await upsertProfile(result.value);
      // Reflect the normalized skills back into the field so the user sees
      // exactly what was stored (dedup/trim applied).
      setValues((prev) => ({ ...prev, skills: result.value.skills.join(', ') }));
      setSaved(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not save your profile.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-ink">Edit your profile</h1>
      <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
      <p className="mt-3 text-ink-muted">
        Update how other members see you. Your email and age are never shown on
        your profile.
      </p>

      {load.phase === 'loading' ? (
        <div className="mt-6">
          <Loading label="Loading your profile" />
        </div>
      ) : null}

      {load.phase === 'error' ? (
        <div className="mt-6">
          <ErrorState message={load.message} onRetry={() => void prefill()} />
        </div>
      ) : null}

      {load.phase === 'ready' ? (
        <form className="mt-6 max-w-xl space-y-5 rounded-card border border-brand-100 bg-surface-tint p-6 shadow-sm" onSubmit={handleSubmit} noValidate>
          {saved ? (
            <Toast
              message="Your profile has been saved."
              variant="success"
              onDismiss={() => setSaved(false)}
            />
          ) : null}

          {saveError !== null ? (
            <ErrorState message={saveError} />
          ) : null}

          <Input
            id={FIELD_ID.displayName}
            label="Display name"
            value={values.displayName}
            onChange={(e) => setField('displayName', e.target.value)}
            error={errors.displayName ?? ''}
            maxLength={50}
            autoComplete="name"
          />

          <Textarea
            id={FIELD_ID.bio}
            label="Bio"
            hint="Up to 500 characters. Tell members about yourself."
            value={values.bio}
            onChange={(e) => setField('bio', e.target.value)}
            error={errors.bio ?? ''}
            rows={4}
          />

          <Input
            id={FIELD_ID.skills}
            label="Skills"
            hint="Separate skills with commas, e.g. Excel, React, Writing. Duplicates are removed automatically."
            value={values.skills}
            onChange={(e) => setField('skills', e.target.value)}
            error={errors.skills ?? ''}
          />

          <Select
            id={FIELD_ID.usState}
            label="State"
            value={values.usState}
            onChange={(e) => setField('usState', e.target.value)}
            error={errors.usState ?? ''}
          >
            <option value="">Select your state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>

          <Input
            id={FIELD_ID.town}
            label="Town or city"
            value={values.town}
            onChange={(e) => setField('town', e.target.value)}
            error={errors.town ?? ''}
            maxLength={60}
          />

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              Save profile
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => navigate(`/profile/${load.ownId}`)}
            >
              View my profile
            </Button>
          </div>
        </form>
      ) : null}
    </AppLayout>
  );
}
