import React, { useState, useCallback, ChangeEvent, useEffect, useMemo, useRef } from 'react';
import { Persona, PersonaState, PersonaHistoryEntry, ChatMessage, PersonaCreationChatMessage } from '../types';
import * as geminiService from '../services/geminiService';
import { MagicWandIcon, TextIcon, SaveIcon, CloseIcon, HistoryIcon, BackIcon, SendIcon, UndoIcon, UploadIcon, SearchIcon, SparklesIcon } from './icons';
import { Loader } from './Loader';

interface PersonaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: PersonaState & { id?: string }) => void;
  initialPersona: Persona | null;
}

const emptyPersona: PersonaState = {
  name: '',
  role: '',
  tone: '',
  personality: '',
  worldview: '',
  experience: '',
  other: '',
  summary: '',
  sources: [],
};

const CreationStartPanel: React.FC<{
  searchTopic: string;
  setSearchTopic: (topic: string) => void;
  handleCreateFromWeb: () => void;
  isLoading: boolean;
  setCreationMode: (mode: 'chat' | 'editing') => void;
  handleUploadClick: () => void;
  handleFileDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUploadForExtraction: (file: File) => void;
}> = ({ searchTopic, setSearchTopic, handleCreateFromWeb, isLoading, setCreationMode, handleUploadClick, handleFileDrop, handleDragOver, fileInputRef, handleFileUploadForExtraction }) => (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center bg-gray-900/50 rounded-lg">
        <h3 className="text-2xl font-bold text-gray-200">Create New Persona</h3>
        <p className="text-gray-400 mt-1 mb-8">Choose a method to start building your character.</p>
        
        <div className="w-full max-w-lg space-y-6">
            {/* 1. Web Search */}
            <div>
                <h4 className="text-lg font-semibold text-gray-300 mb-2 text-left">From a Topic</h4>
                 <div className="flex gap-2">
                    <input type="text" value={searchTopic} onChange={(e) => setSearchTopic(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateFromWeb()} placeholder="e.g., 'A stoic samurai from the Edo period'" className="w-full bg-gray-800/60 rounded-md p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={handleCreateFromWeb} disabled={isLoading || !searchTopic.trim()} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-colors rounded-md shadow-lg"><SearchIcon/> Generate</button>
                </div>
            </div>

            {/* OR separator */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-700"></div></div>
                <div className="relative flex justify-center"><span className="px-2 bg-gray-800 text-sm text-gray-500">OR</span></div>
            </div>

             {/* 2. Chat with AI */}
            <div>
                 <button onClick={() => setCreationMode('chat')} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700/80 transition-colors rounded-lg shadow-md text-left">
                    <SparklesIcon />
                    <div>
                        <p className="font-semibold text-indigo-400">Create with AI Chat</p>
                        <p className="text-xs text-gray-500">Build your persona step-by-step by talking to the AI.</p>
                    </div>
                </button>
            </div>
            
             {/* OR separator */}
             <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-700"></div></div>
                <div className="relative flex justify-center"><span className="px-2 bg-gray-800 text-sm text-gray-500">OR</span></div>
            </div>

            {/* 3. Upload File */}
            <div
                className="flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700/80 transition-colors rounded-lg shadow-md text-left cursor-pointer"
                onClick={handleUploadClick} onDrop={handleFileDrop} onDragOver={handleDragOver}
            >
                <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={(e) => e.target.files && handleFileUploadForExtraction(e.target.files[0])} />
                <UploadIcon />
                <div>
                    <p className="font-semibold text-indigo-400">From a File</p>
                    <p className="text-xs text-gray-500">Upload a .txt file to automatically generate parameters.</p>
                </div>
            </div>
        </div>
    </div>
);
  
const CreationChatPanel: React.FC<{
    creationChatHistory: PersonaCreationChatMessage[];
    isCreationChatLoading: boolean;
    creationChatInput: string;
    setCreationChatInput: (input: string) => void;
    handleCreationChatMessageSend: () => void;
    parameters: PersonaState & { id?: string };
    setCreationMode: (mode: 'start' | 'editing') => void;
}> = ({ creationChatHistory, isCreationChatLoading, creationChatInput, setCreationChatInput, handleCreationChatMessageSend, parameters, setCreationMode }) => (
    <div className="flex flex-col h-full p-4 sm:p-6 bg-gray-900/50 rounded-lg">
      <h3 className="text-2xl font-bold text-gray-200 mb-4">Create with AI Chat</h3>
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        
        {/* Left side: Chat */}
        <div className="flex flex-col bg-gray-800/60 rounded-lg p-4">
          <div className="flex-grow overflow-y-auto pr-2 space-y-4">
            {/* Initial AI message */}
            {creationChatHistory.length === 0 && (
              <div className="flex items-end gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                  <div className="max-w-md lg:max-w-xl px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                      <p className="whitespace-pre-wrap">こんにちは！一緒にキャラクターを作りましょう。どんなキャラクターをイメージしていますか？ 例えば、「未来都市の探偵」や「魔法学校の生徒」など、自由なアイデアを教えてください。</p>
                  </div>
              </div>
            )}
            {creationChatHistory.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                )}
                <div className={`max-w-md lg:max-w-xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isCreationChatLoading && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={creationChatInput}
              onChange={(e) => setCreationChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreationChatMessageSend()}
              placeholder="AIにメッセージを送信..."
              className="w-full bg-gray-700/80 rounded-md p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreationChatLoading}
            />
            <button
              onClick={handleCreationChatMessageSend}
              disabled={isCreationChatLoading || !creationChatInput.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-colors rounded-md shadow-lg flex items-center justify-center"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        {/* Right side: Live Preview */}
        <div className="flex flex-col bg-gray-800/60 rounded-lg p-4 overflow-y-auto">
            <h4 className="text-lg font-semibold text-gray-300 mb-4">Live Persona Preview</h4>
            <div className="space-y-3">
              {Object.entries(emptyPersona).filter(([key]) => key !== 'summary' && key !== 'sources').map(([key]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-400 capitalize">{key}</label>
                  <p className="w-full bg-gray-900/50 rounded-md p-2 mt-1 text-gray-200 min-h-[2.5rem]">
                    {parameters[key as keyof Omit<PersonaState, 'summary' | 'sources'>] || <span className="text-gray-500">...</span>}
                  </p>
                </div>
              ))}
            </div>
        </div>
      </div>
       <div className="flex justify-between items-center mt-6">
            <button onClick={() => setCreationMode('start')} className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white">
                <BackIcon />
                Back to Methods
            </button>
           <button onClick={() => setCreationMode('editing')} disabled={!parameters.name} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                Finish & Edit Persona
            </button>
       </div>
    </div>
);
  
const ParameterInput: React.FC<{ name: string, label: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, isTextArea?: boolean }> = ({ name, label, value, onChange, isTextArea = false }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      {isTextArea ? (
        <textarea id={name} name={name} value={value} onChange={onChange} rows={3} className="w-full bg-gray-800/60 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
      ) : (
        <input type="text" id={name} name={name} value={value} onChange={onChange} className="w-full bg-gray-800/60 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
      )}
    </div>
);

const ParametersPanel: React.FC<{
  mobileView: string;
  setMobileView: (view: 'overview' | 'params' | 'summary' | 'history') => void;
  parameters: PersonaState;
  handleParamChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}> = ({ mobileView, setMobileView, parameters, handleParamChange }) => (
    <>
      {mobileView !== 'overview' && (
        <button onClick={() => setMobileView('overview')} className="md:hidden flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-4">
          <BackIcon /> Back to Overview
        </button>
      )}
      <div className="space-y-4">
        <ParameterInput name="name" label="Name" value={parameters.name} onChange={handleParamChange} />
        <ParameterInput name="role" label="Role" value={parameters.role} onChange={handleParamChange} />
        <ParameterInput name="tone" label="Tone" value={parameters.tone} onChange={handleParamChange} isTextArea />
        <ParameterInput name="personality" label="Personality" value={parameters.personality} onChange={handleParamChange} isTextArea />
        <ParameterInput name="worldview" label="Worldview / Background" value={parameters.worldview} onChange={handleParamChange} isTextArea />
        <ParameterInput name="experience" label="Experience / History" value={parameters.experience} onChange={handleParamChange} isTextArea />
        <ParameterInput name="other" label="Other Notes" value={parameters.other} onChange={handleParamChange} isTextArea />
      </div>
    </>
);

const SummaryPanel: React.FC<{
  mobileView: string;
  setMobileView: (view: 'overview' | 'params' | 'summary' | 'history') => void;
  parameters: PersonaState;
  isNewPersona: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUploadForExtraction: (file: File) => void;
  handleFileDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleUploadClick: () => void;
  handleSummaryChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  handleGenerateSummary: (params: PersonaState, message?: string) => void;
  handleSyncFromSummary: () => void;
}> = ({ mobileView, setMobileView, parameters, isNewPersona, fileInputRef, handleFileUploadForExtraction, handleFileDrop, handleDragOver, handleUploadClick, handleSummaryChange, isLoading, handleGenerateSummary, handleSyncFromSummary }) => (
    <>
      {mobileView !== 'overview' && (
        <button onClick={() => setMobileView('overview')} className="md:hidden flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-4">
          <BackIcon /> Back to Overview
        </button>
      )}
      <div className="flex flex-col h-full">
         {!parameters.summary && !parameters.name && isNewPersona ? (
            <div 
                className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-gray-800/50 transition-all"
                onClick={handleUploadClick} onDrop={handleFileDrop} onDragOver={handleDragOver}
            >
                <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={(e) => e.target.files && handleFileUploadForExtraction(e.target.files[0])} />
                <UploadIcon />
                <p className="mt-2 text-lg font-semibold text-gray-400">Upload a Character Sheet</p>
                <p className="text-sm text-gray-500">Drag & drop or click to upload a .txt file to get started.</p>
            </div>
         ) : (
            <>
                <textarea
                  name="summary"
                  value={parameters.summary}
                  onChange={handleSummaryChange}
                  className="w-full flex-grow bg-gray-800/60 rounded-md p-3 text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="AI-generated summary will appear here. You can also edit it directly."
                  rows={10}
                />
                {parameters.sources && parameters.sources.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-400">Sources:</h4>
                        <ul className="list-disc list-inside text-xs text-gray-500 mt-1 space-y-1">
                            {parameters.sources.map((source, index) => (
                                <li key={index}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 underline truncate">{source.title}</a></li>
                            ))}
                        </ul>
                    </div>
                )}
            </>
         )}
         <div className="flex flex-col gap-2 mt-4">
          <button onClick={() => handleGenerateSummary(parameters, "AI is updating summary...")} disabled={isLoading || !parameters.name} className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm bg-indigo-600/80 hover:bg-indigo-600 disabled:bg-indigo-900/50 disabled:cursor-not-allowed transition-colors rounded-md"><MagicWandIcon /> Refresh Summary</button>
          <button onClick={handleSyncFromSummary} disabled={isLoading || !parameters.summary} className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed transition-colors rounded-md"><TextIcon /> Sync from Summary</button>
         </div>
      </div>
    </>
);

const HistoryPanel: React.FC<{
  mobileView: string;
  setMobileView: (view: 'overview' | 'params' | 'summary' | 'history') => void;
  previousParameters: (PersonaState & { id?: string }) | null;
  handleUndo: () => void;
  initialPersona: Persona | null;
  handleRevert: (entry: PersonaHistoryEntry) => void;
}> = ({ mobileView, setMobileView, previousParameters, handleUndo, initialPersona, handleRevert }) => (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           {mobileView !== 'overview' && <button onClick={() => setMobileView('overview')} className="md:hidden flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"><BackIcon /> Back</button>}
          <h3 className="text-lg font-semibold">Version History</h3>
        </div>
        {previousParameters && <button onClick={handleUndo} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"><UndoIcon /> Undo Last AI Edit</button>}
      </div>
      <div className="space-y-3 overflow-y-auto">
        {initialPersona?.history && initialPersona.history.length > 0 ? (
          initialPersona.history.map(entry => (
            <div key={entry.timestamp} className="bg-gray-800/70 p-3 rounded-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-300">{entry.changeSummary}</p>
                  <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
                <button onClick={() => handleRevert(entry)} className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Revert</button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No saved versions yet.</p>
        )}
      </div>
    </>
);


export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({ isOpen, onClose, onSave, initialPersona }) => {
  const [parameters, setParameters] = useState<PersonaState & { id?: string }>(initialPersona || { ...emptyPersona });
  const [previousParameters, setPreviousParameters] = useState<PersonaState & { id?: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'editor' | 'chat'>('editor');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobileView, setMobileView] = useState<'overview' | 'params' | 'summary' | 'history'>('overview');
  
  const [searchTopic, setSearchTopic] = useState('');
  const isNewPersona = !initialPersona;
  const [creationMode, setCreationMode] = useState<'start' | 'editing' | 'chat'>(isNewPersona ? 'start' : 'editing');
  const [creationChatHistory, setCreationChatHistory] = useState<PersonaCreationChatMessage[]>([]);
  const [creationChatInput, setCreationChatInput] = useState('');
  const [isCreationChatLoading, setIsCreationChatLoading] = useState(false);


  // Reset state when modal opens/closes or initial persona changes
  useEffect(() => {
    setParameters(initialPersona || { ...emptyPersona });
    setPreviousParameters(null);
    setError(null);
    setActiveTab('editor');
    setChatHistory([]);
    setChatInput('');
    setMobileView('overview');
    setCreationMode(initialPersona ? 'editing' : 'start');
    setSearchTopic('');
    setCreationChatHistory([]);
    setCreationChatInput('');
    setIsCreationChatLoading(false);
  }, [initialPersona, isOpen]);

  const handleGenerateSummary = useCallback(async (paramsToSummarize: PersonaState, message = "AI is generating a summary...") => {
    if(!paramsToSummarize.name) {
      setError("Please provide a name before generating a summary.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setLoadingMessage(message);
    try {
      // Pass all params but with an empty summary to avoid biasing the model
      const generatedSummary = await geminiService.generateSummaryFromParams({ ...paramsToSummarize, summary: '' });
      setParameters(prev => ({...prev, summary: generatedSummary}));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUploadForExtraction = useCallback(async (file: File) => {
    if (file && file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) { setError("File is empty."); return; }
            setError(null);
            setIsLoading(true);
            setLoadingMessage("AI is analyzing the document...");
            setPreviousParameters(parameters); // Save current state for undo
            try {
                const extractedParams = await geminiService.extractParamsFromDoc(text);
                const newParams = {
                    ...parameters,
                    name: extractedParams.name ?? parameters.name,
                    role: extractedParams.role ?? parameters.role,
                    tone: extractedParams.tone ?? parameters.tone,
                    personality: extractedParams.personality ?? parameters.personality,
                    worldview: extractedParams.worldview ?? parameters.worldview,
                    experience: extractedParams.experience ?? parameters.experience,
                    other: extractedParams.other ?? parameters.other,
                    summary: extractedParams.summary ?? parameters.summary,
                    sources: extractedParams.sources ?? parameters.sources,
                };
                setParameters(newParams);
                await handleGenerateSummary(newParams, "AI is generating summary from document...");
                setCreationMode('editing');
            } catch (err) {
                setError(err instanceof Error ? err.message : "An unknown error occurred.");
                setPreviousParameters(null); // Clear undo state on error
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    } else {
        setError("Please upload a valid .txt file.");
    }
  }, [parameters, handleGenerateSummary]);

  const handleCreateFromWeb = async () => {
    if (!searchTopic.trim()) {
      setError("Please enter a topic to search for.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setLoadingMessage("Searching the web and creating persona...");
    setPreviousParameters(parameters); // for undo
    try {
      const { personaState } = await geminiService.createPersonaFromWeb(searchTopic);
      const newParams = {
          ...parameters,
          name: personaState.name ?? parameters.name,
          role: personaState.role ?? parameters.role,
          tone: personaState.tone ?? parameters.tone,
          personality: personaState.personality ?? parameters.personality,
          worldview: personaState.worldview ?? parameters.worldview,
          experience: personaState.experience ?? parameters.experience,
          other: personaState.other ?? parameters.other,
          sources: personaState.sources ?? parameters.sources,
      };
      setParameters(newParams);
      // Now, generate a summary based on these new params
      await handleGenerateSummary(newParams, "AI is generating a summary...");
      setCreationMode('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create persona from the web.");
      setPreviousParameters(null);
    } finally {
      setIsLoading(false);
    }
  };


  const handleParamChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setParameters(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleSummaryChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setParameters(prev => ({ ...prev, summary: value }));
  }, []);

  const handleSyncFromSummary = async () => {
    if (!parameters.summary.trim()) { setError("Summary is empty."); return; }
    setError(null);
    setIsLoading(true);
    setLoadingMessage("AI is updating parameters from summary...");
    setPreviousParameters(parameters); // Save current state for undo
    try {
      const extractedParams = await geminiService.updateParamsFromSummary(parameters.summary);
      setParameters(prev => ({
          ...prev,
          name: extractedParams.name ?? prev.name,
          role: extractedParams.role ?? prev.role,
          tone: extractedParams.tone ?? prev.tone,
          personality: extractedParams.personality ?? prev.personality,
          worldview: extractedParams.worldview ?? prev.worldview,
          experience: extractedParams.experience ?? prev.experience,
          other: extractedParams.other ?? prev.other,
      }));
    } catch (err)
      {
      setError(err instanceof Error ? err.message : "Failed to update parameters from summary.");
      setPreviousParameters(null); // Clear undo state on error
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!parameters.name) { setError("Persona name is required."); return; }
    setIsLoading(true);
    setLoadingMessage("Saving and analyzing changes...");
    try {
      await onSave(parameters);
    } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during save.");
    } finally {
        setIsLoading(false);
    }
  }

  const handleRevert = useCallback((historyEntry: PersonaHistoryEntry) => {
    setParameters(prev => ({ ...prev, ...historyEntry.state }));
    setPreviousParameters(null); // History revert clears undo state
    setMobileView('overview');
  }, []);
  
  const handleUndo = useCallback(() => {
    if (previousParameters) {
        setParameters(previousParameters);
        setPreviousParameters(null);
    }
  }, [previousParameters]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: chatInput }] };
    const newHistory = [...chatHistory, newUserMessage];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);
    setError(null);
    try {
      const responseText = await geminiService.getPersonaChatResponse(parameters, newHistory);
      const modelMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get chat response.");
      setChatHistory(chatHistory); // Revert history on error
    } finally {
      setIsChatLoading(false);
    }
  };
  
  const handleCreationChatMessageSend = async () => {
    if (!creationChatInput.trim() || isCreationChatLoading) return;
    const newUserMessage: PersonaCreationChatMessage = { role: 'user', text: creationChatInput };
    const newHistory = [...creationChatHistory, newUserMessage];
    setCreationChatHistory(newHistory);
    setCreationChatInput('');
    setIsCreationChatLoading(true);
    setError(null);
    
    try {
        const { responseText, updatedParameters } = await geminiService.continuePersonaCreationChat(newHistory, parameters);
        const modelMessage: PersonaCreationChatMessage = { role: 'model', text: responseText };
        setCreationChatHistory(prev => [...prev, modelMessage]);
        setParameters(prev => ({
            ...prev,
            name: updatedParameters.name ?? prev.name,
            role: updatedParameters.role ?? prev.role,
            tone: updatedParameters.tone ?? prev.tone,
            personality: updatedParameters.personality ?? prev.personality,
            worldview: updatedParameters.worldview ?? prev.worldview,
            experience: updatedParameters.experience ?? prev.experience,
            other: updatedParameters.other ?? prev.other,
        }));
    } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get chat response.");
        setCreationChatHistory(creationChatHistory); // Revert history
    } finally {
        setIsCreationChatLoading(false);
    }
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer.files && event.dataTransfer.files[0]) {
          handleFileUploadForExtraction(event.dataTransfer.files[0]);
      }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
       {isLoading && <Loader message={loadingMessage} />}
      <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col relative" onClick={e => e.stopPropagation()}>
        <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">{initialPersona ? 'Edit Persona' : 'Create New Persona'}</h2>
          <div className="flex items-center gap-2">
             {creationMode === 'editing' &&
              <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
                <button onClick={() => setActiveTab('editor')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Editor</button>
                <button onClick={() => setActiveTab('chat')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Test Chat</button>
              </div>
             }
            <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon/></button>
          </div>
        </header>
        
        <main className="flex-grow p-1 sm:p-6 overflow-y-auto min-h-0">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-md mb-4 text-sm">{error}</div>}
          
          {creationMode === 'start' && <CreationStartPanel 
            searchTopic={searchTopic}
            setSearchTopic={setSearchTopic}
            handleCreateFromWeb={handleCreateFromWeb}
            isLoading={isLoading}
            setCreationMode={setCreationMode}
            handleUploadClick={handleUploadClick}
            handleFileDrop={handleFileDrop}
            handleDragOver={handleDragOver}
            fileInputRef={fileInputRef}
            handleFileUploadForExtraction={handleFileUploadForExtraction}
          />}

          {creationMode === 'chat' && <CreationChatPanel 
            creationChatHistory={creationChatHistory}
            isCreationChatLoading={isCreationChatLoading}
            creationChatInput={creationChatInput}
            setCreationChatInput={setCreationChatInput}
            handleCreationChatMessageSend={handleCreationChatMessageSend}
            parameters={parameters}
            setCreationMode={setCreationMode}
          />}

          {creationMode === 'editing' && activeTab === 'editor' && (
             <div className="h-full">
                {/* Mobile View */}
                <div className="md:hidden h-full">
                    {mobileView === 'overview' && (
                        <div className="space-y-4 p-4">
                            <h3 className="text-lg font-semibold text-gray-400">Select a section to edit</h3>
                            <div onClick={() => setMobileView('params')} className="bg-gray-900/50 p-4 rounded-lg cursor-pointer flex justify-between items-center"><div><h4 className="font-bold text-gray-200">Parameters</h4><p className="text-sm text-gray-500">{parameters.name || "Set character details"}</p></div><span className="text-gray-600">&gt;</span></div>
                            <div onClick={() => setMobileView('summary')} className="bg-gray-900/50 p-4 rounded-lg cursor-pointer flex justify-between items-center"><div><h4 className="font-bold text-gray-200">AI-Generated Summary</h4><p className="text-sm text-gray-500 truncate">{parameters.summary || "Generate or upload a summary"}</p></div><span className="text-gray-600">&gt;</span></div>
                            {initialPersona?.history && initialPersona.history.length > 0 && 
                              <div onClick={() => setMobileView('history')} className="bg-gray-900/50 p-4 rounded-lg cursor-pointer flex justify-between items-center"><div><h4 className="font-bold text-gray-200">Version History</h4><p className="text-sm text-gray-500">{initialPersona.history.length} versions saved</p></div><span className="text-gray-600">&gt;</span></div>
                            }
                        </div>
                    )}
                    {mobileView === 'params' && <div className="p-4 h-full"><ParametersPanel mobileView={mobileView} setMobileView={setMobileView} parameters={parameters} handleParamChange={handleParamChange}/></div>}
                    {mobileView === 'summary' && <div className="p-4 h-full"><SummaryPanel 
                        mobileView={mobileView} 
                        setMobileView={setMobileView} 
                        parameters={parameters} 
                        isNewPersona={isNewPersona} 
                        fileInputRef={fileInputRef} 
                        handleFileUploadForExtraction={handleFileUploadForExtraction}
                        handleFileDrop={handleFileDrop}
                        handleDragOver={handleDragOver}
                        handleUploadClick={handleUploadClick}
                        handleSummaryChange={handleSummaryChange}
                        isLoading={isLoading}
                        handleGenerateSummary={handleGenerateSummary}
                        handleSyncFromSummary={handleSyncFromSummary}
                      /></div>}
                    {mobileView === 'history' && <div className="p-4 h-full"><HistoryPanel 
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        previousParameters={previousParameters}
                        handleUndo={handleUndo}
                        initialPersona={initialPersona}
                        handleRevert={handleRevert}
                      /></div>}
                </div>

                {/* Desktop View */}
                <div className={`hidden md:grid h-full gap-6 ${initialPersona?.history && initialPersona.history.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="bg-gray-900/50 p-4 rounded-lg overflow-y-auto"><ParametersPanel mobileView={mobileView} setMobileView={setMobileView} parameters={parameters} handleParamChange={handleParamChange}/></div>
                  <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col"><SummaryPanel 
                      mobileView={mobileView} 
                      setMobileView={setMobileView} 
                      parameters={parameters} 
                      isNewPersona={isNewPersona} 
                      fileInputRef={fileInputRef} 
                      handleFileUploadForExtraction={handleFileUploadForExtraction}
                      handleFileDrop={handleFileDrop}
                      handleDragOver={handleDragOver}
                      handleUploadClick={handleUploadClick}
                      handleSummaryChange={handleSummaryChange}
                      isLoading={isLoading}
                      handleGenerateSummary={handleGenerateSummary}
                      handleSyncFromSummary={handleSyncFromSummary}
                    /></div>
                  {initialPersona?.history && initialPersona.history.length > 0 &&
                    <div className="bg-gray-900/50 p-4 rounded-lg overflow-y-auto"><HistoryPanel 
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        previousParameters={previousParameters}
                        handleUndo={handleUndo}
                        initialPersona={initialPersona}
                        handleRevert={handleRevert}
                      /></div>
                  }
                </div>
            </div>
          )}

          {creationMode === 'editing' && activeTab === 'chat' && (
             <div className="flex flex-col h-full bg-gray-900/50 rounded-lg">
                <div ref={useRef<HTMLDivElement>(null)} className="flex-grow p-4 overflow-y-auto space-y-4">
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">{parameters.name.charAt(0) || 'P'}</div>}
                            <div className={`max-w-md lg:max-w-xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                            </div>
                        </div>
                    ))}
                    {isChatLoading && <div className="flex items-end gap-2 justify-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">{parameters.name.charAt(0) || 'P'}</div>
                        <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                          <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></span></div>
                        </div>
                    </div>}
                </div>
                <div className="flex-shrink-0 p-4 border-t border-gray-700 flex items-center gap-2">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="ペルソナとしてメッセージをテスト..." className="w-full bg-gray-700/80 rounded-md p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={isChatLoading} />
                    <button onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()} className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-colors rounded-md shadow-lg flex items-center justify-center"><SendIcon /></button>
                </div>
             </div>
          )}
        </main>
        
        {creationMode === 'editing' && (
            <footer className="flex-shrink-0 flex justify-end p-4 border-t border-gray-700">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white mr-2">Cancel</button>
            <button onClick={handleSave} disabled={isLoading || !parameters.name} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                <SaveIcon />
                Save Persona
            </button>
            </footer>
        )}
      </div>
    </div>
  );
};
