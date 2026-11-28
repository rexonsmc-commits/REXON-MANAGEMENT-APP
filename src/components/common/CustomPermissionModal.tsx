import { useState } from 'react';
import { Plus, ShieldPlus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { CustomPermission } from '../../types';

interface CustomPermissionModalProps {
  open: boolean;
  onClose: () => void;
  scopeLabel: string;
  existingPermissions: CustomPermission[];
  onCreate: (input: {
    label: string;
    key: string;
    category: string;
    description: string;
  }) => Promise<void>;
  onDelete?: (perm: CustomPermission) => Promise<void>;
}

function slugifyPermissionKey(label: string): string {
  const clean = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (clean.length >= 2) return `custom.${clean}`;
  if (label.trim().length >= 2) {
    return `custom.perm_${Date.now().toString(36).slice(-5)}`;
  }
  return '';
}

export function CustomPermissionModal({
  open,
  onClose,
  scopeLabel,
  existingPermissions,
  onCreate,
  onDelete,
}: CustomPermissionModalProps) {
  const [label, setLabel] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [category, setCategory] = useState('Operations');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    setErrorMsg(null);
    if (!keyEdited) {
      setCustomKey(slugifyPermissionKey(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedLabel = label.trim();
    const resolvedKey = (customKey.trim() || slugifyPermissionKey(trimmedLabel))
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '_');

    if (trimmedLabel.length < 2) {
      setErrorMsg('Please enter a permission name of at least 2 characters.');
      return;
    }
    if (resolvedKey.length < 2 || !/^[a-z0-9_.-]+$/.test(resolvedKey)) {
      setErrorMsg('Permission key must contain at least 2 lowercase letters, numbers, dots, or underscores.');
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        label: trimmedLabel,
        key: resolvedKey,
        category: category.trim() || 'Custom',
        description: description.trim(),
      });
      setLabel('');
      setCustomKey('');
      setKeyEdited(false);
      setCategory('Operations');
      setDescription('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save custom permission. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Staff Permission"
      subtitle={`Create a custom permission for ${scopeLabel}. Newly added permissions become available immediately when adding or editing staff.`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Permission Name / Label *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g., Gate Vehicle Pass Approval"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Category *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Security, Billing, Operations"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Permission Key *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={customKey}
                onChange={(e) => {
                  setKeyEdited(true);
                  setCustomKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '_'));
                }}
                placeholder="custom.gate_vehicle_pass"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Description</label>
              <input
                type="text"
                maxLength={240}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this permission allows staff to do"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={saving || label.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{saving ? 'Adding...' : 'Save Permission'}</span>
            </button>
          </div>
        </form>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ShieldPlus className="h-4 w-4 text-[#1D4ED8]" />
            <span>Saved Custom Permissions ({existingPermissions.length})</span>
          </div>

          {existingPermissions.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              No custom permissions created yet. Add one above and it will immediately appear inside
              Add Staff &amp; Edit Staff.
            </p>
          ) : (
            <div className="mt-2.5 max-h-48 space-y-2 overflow-y-auto pr-1">
              {existingPermissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {perm.label}{' '}
                      <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-[#1D4ED8]">
                        {perm.category}
                      </span>
                    </p>
                    <p className="truncate text-slate-500">
                      <span className="font-mono">{perm.key}</span>
                      {perm.description ? ` · ${perm.description}` : ''}
                    </p>
                  </div>
                  {onDelete && (
                    <button
                      type="button"
                      disabled={deletingId === perm.id}
                      onClick={() => {
                        setDeletingId(perm.id);
                        void onDelete(perm).finally(() => setDeletingId(null));
                      }}
                      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                      title="Delete custom permission"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
