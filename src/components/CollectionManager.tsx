import { Folder, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { repository } from '@/storage/repository';
import type { Category, Collection } from '@/types/model';
import { toast } from './ToastNotification';
import { Button } from './ui/Button';
import { ConfirmDialog, Dialog } from './ui/Dialog';
import { Input } from './ui/primitives';

function NameRow({
  name,
  color,
  onRename,
  onDelete,
  icon,
}: {
  name: string;
  color: string;
  onRename: (n: string) => Promise<void>;
  onDelete: () => void;
  icon: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  return (
    <li className="group flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-subtle">
      <span style={{ color }}>{icon}</span>
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onRename(value);
            setEditing(false);
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-7"
            aria-label="Nouveau nom"
          />
          <Button size="sm" type="submit" variant="primary">
            OK
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 truncate text-[13px] text-fg">{name}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renommer ${name}`}
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Supprimer ${name}`}
            onClick={onDelete}
            className="opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 size={13} />
          </Button>
        </>
      )}
    </li>
  );
}

/** Create, rename and delete collections and categories. */
export function CollectionManager({
  open,
  onOpenChange,
  collections,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collections: Collection[];
  categories: Category[];
}) {
  const [newCol, setNewCol] = useState('');
  const [newCat, setNewCat] = useState('');
  const [pending, setPending] = useState<{
    kind: 'collection' | 'category';
    item: Collection | Category;
  } | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Collections et catégories"
      description="Les collections regroupent librement vos entrées ; une entrée a au plus une catégorie."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
            Collections
          </h4>
          <form
            className="mb-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCol.trim()) return;
              await repository.createCollection(newCol);
              setNewCol('');
              toast.success('Collection créée');
            }}
          >
            <Input
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              placeholder="Nouvelle collection"
              aria-label="Nom de la nouvelle collection"
            />
            <Button type="submit" size="icon" variant="primary" aria-label="Créer la collection">
              <Plus size={15} />
            </Button>
          </form>
          <ul className="space-y-0.5">
            {collections.map((c) => (
              <NameRow
                key={c.id}
                name={c.name}
                color={c.color}
                icon={<Folder size={14} />}
                onRename={(n) => repository.renameCollection(c.id, n)}
                onDelete={() => setPending({ kind: 'collection', item: c })}
              />
            ))}
            {!collections.length ? (
              <li className="px-2 py-2 text-[12.5px] text-muted">Aucune collection.</li>
            ) : null}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
            Catégories
          </h4>
          <form
            className="mb-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCat.trim()) return;
              await repository.createCategory(newCat);
              setNewCat('');
              toast.success('Catégorie créée');
            }}
          >
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Nouvelle catégorie"
              aria-label="Nom de la nouvelle catégorie"
            />
            <Button type="submit" size="icon" variant="primary" aria-label="Créer la catégorie">
              <Plus size={15} />
            </Button>
          </form>
          <ul className="space-y-0.5">
            {categories.map((c) => (
              <NameRow
                key={c.id}
                name={c.name}
                color={c.color}
                icon={<Tag size={14} />}
                onRename={(n) => repository.renameCategory(c.id, n)}
                onDelete={() => setPending({ kind: 'category', item: c })}
              />
            ))}
            {!categories.length ? (
              <li className="px-2 py-2 text-[12.5px] text-muted">Aucune catégorie.</li>
            ) : null}
          </ul>
        </div>
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Supprimer « ${pending?.item.name ?? ''} » ?`}
        description="Les entrées ne sont pas supprimées, elles sont seulement retirées de ce groupe."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          if (!pending) return;
          if (pending.kind === 'collection') await repository.deleteCollection(pending.item.id);
          else await repository.deleteCategory(pending.item.id);
          setPending(null);
        }}
      />
    </Dialog>
  );
}
