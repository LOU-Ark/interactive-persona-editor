
import React, { useState, useCallback, useEffect } from 'react';
import { Persona, PersonaState, PersonaHistoryEntry, Voice } from './types';
import { PersonaEditorModal } from './components/PersonaEditorModal';
import { PersonaList } from './components/PersonaList';
import { ProductionChat } from './components/ProductionChat';
import { PlusIcon, EditIcon, ChatBubbleIcon } from './components/icons';
import * as geminiService from './services/geminiService';
import { VoiceManagerModal } from './components/VoiceManagerModal';

const App: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([
    {
      id: '1',
      name: 'アキラ',
      role: 'サイバーパンクな都市の探偵',
      tone: '冷静沈着で、時折皮肉を言う',
      personality: '分析的で観察眼が鋭いが、人間関係には不器用',
      worldview: 'テクノロジーが支配する退廃的な未来都市',
      experience: '元エリートハッカーで、過去に大きな失敗を経験している',
      other: '右腕が義体化されている。雨の日になると古傷が痛むらしい。',
      summary: '退廃的な未来都市を舞台に活躍するサイバーパンクな探偵、アキラ。元エリートハッカーとしての過去を持ち、冷静沈着な分析力と鋭い観察眼で事件を解決に導く。しかし、その裏では人間関係に不器用な一面も。義体化された右腕と、雨の日に痛む古傷が彼の過去を物語っている。',
      history: []
    }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'chat'>('editor');
  
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isVoiceManagerOpen, setIsVoiceManagerOpen] = useState(false);

  // Load voices from localStorage on initial render
  useEffect(() => {
    try {
      const storedVoices = localStorage.getItem('fishAudioVoices');
      if (storedVoices) {
        setVoices(JSON.parse(storedVoices));
      }
    } catch (error) {
      console.error("Failed to load voices from localStorage:", error);
    }
  }, []);

  // Save voices to localStorage whenever they change
  const handleSaveVoices = useCallback((updatedVoices: Voice[]) => {
    try {
      setVoices(updatedVoices);
      localStorage.setItem('fishAudioVoices', JSON.stringify(updatedVoices));
    } catch (error) {
      console.error("Failed to save voices to localStorage:", error);
    }
  }, []);


  const handleOpenModal = useCallback((persona?: Persona) => {
    setEditingPersona(persona || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingPersona(null);
  }, []);

  const handleSavePersona = useCallback(async (personaToSave: PersonaState & { id?: string }) => {
    const existingPersona = personas.find(p => p.id === personaToSave.id);
    
    if (existingPersona) {
      // Update existing persona and save history
      const oldState: PersonaState = {
        name: existingPersona.name,
        role: existingPersona.role,
        tone: existingPersona.tone,
        personality: existingPersona.personality,
        worldview: existingPersona.worldview,
        experience: existingPersona.experience,
        other: existingPersona.other,
        summary: existingPersona.summary,
      };

      const changeSummary = await geminiService.generateChangeSummary(oldState, personaToSave);
      
      const newHistoryEntry: PersonaHistoryEntry = {
        state: oldState,
        timestamp: new Date().toISOString(),
        changeSummary: changeSummary,
      };
      
      const updatedHistory = [newHistoryEntry, ...existingPersona.history].slice(0, 10);

      const updatedPersona: Persona = {
        ...existingPersona,
        ...personaToSave,
        history: updatedHistory,
      };
      
      setPersonas(prevPersonas => prevPersonas.map(p => p.id === existingPersona.id ? updatedPersona : p));
    } else {
      // Create new persona
      const newPersona: Persona = {
        ...personaToSave,
        id: Date.now().toString(),
        history: [],
      };
      setPersonas(prevPersonas => [...prevPersonas, newPersona]);
    }
    handleCloseModal();
  }, [personas, handleCloseModal]);
  
  const handleDeletePersona = useCallback((personaId: string) => {
    setPersonas(prev => prev.filter(p => p.id !== personaId));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className={`container mx-auto px-4 py-8 ${activeView === 'chat' ? 'flex flex-col h-screen max-h-screen' : ''}`}>
        <header className="flex-shrink-0">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                Interactive Persona Editor
              </h1>
              <p className="text-gray-400 mt-1">AI-powered character creation studio.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 self-center md:self-auto">
              <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                  <button onClick={() => setActiveView('editor')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeView === 'editor' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}><EditIcon /> Editor</button>
                  <button onClick={() => setActiveView('chat')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeView === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}><ChatBubbleIcon /> Chat</button>
              </div>
              <button
                onClick={() => handleOpenModal()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md shadow-lg"
              >
                <PlusIcon />
                New Persona
              </button>
            </div>
          </div>
        </header>

        <main className={`${activeView === 'chat' ? 'flex-grow overflow-hidden' : ''}`}>
          {activeView === 'editor' ? (
            <PersonaList 
              personas={personas} 
              onEdit={handleOpenModal} 
              onDelete={handleDeletePersona} 
            />
          ) : (
            <ProductionChat 
              personas={personas}
              onAddPersona={() => handleOpenModal()}
              voices={voices}
              onManageVoices={() => setIsVoiceManagerOpen(true)}
            />
          )}
        </main>
      </div>
      
      {isModalOpen && (
        <PersonaEditorModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSavePersona}
          initialPersona={editingPersona}
        />
      )}
      {isVoiceManagerOpen && (
        <VoiceManagerModal
          isOpen={isVoiceManagerOpen}
          onClose={() => setIsVoiceManagerOpen(false)}
          initialVoices={voices}
          onSave={handleSaveVoices}
        />
      )}
    </div>
  );
};

export default App;
