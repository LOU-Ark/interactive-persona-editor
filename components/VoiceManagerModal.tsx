
import React, { useState, useEffect } from 'react';
import { Voice } from '../types';
import { CloseIcon, SaveIcon, PlusIcon, TrashIcon, EditIcon } from './icons';

interface VoiceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVoices: Voice[];
  onSave: (voices: Voice[]) => void;
}

const emptyVoice: Omit<Voice, 'id'> = { name: '', token: '', voiceId: '' };

export const VoiceManagerModal: React.FC<VoiceManagerModalProps> = ({ isOpen, onClose, initialVoices, onSave }) => {
  const [voices, setVoices] = useState<Voice[]>(initialVoices);
  const [editingVoice, setEditingVoice] = useState<Omit<Voice, 'id'>>({ ...emptyVoice });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setVoices(initialVoices);
  }, [initialVoices, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingVoice(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveOrUpdateVoice = () => {
    if (!editingVoice.name || !editingVoice.token || !editingVoice.voiceId) {
      alert("All fields (Name, Token, Voice ID) are required.");
      return;
    }
    
    let updatedVoices;
    if (editingId) {
      // Update existing voice
      updatedVoices = voices.map(v => v.id === editingId ? { ...editingVoice, id: editingId } : v);
    } else {
      // Add new voice
      const newVoice: Voice = { ...editingVoice, id: Date.now().toString() };
      updatedVoices = [...voices, newVoice];
    }
    setVoices(updatedVoices);
    setEditingVoice({ ...emptyVoice });
    setEditingId(null);
  };

  const handleEdit = (voice: Voice) => {
    setEditingId(voice.id);
    setEditingVoice({ name: voice.name, token: voice.token, voiceId: voice.voiceId });
  };
  
  const handleDelete = (id: string) => {
    setVoices(voices.filter(v => v.id !== id));
  };
  
  const handleFinalSave = () => {
    onSave(voices);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col relative" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Manage Custom Voices</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon/></button>
        </header>

        <main className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Form for adding/editing */}
          <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
             <h3 className="text-lg font-semibold text-gray-300">{editingId ? 'Edit Voice' : 'Add New Voice'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" name="name" value={editingVoice.name} onChange={handleInputChange} placeholder="Voice Name (e.g., 'Akira')" className="input-field" />
              <input type="password" name="token" value={editingVoice.token} onChange={handleInputChange} placeholder="Fish Audio Token" className="input-field" />
              <input type="text" name="voiceId" value={editingVoice.voiceId} onChange={handleInputChange} placeholder="Fish Audio Voice ID" className="input-field" />
            </div>
            <button onClick={handleSaveOrUpdateVoice} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md shadow-lg text-sm">
              <PlusIcon/> {editingId ? 'Update Voice' : 'Add Voice'}
            </button>
          </div>
          <style>{`.input-field { background-color: #374151; color: #D1D5DB; border: 1px solid #4B5563; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .input-field:focus { border-color: #6366F1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5); }`}</style>

          {/* List of saved voices */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-300">Saved Voices</h3>
            {voices.length > 0 ? (
                voices.map(voice => (
                    <div key={voice.id} className="flex items-center justify-between bg-gray-700/60 p-3 rounded-md">
                        <div className="flex-grow">
                            <p className="font-semibold text-white">{voice.name}</p>
                            <p className="text-xs text-gray-400">Voice ID: {voice.voiceId}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(voice)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors"><EditIcon /></button>
                            <button onClick={() => handleDelete(voice.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-600 rounded-full transition-colors"><TrashIcon /></button>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-gray-500 text-sm">No custom voices saved yet.</p>
            )}
          </div>
        </main>

        <footer className="flex justify-end p-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white mr-2">Cancel</button>
          <button onClick={handleFinalSave} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md shadow-lg">
            <SaveIcon />
            Save & Close
          </button>
        </footer>
      </div>
    </div>
  );
};