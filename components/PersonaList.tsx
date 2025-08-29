
import React from 'react';
import { Persona } from '../types';
import { EditIcon, TrashIcon } from './icons';

interface PersonaListProps {
  personas: Persona[];
  onEdit: (persona: Persona) => void;
  onDelete: (id: string) => void;
}

export const PersonaList: React.FC<PersonaListProps> = ({ personas, onEdit, onDelete }) => {
  if (personas.length === 0) {
    return (
      <div className="text-center py-16 px-8 bg-gray-800 rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-400">No Personas Yet</h2>
        <p className="text-gray-500 mt-2">Click "New Persona" to create your first character.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {personas.map(persona => (
        <div key={persona.id} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between transition-transform transform hover:-translate-y-1">
          <div>
            <h3 className="text-xl font-bold text-indigo-400">{persona.name}</h3>
            <p className="text-sm text-gray-400 mb-4">{persona.role}</p>
            <div className="space-y-2 text-sm">
                <p><strong className="font-semibold text-gray-300">Tone:</strong> <span className="text-gray-400">{persona.tone}</span></p>
                <p><strong className="font-semibold text-gray-300">Personality:</strong> <span className="text-gray-400">{persona.personality}</span></p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => onEdit(persona)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"><EditIcon /></button>
            <button onClick={() => persona.id && onDelete(persona.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full transition-colors"><TrashIcon /></button>
          </div>
        </div>
      ))}
    </div>
  );
};