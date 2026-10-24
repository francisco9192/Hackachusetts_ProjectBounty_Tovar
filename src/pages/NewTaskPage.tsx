/**
 * NewTaskPage — the "post a task" form at `/tasks/new` (Req 2.1-2.10, 3.1).
 * Reached only behind `RequireAuth`, so a Visitor is redirected to `/signin`
 * (Req 2.6) before this renders.
 *
 * PREFILL (Req 2.2): on mount it loads the signed-in member's own profile (via
 * `getCurrentUserId` then `getProfile`) and prefills the US state and town; both
 * remain editable. Prefill is a convenience, not a gate — if the lookup fails,
 * the form still renders empty so the member can fill it in. A short Loading
 * state covers the prefetch.
 *
 * SKILLS INPUT: skills are a single comma-separated text field. On submit the
 * raw text is split on commas into a `string[]`; `validateTask` (via
 * `normalizeSkills`) trims each entry, drops blanks, and removes case-insensitive
 * duplicates keeping the first spelling (Req 2.8). The UI stays simple while the
 * domain layer owns normalization.
 *
 * REWARD SECTION: a Reward_Type select (monetary / nonmonetary / volunteer, with
 * humanized labels but snake_case values) drives which sub-fields are rendered:
 *   - monetary    -> amount (dollars)
 *   - nonmonetary -> kind + description (+ optional estimated value)
 *   - volunteer   -> no extra fields
 * The handler builds a flat {@link RewardFormInput}, forcing every field that
 * does not belong to the chosen type to `''` so `validateReward`'s foreign-field
 * rule (Req 3.7) passes. `validateTask` returns reward errors under a `reward.`
 * prefix; the page strips that prefix to map each message back to its sub-field.
 *
 * DEADLINE (Req 2.3): an optional `type="date"` input. The page computes today
 * as a local `YYYY-MM-DD` string and passes it to `validateTask`, which checks
 * the deadline is today or later — the domain stays pure (no clock reads).
 *
 * SUBMIT: on invalid input, per-field errors are shown and focus moves to the
 * first invalid field (Req 2.4). On valid input `api.createTask` stores the task
 * and returns its id; we navigate to `/tasks/${id}` (the detail page is a later
 * task — the target is correct for when it lands). The submit button is disabled
 * while the request is in flight so one click creates at most one task (Req 2.10).
 * A backend failure shows its already-user-safe `error.message` and keeps every
 * entered value (Req 2.9).
 *
 * All data access goes through `src/lib/api.ts`; all user text renders through
 * normal JSX so React escapes it.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1_
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
} from '../components';
import { getCurrentUserId, getProfile, createTask } from '../lib/api';
import {
  CATEGORIES,
  NONMONETARY_KINDS,
  REWARD_TYPES,
  US_STATES,
} from '../domain/constants';
import { humanize } from '../domain/labels';
import { validateTask, type TaskFormInput } from '../domain/validation';
import type { RewardFormInput } from '../domain/reward';

/** Load status for the initial prefill fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready' };

/**
 * The field keys we can show an error for, in display (focus) order. Reward
 * sub-fields are keyed without the `reward.` prefix here; the prefix is stripped
 * when mapping `validateTask`'s nested reward errors onto these keys.
 */
const FIELD_ORDER = [
  'title',
  'description',
  'category',
  'skills',
  'rewardType',
  'rewardAmount',
  'rewardKind',
  'rewardDescription',
  'rewardEstimatedValue',
  'deadline',
  'usState',
  'town',
] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/**
 * Stable DOM ids per field. The Field primitives are plain function components
 * (they do not forward refs), so focus-first-invalid-field (Req 2.4) is done by
 * giving each control an explicit `id` and focusing it by id on failure.
 */
const FIELD_ID: Record<FieldKey, string> = {
  title: 'task-title',
  description: 'task-description',
  category: 'task-category',
  skills: 'task-skills',
  rewardType: 'task-reward-type',
  rewardAmount: 'task-reward-amount',
  rewardKind: 'task-reward-kind',
  rewardDescription: 'task-reward-description',
  rewardEstimatedValue: 'task-reward-estimated-value',
  deadline: 'task-deadline',
  usState: 'task-us-state',
  town: 'task-town',
};

/**
 * Map a reward error key from `validateReward` (`type`, `amount`, `kind`,
 * `description`, `estimatedValue`) to the page's reward field key. Used to turn
 * `validateTask`'s `reward.*` errors into entries this form can show and focus.
 */
const REWARD_KEY_TO_FIELD: Record<string, FieldKey> = {
  type: 'rewardType',
  amount: 'rewardAmount',
  kind: 'rewardKind',
  description: 'rewardDescription',
  estimatedValue: 'rewardEstimatedValue',
};

/** The controlled form values (all strings; skills is the raw comma text). */
interface FormValues {
  title: string;
  description: string;
  category: string;
  skills: string;
  rewardType: string;
  rewardAmount: string;
  rewardKind: string;
  rewardDescription: string;
  rewardEstimatedValue: string;
  deadline: string;
  usState: string;
  town: string;
}

const EMPTY_FORM: FormValues = {
  title: '',
  description: '',
  category: '',
  skills: '',
  rewardType: '',
  rewardAmount: '',
  rewardKind: '',
  rewardDescription: '',
  rewardEstimatedValue: '',
  deadline: '',
  usState: '',
  town: '',
};

/** Split the raw comma-separated skills text into a list (domain normalizes). */
function splitSkills(raw: string): string[] {
  return raw.split(',');
}

/** Today as a local `YYYY-MM-DD` string, so `validateTask` stays pure (Req 2.3). */
function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build the flat {@link RewardFormInput} from the form values, forcing every
 * field that does not belong to the chosen reward type to `''` so the domain's
 * foreign-field rule passes (Req 3.7). `validateReward` parses and range-checks.
 */
function buildReward(values: FormValues): RewardFormInput {
  switch (values.rewardType) {
    case 'monetary':
      return {
        type: 'monetary',
        amount: values.rewardAmount,
        kind: '',
        description: '',
        estimatedValue: '',
      };
    case 'nonmonetary':
      return {
        type: 'nonmonetary',
        amount: '',
        kind: values.rewardKind,
        description: values.rewardDescription,
        estimatedValue: values.rewardEstimatedValue,
      };
    case 'volunteer':
      return { type: 'volunteer', amount: '', kind: '', description: '', estimatedValue: '' };
    default:
      // Unknown/empty type: pass it through so validateReward reports the
      // missing-type error against the reward.type field.
      return {
        type: values.rewardType,
        amount: values.rewardAmount,
        kind: values.rewardKind,
        description: values.rewardDescription,
        estimatedValue: values.rewardEstimatedValue,
      };
  }
}

export function NewTaskPage() {
  const navigate = useNavigate();

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Prefill US state and town from the member's own profile (Req 2.2). Prefill
   * is a convenience: any failure (not signed in, lookup error) still lands on a
   * ready, empty-but-usable form rather than blocking task creation.
   */
  const prefill = useCallback(async () => {
    setLoad({ phase: 'loading' });
    try {
      const ownId = await getCurrentUserId();
      if (ownId !== null) {
        const data = await getProfile(ownId);
        if (data !== null) {
          setValues((prev) => ({
            ...prev,
            usState: data.profile.usState,
            town: data.profile.town,
          }));
        }
      }
    } catch {
      // Prefill is best-effort; ignore and let the member fill the fields.
    } finally {
      setLoad({ phase: 'ready' });
    }
  }, []);

  useEffect(() => {
    void prefill();
  }, [prefill]);

  function setField(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
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
    if (submitting) return;

    setSubmitError(null);

    const input: TaskFormInput = {
      title: values.title,
      description: values.description,
      category: values.category,
      skills: splitSkills(values.skills),
      reward: buildReward(values),
      deadline: values.deadline,
      usState: values.usState,
      town: values.town,
    };

    const result = validateTask(input, localToday());

    if (!result.ok) {
      // validateTask keys task fields plainly and reward fields under a
      // `reward.` prefix; remap both onto this form's FieldKey space.
      const mapped: Partial<Record<FieldKey, string>> = {};
      for (const [key, message] of Object.entries(result.errors)) {
        if (key.startsWith('reward.')) {
          const rewardField = REWARD_KEY_TO_FIELD[key.slice('reward.'.length)];
          if (rewardField !== undefined) mapped[rewardField] = message;
        } else if ((FIELD_ORDER as readonly string[]).includes(key)) {
          mapped[key as FieldKey] = message;
        }
      }
      setErrors(mapped);
      focusFirstError(mapped);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const id = await createTask(result.value);
      navigate(`/tasks/${id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not post your task.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-ink">Post a task</h1>
      <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
      <p className="mt-3 text-ink-muted">
        Describe the digital help you need and choose a reward. Your task is
        visible to members in its state.
      </p>

      {load.phase === 'loading' ? (
        <div className="mt-6">
          <Loading label="Loading your details" />
        </div>
      ) : (
        <form className="mt-6 max-w-xl space-y-5 rounded-card border border-brand-100 bg-surface-tint p-6 shadow-sm" onSubmit={handleSubmit} noValidate>
          {submitError !== null ? <ErrorState message={submitError} /> : null}

          <Input
            id={FIELD_ID.title}
            label="Title"
            hint="5 to 100 characters."
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            error={errors.title ?? ''}
            maxLength={100}
          />

          <Textarea
            id={FIELD_ID.description}
            label="Description"
            hint="20 to 3000 characters. Explain what you need done."
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            error={errors.description ?? ''}
            rows={5}
          />

          <Select
            id={FIELD_ID.category}
            label="Category"
            value={values.category}
            onChange={(e) => setField('category', e.target.value)}
            error={errors.category ?? ''}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>

          <Input
            id={FIELD_ID.skills}
            label="Skills"
            hint="Optional. Separate skills with commas, e.g. Excel, React, Writing. Up to 10; duplicates are removed automatically."
            value={values.skills}
            onChange={(e) => setField('skills', e.target.value)}
            error={errors.skills ?? ''}
          />

          <fieldset className="space-y-5 rounded-card border border-brand-100 bg-surface p-4">
            <legend className="px-1 text-sm font-semibold text-brand-700">Reward</legend>

            <Select
              id={FIELD_ID.rewardType}
              label="Reward type"
              value={values.rewardType}
              onChange={(e) => setField('rewardType', e.target.value)}
              error={errors.rewardType ?? ''}
            >
              <option value="">Select a reward type</option>
              {REWARD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>

            {values.rewardType === 'monetary' ? (
              <Input
                id={FIELD_ID.rewardAmount}
                label="Amount"
                hint="$0.01 to $10,000.00. Enter dollars, e.g. 150 or 150.00."
                inputMode="decimal"
                value={values.rewardAmount}
                onChange={(e) => setField('rewardAmount', e.target.value)}
                error={errors.rewardAmount ?? ''}
              />
            ) : null}

            {values.rewardType === 'nonmonetary' ? (
              <>
                <Select
                  id={FIELD_ID.rewardKind}
                  label="Reward kind"
                  value={values.rewardKind}
                  onChange={(e) => setField('rewardKind', e.target.value)}
                  error={errors.rewardKind ?? ''}
                >
                  <option value="">Select a kind</option>
                  {NONMONETARY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {humanize(k)}
                    </option>
                  ))}
                </Select>

                <Textarea
                  id={FIELD_ID.rewardDescription}
                  label="Reward description"
                  hint="5 to 300 characters. Describe what you are offering."
                  value={values.rewardDescription}
                  onChange={(e) => setField('rewardDescription', e.target.value)}
                  error={errors.rewardDescription ?? ''}
                  rows={3}
                  maxLength={300}
                />

                <Input
                  id={FIELD_ID.rewardEstimatedValue}
                  label="Estimated value (optional)"
                  hint="Optional. $0.00 to $10,000.00, e.g. 25 or 25.00."
                  inputMode="decimal"
                  value={values.rewardEstimatedValue}
                  onChange={(e) => setField('rewardEstimatedValue', e.target.value)}
                  error={errors.rewardEstimatedValue ?? ''}
                />
              </>
            ) : null}

            {values.rewardType === 'volunteer' ? (
              <p className="text-sm text-ink-muted">
                A volunteer task offers no payment or item. No extra details are
                needed.
              </p>
            ) : null}
          </fieldset>

          <Input
            id={FIELD_ID.deadline}
            label="Deadline (optional)"
            hint="Optional. Must be today or later."
            type="date"
            value={values.deadline}
            onChange={(e) => setField('deadline', e.target.value)}
            error={errors.deadline ?? ''}
          />

          <Select
            id={FIELD_ID.usState}
            label="State"
            hint="Prefilled from your profile. Members in this state can apply."
            value={values.usState}
            onChange={(e) => setField('usState', e.target.value)}
            error={errors.usState ?? ''}
          >
            <option value="">Select a state</option>
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
            <Button type="submit" loading={submitting}>
              Post task
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </AppLayout>
  );
}
