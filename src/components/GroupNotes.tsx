import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  GroupNote,
  getUserGroupNotes,
  createGroupNote,
  updateGroupNote,
  deleteGroupNote,
} from "../services/groupService";
import { syncUser } from "../services/userService";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface GroupNotesProps {
  groupId: string;
}

export function GroupNotes({ groupId }: GroupNotesProps) {
  const { user } = useUser();
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");

  useEffect(() => {
    loadNotes();
  }, [groupId, user]);

  async function loadNotes() {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    try {
      setLoading(true);
      const supabaseUser = await syncUser(user); // Synchronisiert und gibt `clerk_id` zurück
      const notes = await getUserGroupNotes(groupId, supabaseUser.clerk_id); // Pass `clerk_id` weiter
      setNotes(notes);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!user || !newNoteContent.trim()) return;

    try {
      const supabaseUser = await syncUser(user); // Synchronisiere Benutzer
      const newNote = await createGroupNote(
        groupId,
        supabaseUser.clerk_id, // Passiere die clerk_id
        newNoteContent,
        newNoteTitle || undefined
      );

      setNotes([newNote, ...notes]);
      setNewNoteContent("");
      setNewNoteTitle("");
      setShowAddNote(false);
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleUpdateNote(
    noteId: string,
    content: string,
    title?: string
  ) {
    if (!user) return;

    try {
      await updateGroupNote(noteId, user.id, { content, title });
      setNotes(
        notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                content,
                title: title || note.title,
                updated_at: new Date().toISOString(),
              }
            : note
        )
      );
      setEditingNote(null);
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!user) return;

    try {
      await deleteGroupNote(noteId, user.id);
      setNotes(notes.filter((note) => note.id !== noteId));
    } catch (error) {
      setError(error.message);
    }
  }

  if (loading) {
    return <div className="text-gray-400">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Notes</h3>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      {showAddNote && (
        <div className="bg-black/20 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500"
          />
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write your note..."
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500 min-h-[100px]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddNote(false)}
              className="px-3 py-1 text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim()}
              className="px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="bg-black/20 rounded-lg p-4">
            {editingNote === note.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  defaultValue={note.title || ""}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500"
                />
                <textarea
                  defaultValue={note.content}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500 min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingNote(null)}
                    className="px-3 py-1 text-gray-400 hover:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateNote(note.id, newNoteContent, newNoteTitle)
                    }
                    className="px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  {note.title && <h4 className="font-medium">{note.title}</h4>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingNote(note.id)}
                      className="p-1 text-gray-400 hover:text-gray-300"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">
                  {note.content}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  Last updated: {new Date(note.updated_at).toLocaleString()}
                </div>
              </>
            )}
          </div>
        ))}

        {notes.length === 0 && !showAddNote && (
          <p className="text-gray-400 text-center py-4">
            No notes yet. Click the + button to add one!
          </p>
        )}
      </div>
    </div>
  );
}
